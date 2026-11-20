
const videoInput = document.getElementById("videoUrl");
const downloadButton = document.getElementById("downloadBtn");
const message = document.getElementById("message");

function showMessage(text, type = "") {
    message.textContent = text;
    message.className = "message " + type;
}

downloadButton.addEventListener("click", async () => {
    const videoUrl = videoInput.value.trim();

    if (!videoUrl) {
        showMessage("Please paste a video URL first.", "error");
        videoInput.focus();
        return;
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(videoUrl);
    } catch {
        showMessage("Please enter a valid video URL.", "error");
        return;
    }

    if (parsedUrl.protocol !== "https:") {
        showMessage("Only secure HTTPS video links are accepted.", "error");
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = "Checking...";
    showMessage("Checking your video link...");

    try {
        const response = await fetch("/api/file-download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: videoUrl })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "This link could not be downloaded.");
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = "vidora-video.mp4";
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        showMessage("Your download has started!", "success");
    } catch (error) {
        showMessage(error.message || "Something went wrong. Please try another direct video link.", "error");
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = "Download →";
    }
});

videoInput.addEventListener("keydown", event => {
    if (event.key === "Enter") downloadButton.click();
});
