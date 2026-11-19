
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Only allow this verified test host for now.
// Add other trusted hosts only after checking them.
const ALLOWED_HOSTS = [
    "www.w3schools.com"
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

function validateVideoUrl(value) {
    try {
        const url = new URL(value);

        if (url.protocol !== "https:") {
            return null;
        }

        if (!ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) {
            return null;
        }

        if (!url.pathname.toLowerCase().endsWith(".mp4")) {
            return null;
        }

        return url;
    } catch {
        return null;
    }
}

// Backend status
app.get("/", (req, res) => {
    res.send("VIDORA Backend is Running!");
});

// Direct video file download
app.post("/api/file-download", async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: "Please provide a video URL."
            });
        }

        const videoUrl = validateVideoUrl(url);

        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                message: "This video host is not approved for downloading."
            });
        }

        const upstream = await fetch(videoUrl.href, {
            redirect: "error",
            signal: AbortSignal.timeout(60000)
        });

        if (!upstream.ok) {
            return res.status(502).json({
                success: false,
                message: "Video host could not provide the file."
            });
        }

        const contentType =
            upstream.headers.get("content-type") || "";

        if (!contentType.toLowerCase().startsWith("video/")) {
            return res.status(415).json({
                success: false,
                message: "The provided link is not a video file."
            });
        }

        const contentLength = Number(
            upstream.headers.get("content-length") || 0
        );

        if (contentLength > MAX_FILE_SIZE) {
            return res.status(413).json({
                success: false,
                message: "Video exceeds the 100 MB test limit."
            });
        }

        const buffer = Buffer.from(
            await upstream.arrayBuffer()
        );

        if (buffer.length > MAX_FILE_SIZE) {
            return res.status(413).json({
                success: false,
                message: "Video exceeds the 100 MB test limit."
            });
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="vidora-video.mp4"'
        );
        res.setHeader("Content-Length", buffer.length);

        return res.send(buffer);

    } catch (error) {
        console.error("Download Error:", error);

        return res.status(500).json({
            success: false,
            message: "Download failed. Please try again."
        });
    }
});

// Social platform link validation only
function detectPlatform(value) {
    try {
        const url = new URL(value);

        if (url.protocol !== "https:") return null;

        const host = url.hostname.toLowerCase();

        if (
            host === "youtube.com" ||
            host.endsWith(".youtube.com") ||
            host === "youtu.be"
        ) return "YouTube";

        if (
            host === "tiktok.com" ||
            host.endsWith(".tiktok.com")
        ) return "TikTok";

        if (
            host === "instagram.com" ||
            host.endsWith(".instagram.com")
        ) return "Instagram";

        return null;

    } catch {
        return null;
    }
}

app.post("/api/download", (req, res) => {
    const { url } = req.body;
    const platform = url ? detectPlatform(url) : null;

    if (!platform) {
        return res.status(400).json({
            success: false,
            message: "Unsupported or invalid video link."
        });
    }

    return res.json({
        success: true,
        platform,
        downloadAvailable: false,
        message: "An authorized video provider is required for this platform."
    });
});

app.listen(PORT, () => {
    console.log(`VIDORA server running on port ${PORT}`);
});
