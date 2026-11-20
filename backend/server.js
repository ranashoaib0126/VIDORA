
const express = require("express");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");

const app = express();

app.use(express.json({ limit: "10kb" }));

// Local development: serve frontend files from public
// Vercel serves public assets separately.
if (process.env.VERCEL !== "1") {
    app.use(express.static(path.join(__dirname, "public")));
}

// Check whether an IPv4 address is publicly routable
function isPublicIPv4(ip) {
    if (!net.isIPv4(ip)) return false;

    const p = ip.split(".").map(Number);
    const a = p[0];
    const b = p[1];
    const c = p[2];

    if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 192 && b === 0 && c === 0) ||
        (a === 192 && b === 0 && c === 2) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && c === 100) ||
        (a === 203 && b === 0 && c === 113)
    ) {
        return false;
    }

    return true;
}

// Validate direct video URL
async function validateVideoURL(value) {
    let url;

    try {
        url = new URL(value);
    } catch {
        throw new Error("Please enter a valid video URL.");
    }

    if (url.protocol !== "https:") {
        throw new Error("Only HTTPS video links are supported.");
    }

    if (url.username || url.password) {
        throw new Error("Links containing login credentials are not supported.");
    }

    const hostname = url.hostname.toLowerCase();

    if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local")
    ) {
        throw new Error("This video host is not allowed.");
    }

    // Reject IP literals unless they are public IPv4 addresses
    if (net.isIP(hostname)) {
        if (!isPublicIPv4(hostname)) {
            throw new Error("This video host is not allowed.");
        }
    } else {
        const records = await dns.lookup(hostname, { all: true });

        if (
            !records.length ||
            records.some(record => !isPublicIPv4(record.address))
        ) {
            throw new Error("This video host is not allowed.");
        }
    }

    return url;
}

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        app: "VIDORA",
        status: "running"
    });
});

// Video download API
app.post("/api/file-download", async (req, res) => {
    let controller;

    try {
        const input = req.body?.url;

        if (typeof input !== "string" || !input.trim()) {
            return res.status(400).json({
                error: "Please provide a video URL."
            });
        }

        const url = await validateVideoURL(input.trim());

        controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 45000);

        let response;

        try {
            response = await fetch(url, {
                method: "GET",
                redirect: "error",
                signal: controller.signal,
                headers: {
                    "User-Agent": "VIDORA/1.0"
                }
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            return res.status(400).json({
                error: "The video host could not provide this file."
            });
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.toLowerCase().startsWith("video/")) {
            return res.status(415).json({
                error: "This link does not point directly to a video file."
            });
        }

        const contentLength = Number(
            response.headers.get("content-length") || 0
        );

        const MAX_SIZE = 100 * 1024 * 1024;

        if (contentLength > MAX_SIZE) {
            controller.abort();

            return res.status(413).json({
                error: "This file is larger than the 100 MB limit."
            });
        }

        if (!response.body) {
            return res.status(400).json({
                error: "The video host returned an empty response."
            });
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="vidora-video.mp4"'
        );

        if (contentLength > 0) {
            res.setHeader("Content-Length", contentLength);
        }

        let downloadedBytes = 0;

        const sizeLimit = new Transform({
            transform(chunk, encoding, callback) {
                downloadedBytes += chunk.length;

                if (downloadedBytes > MAX_SIZE) {
                    callback(
                        new Error("VIDEO_SIZE_LIMIT")
                    );
                    return;
                }

                callback(null, chunk);
            }
        });

        await pipeline(
            Readable.fromWeb(response.body),
            sizeLimit,
            res
        );

    } catch (error) {
        console.error("VIDORA download error:", error.message);

        if (controller) {
            controller.abort();
        }

        if (!res.headersSent) {
            let status = 400;
            let errorMessage = error.message || "Unable to download this video.";

            if (error.name === "AbortError") {
                errorMessage = "The video host took too long to respond.";
            }

            if (error.message === "VIDEO_SIZE_LIMIT") {
                status = 413;
                errorMessage = "This file is larger than the 100 MB limit.";
            }

            res.status(status).json({
                error: errorMessage
            });
        } else {
            res.destroy(error);
        }
    }
});

// Export Express app for Vercel
module.exports = app;

// Start local server when running directly
if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`VIDORA running at http://localhost:${PORT}`);
    });
}
