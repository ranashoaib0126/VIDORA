const express = require("express");
const cors = require("cors");
const https = require("https");
const dns = require("dns").promises;
const ipaddr = require("ipaddr.js");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT = 30000;

app.use(express.json({ limit: "20kb" }));

app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

function isPublicAddress(address) {
  try {
    let parsed = ipaddr.parse(address);

    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }

    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

async function validateUrl(input) {
  let url;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid video URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS video links are allowed.");
  }

  if (url.username || url.password) {
    throw new Error("URLs containing login credentials are not allowed.");
  }

  if (url.port && url.port !== "443") {
    throw new Error("Only standard HTTPS port 443 is allowed.");
  }

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("This host is not allowed.");
  }

  let addresses;

  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve the video host.");
  }

  if (!addresses.length) {
    throw new Error("The video host has no valid IP address.");
  }

  if (addresses.some(item => !isPublicAddress(item.address))) {
    throw new Error("This video host is not allowed.");
  }

  return { url, ip: addresses[0].address, family: addresses[0].family };
}

function requestOnce(url, ip, family) {
  return new Promise((resolve, reject) => {
    const options = {
      protocol: "https:",
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        "User-Agent": "VIDORA/1.0",
        "Accept": "video/mp4,video/*,application/octet-stream;q=0.9"
      },
      timeout: REQUEST_TIMEOUT,
      lookup: (hostname, lookupOptions, callback) => {
        callback(null, ip, family);
      }
    };

    const request = https.request(options, response => {
      resolve({ request, response });
    });

    request.on("timeout", () => {
      request.destroy(new Error("The video host took too long to respond."));
    });

    request.on("error", reject);
    request.end();
  });
}

async function getVideoResponse(input, redirects = 0) {
  const validated = await validateUrl(input);
  const { request, response } = await requestOnce(
    validated.url,
    validated.ip,
    validated.family
  );

  const status = response.statusCode || 0;

  if ([301, 302, 303, 307, 308].includes(status)) {
    const location = response.headers.location;
    response.resume();

    if (!location) {
      throw new Error("The video host returned an invalid redirect.");
    }

    if (redirects >= MAX_REDIRECTS) {
      throw new Error("Too many redirects from the video host.");
    }

    const nextUrl = new URL(location, validated.url).href;
    return getVideoResponse(nextUrl, redirects + 1);
  }

  if (status < 200 || status >= 300) {
    response.resume();
    throw new Error(`Video host returned HTTP ${status}.`);
  }

  const contentType = String(response.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  const allowedType =
    contentType === "video/mp4" ||
    contentType.startsWith("video/") ||
    contentType === "application/octet-stream";

  if (!allowedType) {
    response.resume();
    throw new Error(
      "This is not a supported direct video file. Please use a direct video link."
    );
  }

  const contentLength = Number(response.headers["content-length"] || 0);

  if (contentLength > MAX_FILE_SIZE) {
    response.resume();
    throw new Error("The video is larger than VIDORA's 100 MB limit.");
  }

  return { request, response };
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "VIDORA Backend is Running!"
  });
});

app.post("/api/file-download", async (req, res) => {
  const videoUrl = req.body && req.body.url;

  if (!videoUrl || typeof videoUrl !== "string") {
    return res.status(400).json({
      error: "Please provide a valid video URL."
    });
  }

  let videoResponse;

  try {
    videoResponse = await getVideoResponse(videoUrl);
  } catch (error) {
    return res.status(400).json({
      error: error.message || "Unable to access this video."
    });
  }

  const upstream = videoResponse.response;
  let totalBytes = 0;
  let finished = false;

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="VIDORA-video.mp4"'
  );
  res.setHeader("X-Content-Type-Options", "nosniff");

  upstream.on("data", chunk => {
    totalBytes += chunk.length;

    if (totalBytes > MAX_FILE_SIZE && !finished) {
      finished = true;
      upstream.destroy();
      res.destroy();
    }
  });

  upstream.on("error", () => {
    if (!res.headersSent) {
      res.status(502).json({
        error: "The video connection was interrupted."
      });
    } else {
      res.destroy();
    }
  });

  upstream.on("end", () => {
    finished = true;
  });

  upstream.pipe(res);
});

app.use(express.static(FRONTEND_DIR));

app.listen(PORT, () => {
  console.log(`VIDORA server running on port ${PORT}`);
});