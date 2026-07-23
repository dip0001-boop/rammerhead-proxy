'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

const PORT = process.env.PORT || 8000;
const PUBLIC_DIR = path.join(__dirname, '../public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

try {
    const sessionStore = new RammerheadSessionMemoryStore();

    const proxy = new RammerheadProxy({
        sessionStore
    });

    // Make all files inside /public available
    addStaticFilesToProxy(proxy, PUBLIC_DIR);

    const server = http.createServer((req, res) => {

        // Render health checks
        if (req.url === '/healthz' || req.url === '/ping') {
            res.writeHead(200, {
                'Content-Type': 'text/plain'
            });

            return res.end('OK');
        }

        // Serve the THE VAULT homepage
        if (req.url === '/' || req.url === '/index.html') {
            if (!fs.existsSync(INDEX_FILE)) {
                res.writeHead(404, {
                    'Content-Type': 'text/plain'
                });

                return res.end('index.html not found in public folder');
            }

            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8'
            });

            return res.end(fs.readFileSync(INDEX_FILE));
        }

        // Let Rammerhead serve CSS, JavaScript, images, etc.
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

        res.writeHead(404, {
            'Content-Type': 'text/plain'
        });

        res.end('Not Found');
    });

    // WebSocket support for Rammerhead
    server.on('upgrade', (req, socket, head) => {
        if (typeof proxy.onUpgrade === 'function') {
            proxy.onUpgrade(req, socket, head);
        } else if (typeof proxy.handleUpgrade === 'function') {
            proxy.handleUpgrade(req, socket, head);
        } else {
            socket.destroy();
        }
    });

    if (typeof proxy.attach === 'function') {
        proxy.attach(server);
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Rammerhead proxy listening on port ${PORT}`);
        console.log('THE VAULT frontend is active');
    });

    process.on('SIGTERM', () => {
        server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
        server.close(() => process.exit(0));
    });

} catch (error) {
    console.error('Fatal error during startup:');
    console.error(error);
    process.exit(1);
}
