const API_URL =
  location.port === "5500" && ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:10000"
    : window.location.origin;

const urlInput = document.getElementById("videoUrl");
const pasteBtn = document.getElementById("pasteBtn");
const previewBtn = document.getElementById("previewBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusBox = document.getElementById("status");
const videoArea = document.getElementById("videoArea");
const videoPlayer = document.getElementById("videoPlayer");

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = "status";

  if (type) {
    statusBox.classList.add(type);
  }
}

function getVideoUrl() {
  const value = urlInput.value.trim();

  if (!value) {
    throw new Error("Please paste a video URL first.");
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Please enter a valid video URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only secure HTTPS video links are supported.");
  }

  return parsed.href;
}

pasteBtn.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();

    if (!text) {
      setStatus("Your clipboard is empty.", "error");
      return;
    }

    urlInput.value = text.trim();
    setStatus("Link pasted. You can preview or download it.", "success");
  } catch {
    setStatus("Clipboard access blocked. Please paste your link manually.", "error");
  }
});

previewBtn.addEventListener("click", () => {
  try {
    const url = getVideoUrl();

    videoPlayer.pause();
    videoPlayer.removeAttribute("src");
    videoPlayer.load();

    videoPlayer.src = url;
    videoArea.classList.remove("hidden");

    videoPlayer.load();
    setStatus("Preview loaded. Playback depends on the video host.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

downloadBtn.addEventListener("click", async () => {
  let url;

  try {
    url = getVideoUrl();
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }

  downloadBtn.disabled = true;
  previewBtn.disabled = true;
  setStatus("Connecting to VIDORA server...");

  try {
    const response = await fetch(`${API_URL}/api/file-download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      let message = "Download failed.";

      try {
        const data = await response.json();
        message = data.error || message;
      } catch {
        // Keep the default error message.
      }

      throw new Error(message);
    }

    const blob = await response.blob();

    if (!blob.size) {
      throw new Error("The video file was empty.");
    }

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = "VIDORA-video.mp4";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

    setStatus("Download started. Check your Downloads folder.", "success");
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", "error");
  } finally {
    downloadBtn.disabled = false;
    previewBtn.disabled = false;
  }
});