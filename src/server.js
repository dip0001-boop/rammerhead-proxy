'use strict';

const path = require('path');
const http = require('http');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadLogging = require('./classes/RammerheadLogging');
const RammerheadSession = require('./classes/RammerheadSession');
const RammerheadSessionAbstractStore = require('./classes/RammerheadSessionAbstractStore');
const RammerheadSessionFileCache = require('./classes/RammerheadSessionFileCache');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');

const generateId = require('./util/generateId');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');
const StrShuffler = require('./util/StrShuffler');
const URLPath = require('./util/URLPath');

// Use host-assigned PORT or default to 8000
const PORT = process.env.PORT || 8000;

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

try {
    // Create the session store
    const sessionStore = new RammerheadSessionMemoryStore();

    // Create the proxy instance
    const proxy = new RammerheadProxy({
        sessionStore
    });

    // Create HTTP server
    const server = http.createServer((req, res) => {
        // 1. Health check endpoint for host platforms (returns 200 OK)
        if (req.url === '/healthz' || req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end('OK');
        }

        // 2. Delegate incoming requests to Rammerhead proxy handler
        if (proxy.onRequest(req, res)) {
            return;
        }

        // 3. Fallback response (200 OK so root health checks pass)
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Rammerhead Proxy Online');
    });

    // Attach WebSocket and HTTP upgrade listeners to the server
    proxy.attach(server);

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Rammerhead proxy listening on 0.0.0.0:${PORT}`);
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down...');
        server.close(() => {
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down...');
        server.close(() => {
            process.exit(0);
        });
    });

} catch (error) {
    console.error('Fatal error during startup:');
    console.error(error);
    process.exit(1);
}
