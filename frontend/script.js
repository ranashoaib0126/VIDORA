
const videoInput = document.getElementById("videoUrl");
const downloadButton = document.getElementById("downloadBtn");
const message = document.getElementById("message");

// Create animated background particles
const particleContainer = document.getElementById("particles");

if (particleContainer) {
    for (let i = 0; i < 45; i++) {
        const particle = document.createElement("span");
        particle.className = "particle";
        particle.style.left = Math.random() * 100 + "%";
        particle.style.top = Math.random() * 100 + "%";
        particle.style.animationDelay = -Math.random() * 8 + "s";
        particle.style.animationDuration = 5 + Math.random() * 7 + "s";
        particleContainer.appendChild(particle);
    }
}

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
        showMessage("Only HTTPS video links are supported.", "error");
        return;
    }

    downloadButton.disabled = true;
    downloadButton.textContent = "Processing...";
    showMessage("Checking your video link...");

    try {
        const response = await fetch("/api/file-download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: videoUrl })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "This video link could not be downloaded.");
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = "vidora-video";
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        showMessage("Your download has started!", "success");

    } catch (error) {
        showMessage(error.message || "Something went wrong. Try another direct video link.", "error");
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = "Download →";
    }
});

videoInput.addEventListener("keydown", event => {
    if (event.key === "Enter") downloadButton.click();
});
