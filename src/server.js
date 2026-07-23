'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

// Render provides the port through process.env.PORT
const PORT = process.env.PORT || 8000;

// Frontend directory
const PUBLIC_DIR = path.join(__dirname, '../public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

try {
    // Create the session store
    const sessionStore = new RammerheadSessionMemoryStore();

    // Create the Rammerhead proxy
    const proxy = new RammerheadProxy({
        sessionStore
    });

    // Add your public frontend files to Rammerhead
    addStaticFilesToProxy(proxy, PUBLIC_DIR);

    console.log('Frontend directory:', PUBLIC_DIR);

    // Create HTTP server
    const server = http.createServer((req, res) => {
        // Health checks for Render
        if (req.url === '/healthz' || req.url === '/ping') {
            res.writeHead(200, {
                'Content-Type': 'text/plain'
            });

            return res.end('OK');
        }

        // Serve THE VAULT homepage
        if (req.url === '/' || req.url === '/index.html') {
            if (fs.existsSync(INDEX_FILE)) {
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8'
                });

                return res.end(fs.readFileSync(INDEX_FILE));
            }

            res.writeHead(404, {
                'Content-Type': 'text/plain'
            });

            return res.end('Frontend index.html not found');
        }

        // Let Rammerhead handle proxy and static file requests
        if (typeof proxy.onRequest === 'function') {
            const handled = proxy.onRequest(req, res);

            if (handled) {
                return;
            }
        } else if (typeof proxy.handleRequest === 'function') {
            const handled = proxy.handleRequest(req, res);

            if (handled) {
                return;
            }
        }

        // Fallback
        res.writeHead(404, {
            'Content-Type': 'text/plain'
        });

        res.end('Not Found');
    });

    // Handle WebSocket connections
    server.on('upgrade', (req, socket, head) => {
        if (typeof proxy.onUpgrade === 'function') {
            proxy.onUpgrade(req, socket, head);
        } else if (typeof proxy.handleUpgrade === 'function') {
            proxy.handleUpgrade(req, socket, head);
        } else {
            socket.destroy();
        }
    });

    // Attach proxy if supported
    if (typeof proxy.attach === 'function') {
        proxy.attach(server);
    }

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Rammerhead proxy listening on 0.0.0.0:${PORT}`);
        console.log(`THE VAULT frontend available at /`);
    });

    // Graceful shutdown
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
