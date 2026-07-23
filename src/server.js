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

// Standard port setup (Back4App passes process.env.PORT)
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

    // Mount static web interface files (HTML, CSS, client-side JS)
    addStaticFilesToProxy(proxy, path.join(__dirname, '../public'));

    // Log available methods on proxy for debugging
    const proxyMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(proxy));
    console.log('Loaded RammerheadProxy methods:', proxyMethods);

    // Create HTTP server
    const server = http.createServer((req, res) => {
        // 1. Host health check endpoints (returns 200 OK)
        if (req.url === '/healthz' || req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end('OK');
        }

        // 2. Safe request dispatching
        let handled = false;
        if (typeof proxy.onRequest === 'function') {
            handled = proxy.onRequest(req, res);
        } else if (typeof proxy.handleRequest === 'function') {
            handled = proxy.handleRequest(req, res);
        }

        if (handled) return;

        // 3. Fallback response if proxy/static files don't handle request
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Rammerhead Proxy Online');
    });

    // Handle WebSocket upgrade requests safely
    server.on('upgrade', (req, socket, head) => {
        if (typeof proxy.onUpgrade === 'function') {
            proxy.onUpgrade(req, socket, head);
        } else if (typeof proxy.handleUpgrade === 'function') {
            proxy.handleUpgrade(req, socket, head);
        } else {
            socket.destroy();
        }
    });

    // Attach server if method exists
    if (typeof proxy.attach === 'function') {
        proxy.attach(server);
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Rammerhead proxy listening on 0.0.0.0:${PORT}`);
    });

    // Shutdown handling
    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down...');
        server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down...');
        server.close(() => process.exit(0));
    });

} catch (error) {
    console.error('Fatal error during startup:');
    console.error(error);
    process.exit(1);
}
