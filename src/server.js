const http = require("http");

console.log("[BOOT] Loading server...");

// Load the Rammerhead initialization
require("./server/index.js");

// Temporary HTTP server for Render health detection
const PORT = Number(process.env.PORT) || 10000;

const healthServer = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/ping") {
        res.writeHead(200, {
            "Content-Type": "text/plain"
        });
        res.end("OK");
        return;
    }

    res.writeHead(200, {
        "Content-Type": "text/plain"
    });
    res.end("Rammerhead booted");
});

healthServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[BOOT] Health server listening on 0.0.0.0:${PORT}`);
});
