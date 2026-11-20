
/* ==========================================
   VIDORA - BACKGROUND PARTICLE ANIMATION
========================================== */

const particlesContainer = document.getElementById("particles");

if (particlesContainer) {
    particlesContainer.innerHTML = "";

    for (let i = 0; i < 65; i++) {
        const particle = document.createElement("span");

        particle.className = "particle";
        particle.style.left = Math.random() * 100 + "%";
        particle.style.top = (75 + Math.random() * 30) + "%";
        particle.style.setProperty(
            "--particle-size",
            (2 + Math.random() * 3) + "px"
        );
        particle.style.setProperty(
            "--particle-duration",
            (10 + Math.random() * 18) + "s"
        );
        particle.style.setProperty(
            "--particle-delay",
            (-Math.random() * 25) + "s"
        );
        particle.style.opacity = Math.random() * 0.7 + 0.2;

        particlesContainer.appendChild(particle);
    }
}

/* ==========================================
   DOM ELEMENTS
========================================== */

const downloadForm = document.getElementById("downloadForm");
const videoUrl = document.getElementById("videoUrl");
const downloadBtn = document.getElementById("downloadBtn");
const buttonText = document.getElementById("buttonText");
const message = document.getElementById("message");

const videoPreview = document.getElementById("videoPreview");
const videoThumbnail = document.getElementById("videoThumbnail");
const videoTitle = document.getElementById("videoTitle");
const videoUploader = document.getElementById("videoUploader");
const videoDuration = document.getElementById("videoDuration");
const qualitySelect = document.getElementById("qualitySelect");
const startDownloadBtn = document.getElementById("startDownloadBtn");

let currentVideoUrl = "";

/* ==========================================
   HELPER FUNCTIONS
========================================== */

function showMessage(text, type) {
    if (!message) return;

    message.textContent = text;
    message.className = "message " + type;
}

function hidePreview() {
    if (videoPreview) {
        videoPreview.classList.remove("visible");
    }

    if (videoThumbnail) {
        videoThumbnail.classList.remove("visible");
        videoThumbnail.removeAttribute("src");
    }
}

function formatDuration(seconds) {
    if (!Number.isFinite(Number(seconds))) {
        return "Duration unavailable";
    }

    const totalSeconds = Number(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    return hours
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function resetFindButton() {
    if (!downloadBtn || !buttonText) return;

    downloadBtn.disabled = false;
    buttonText.textContent = "Find Video";
}

function setDownloadButtonLoading(loading) {
    if (!startDownloadBtn) return;

    startDownloadBtn.disabled = loading;
    startDownloadBtn.textContent = loading
        ? "Preparing your video..."
        : "Download Selected Quality ↓";
}

/* ==========================================
   FIND VIDEO
========================================== */

if (downloadForm) {
    downloadForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const url = videoUrl.value.trim();

        if (!url) {
            showMessage("Please paste a video link first.", "error");
            return;
        }

        try {
            const parsed = new URL(url);

            if (!["https:", "http:"].includes(parsed.protocol)) {
                throw new Error("Please enter a valid HTTP or HTTPS link.");
            }
        } catch (error) {
            showMessage(
                error.message || "Please enter a valid video link.",
                "error"
            );
            return;
        }

        currentVideoUrl = url;
        hidePreview();

        downloadBtn.disabled = true;
        buttonText.textContent = "Checking...";

        showMessage(
            "Finding video information. Please wait...",
            "loading"
        );

        try {
            const response = await fetch("/api/video-info", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || "Could not read this video."
                );
            }

            videoTitle.textContent = data.title || "Untitled video";

            videoUploader.textContent = data.uploader
                ? "Channel: " + data.uploader
                : "";

            videoDuration.textContent =
                "Duration: " + formatDuration(data.duration);

            /* VIDEO THUMBNAIL */

            if (data.thumbnail) {
                try {
                    const imageUrl = new URL(data.thumbnail);

                    if (
                        ["https:", "http:"].includes(imageUrl.protocol)
                    ) {
                        videoThumbnail.src = imageUrl.href;
                        videoThumbnail.classList.add("visible");
                    } else {
                        videoThumbnail.removeAttribute("src");
                        videoThumbnail.classList.remove("visible");
                    }
                } catch {
                    videoThumbnail.removeAttribute("src");
                    videoThumbnail.classList.remove("visible");
                }
            } else {
                videoThumbnail.removeAttribute("src");
                videoThumbnail.classList.remove("visible");
            }

            /* QUALITY OPTIONS */

            qualitySelect.innerHTML = "";

            for (const quality of data.qualities || []) {
                const option = document.createElement("option");

                option.value = String(quality.value);
                option.textContent = quality.label;

                qualitySelect.appendChild(option);
            }

            if (!qualitySelect.options.length) {
                const option = document.createElement("option");

                option.value = "0";
                option.textContent = "Best available";

                qualitySelect.appendChild(option);
            }

            videoPreview.classList.add("visible");

            showMessage(
                "Video found! Select your quality below.",
                "success"
            );

        } catch (error) {
            showMessage(
                error.message || "Something went wrong. Try another link.",
                "error"
            );

            hidePreview();

        } finally {
            resetFindButton();
        }
    });
}

/* ==========================================
   DOWNLOAD VIDEO
========================================== */

if (startDownloadBtn) {
    startDownloadBtn.addEventListener("click", async function () {
        if (!currentVideoUrl) {
            showMessage("Please find a video first.", "error");
            return;
        }

        setDownloadButtonLoading(true);

        showMessage(
            "Your video is being prepared. Please wait...",
            "loading"
        );

        try {
            const response = await fetch("/api/file-download", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    url: currentVideoUrl,
                    height: Number(qualitySelect.value)
                })
            });

            if (!response.ok) {
                let errorText = "Download failed.";

                try {
                    const data = await response.json();
                    errorText = data.error || errorText;
                } catch {
                    // Response was not JSON.
                }

                throw new Error(errorText);
            }

            const blob = await response.blob();

            if (!blob.size) {
                throw new Error("The downloaded video file is empty.");
            }

            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = objectUrl;
            link.download = "vidora-video.mp4";

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(function () {
                URL.revokeObjectURL(objectUrl);
            }, 60000);

            showMessage(
                "Your video download has started!",
                "success"
            );

        } catch (error) {
            showMessage(
                error.message || "Unable to download this video.",
                "error"
            );

        } finally {
            setDownloadButtonLoading(false);
        }
    });
}
