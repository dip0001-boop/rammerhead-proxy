'use strict';

const path = require('path');
const http = require('http');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

const PORT = process.env.PORT || 8000;

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

try {
    const sessionStore = new RammerheadSessionMemoryStore();

    const proxy = new RammerheadProxy({
        sessionStore
    });

    // Register all files inside public/
    addStaticFilesToProxy(
        proxy,
        path.join(__dirname, '../public')
    );

    // Create the HTTP server
    const server = http.createServer((req, res) => {
        if (req.url === '/healthz' || req.url === '/ping') {
            res.writeHead(200, {
                'Content-Type': 'text/plain'
            });

            return res.end('OK');
        }

        res.writeHead(404, {
            'Content-Type': 'text/plain'
        });

        res.end('Not Found');
    });

    // Let Rammerhead attach and handle its registered routes
    proxy.attach(server);

    server.on('upgrade', (req, socket, head) => {
        if (typeof proxy.onUpgrade === 'function') {
            proxy.onUpgrade(req, socket, head);
        } else if (typeof proxy.handleUpgrade === 'function') {
            proxy.handleUpgrade(req, socket, head);
        } else {
            socket.destroy();
        }
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Rammerhead proxy listening on 0.0.0.0:${PORT}`);
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
