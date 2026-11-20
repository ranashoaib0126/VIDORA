
const particlesContainer = document.getElementById("particles");

// Animated background particles
for (let i = 0; i < 45; i++) {
    const particle = document.createElement("span");
    particle.className = "particle";

    particle.style.left = Math.random() * 100 + "%";
    particle.style.animationDuration = (8 + Math.random() * 15) + "s";
    particle.style.animationDelay = (Math.random() * 12) + "s";
    particle.style.opacity = Math.random() * 0.7 + 0.2;

    particlesContainer.appendChild(particle);
}

// Download form
const downloadForm = document.getElementById("downloadForm");
const videoUrl = document.getElementById("videoUrl");
const downloadBtn = document.getElementById("downloadBtn");
const buttonText = document.getElementById("buttonText");
const message = document.getElementById("message");

function showMessage(text, type) {
    message.textContent = text;
    message.className = "message " + type;
}

function resetButton() {
    downloadBtn.disabled = false;
    buttonText.textContent = "Download Video";
}

downloadForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const url = videoUrl.value.trim();

    if (!url) {
        showMessage("Please paste a video URL first.", "error");
        return;
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(url);
    } catch {
        showMessage("Please enter a valid video URL.", "error");
        return;
    }

    if (parsedUrl.protocol !== "https:") {
        showMessage("Please use a secure HTTPS video link.", "error");
        return;
    }

    downloadBtn.disabled = true;
    buttonText.textContent = "Processing...";
    showMessage("Please wait. Checking your video link...", "loading");

    try {
        const response = await fetch("/api/file-download", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            let errorMessage = "Unable to download this video.";

            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {}

            throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.toLowerCase().startsWith("video/")) {
            throw new Error("The server did not return a supported video file.");
        }

        const blob = await response.blob();

        if (!blob.size) {
            throw new Error("The downloaded file is empty.");
        }

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download = "vidora-video";
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);

        showMessage("Your video download has started!", "success");
        videoUrl.value = "";

    } catch (error) {
        showMessage(error.message || "Something went wrong. Please try again.", "error");
    } finally {
        resetButton();
    }
});
