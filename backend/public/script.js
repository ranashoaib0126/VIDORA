
// ========================================
// VIDORA - COMPLETE FRONTEND JAVASCRIPT
// ========================================

const videoInput = document.getElementById("videoUrl");
const downloadButton = document.getElementById("downloadBtn");
const message = document.getElementById("message");

// Show messages on screen
function showMessage(text, type = "") {
    message.textContent = text;
    message.className = "message " + type;
}

// Check if URL is valid HTTPS
function isValidVideoUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:";
    } catch {
        return false;
    }
}

// Check whether the link belongs to a supported social platform
function getPlatform(url) {
    const host = new URL(url).hostname.toLowerCase();

    if (
        host === "youtube.com" ||
        host.endsWith(".youtube.com") ||
        host === "youtu.be"
    ) {
        return "YouTube";
    }

    if (
        host === "tiktok.com" ||
        host.endsWith(".tiktok.com")
    ) {
        return "TikTok";
    }

    if (
        host === "instagram.com" ||
        host.endsWith(".instagram.com")
    ) {
        return "Instagram";
    }

    return null;
}

// Download a direct video file
async function downloadDirectVideo(url) {
    const response = await fetch("/api/file-download", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
    });

    if (!response.ok) {
        let data = {};

        try {
            data = await response.json();
        } catch {}

        throw new Error(
            data.message ||
            data.error ||
            "This direct video link is not supported."
        );
    }

    const blob = await response.blob();

    if (!blob.size) {
        throw new Error("The video file is empty.");
    }

    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "VIDORA-video.mp4";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 60000);
}

// Main button action
async function checkAndDownload() {
    const url = videoInput.value.trim();

    if (!url) {
        showMessage("Please paste a video URL first.", "error");
        videoInput.focus();
        return;
    }

    if (!isValidVideoUrl(url)) {
        showMessage("Please enter a valid HTTPS video link.", "error");
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = "Checking...";

    try {
        const platform = getPlatform(url);

        // Social links are currently checked, not downloaded
        if (platform) {
            const response = await fetch("/api/download", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to check this link."
                );
            }

            showMessage(
                platform + " link detected. Actual downloading is not enabled yet.",
                "success"
            );

            return;
        }

        // Try direct video file download
        downloadButton.textContent = "Downloading...";

        await downloadDirectVideo(url);

        showMessage(
            "Your video download has started!",
            "success"
        );

    } catch (error) {
        showMessage(
            error.message || "Something went wrong. Please try again.",
            "error"
        );
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = "Check Link →";
    }
}

// Button click
downloadButton.addEventListener("click", checkAndDownload);

// Enter key support
videoInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        checkAndDownload();
    }
});

// Paste support
videoInput.addEventListener("paste", () => {
    setTimeout(() => {
        if (videoInput.value.trim()) {
            showMessage("Link pasted. Click Check Link to continue.");
        }
    }, 100);
});

console.log("VIDORA JavaScript loaded successfully.");
