
const express = require("express");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");

const app = express();

app.use(express.json({ limit: "10kb" }));

// Serve the VIDORA frontend
app.use(express.static(path.join(__dirname, "public")));

// Check whether an IP address is public
function isPublicIP(ip) {
    if (net.isIPv4(ip)) {
        const parts = ip.split(".").map(Number);
        const [a, b] = parts;

        if (
            a === 10 ||
            a === 127 ||
            a === 0 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            a >= 224
        ) return false;

        return true;
    }

    if (net.isIPv6(ip)) {
        const address = ip.toLowerCase();

        if (
            address === "::1" ||
            address === "::" ||
            address.startsWith("fc") ||
            address.startsWith("fd") ||
            address.startsWith("fe80:") ||
            address.startsWith("::ffff:127.")
        ) return false;

        return true;
    }

    return false;
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
        throw new Error("This host is not allowed.");
    }

    const records = await dns.lookup(hostname, { all: true });

    if (!records.length || records.some(record => !isPublicIP(record.address))) {
        throw new Error("This video host is not allowed.");
    }

    return url;
}

// Download a direct video file
app.post("/api/file-download", async (req, res) => {
    try {
        const input = req.body?.url;

        if (typeof input !== "string" || !input.trim()) {
            return res.status(400).json({
                error: "Please provide a video URL."
            });
        }

        const url = await validateVideoURL(input.trim());

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);

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

        const contentLength = Number(response.headers.get("content-length") || 0);

        if (contentLength > 100 * 1024 * 1024) {
            return res.status(413).json({
                error: "This file is larger than the 100 MB limit."
            });
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="vidora-video"'
        );

        if (contentLength > 0) {
            res.setHeader("Content-Length", contentLength);
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.length > 100 * 1024 * 1024) {
            return res.status(413).json({
                error: "This file is larger than the 100 MB limit."
            });
        }

        res.send(buffer);

    } catch (error) {
        console.error("VIDORA download error:", error.message);

        if (!res.headersSent) {
            res.status(400).json({
                error: error.name === "AbortError"
                    ? "The video host took too long to respond."
                    : error.message || "Unable to download this video."
            });
        }
    }
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        app: "VIDORA",
        status: "running"
    });
});

// Vercel serverless entry point
module.exports = app;

// Local development
if (require.main === module) {
    const PORT = process.env.PORT || 10000;

    app.listen(PORT, () => {
        console.log(`VIDORA server running on port ${PORT}`);
    });
}
