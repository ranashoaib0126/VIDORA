
const videoInput = document.getElementById("videoUrl");
const downloadButton = document.getElementById("downloadBtn");
const message = document.getElementById("message");

downloadButton.textContent = "Download Video →";

function showMessage(text, type = "") {
    message.textContent = text;
    message.className = "message " + type;
}

downloadButton.addEventListener("click", async () => {
    const videoUrl = videoInput.value.trim();

    if (!videoUrl) {
        showMessage("Please paste a video URL first.", "error");
        return;
    }

    try {
        const parsedUrl = new URL(videoUrl);

        if (parsedUrl.protocol !== "https:") {
            showMessage("Please use a valid HTTPS video link.", "error");
            return;
        }
    } catch {
        showMessage("Please enter a valid video URL.", "error");
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = "Processing...";
    showMessage("Checking your video link...");

    try {
        const response = await fetch("/api/file-download", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: videoUrl })
        });

        if (!response.ok) {
            let errorMessage = "Download failed.";

            try {
                const data = await response.json();
                errorMessage = data.error || errorMessage;
            } catch {}

            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "VIDORA-video.mp4";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

        showMessage("Your video download has started!", "success");

    } catch (error) {
        showMessage(error.message || "Something went wrong.", "error");
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = "Download Video →";
    }
});
