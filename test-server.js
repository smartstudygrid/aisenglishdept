// SmartCric local test server
// Run:  node test-server.js
// Then open the printed URLs (PC + phone on the same Wi-Fi) to test the app
// before uploading to GitHub. Press Ctrl+C to stop.
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = __dirname;
const PORT = process.env.PORT || 8903;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg"
};
http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  if (u === "/") u = "/index.html";
  const f = path.normalize(path.join(ROOT, u));
  if (!f.startsWith(ROOT)) { res.writeHead(403); res.end("403"); return; }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("404 Not Found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(b);
  });
}).listen(PORT, "0.0.0.0", () => {
  const ips = [];
  const ifs = os.networkInterfaces();
  for (const k of Object.keys(ifs)) for (const i of ifs[k] || []) if (i.family === "IPv4" && !i.internal) ips.push(i.address);
  console.log("SmartCric test server running (" + ROOT + ")");
  console.log("  PC:    http://127.0.0.1:" + PORT + "/");
  for (const ip of ips) console.log("  Phone: http://" + ip + ":" + PORT + "/   (same Wi-Fi)");
  console.log("Press Ctrl+C to stop.");
});
