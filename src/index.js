#!/usr/bin/env node

const http = require('http');
const path = require('path');

// Import all Rammerhead modules
const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadLogging = require('./classes/RammerheadLogging');
const RammerheadSession = require('./classes/RammerheadSession');
const RammerheadSessionAbstractStore = require('./classes/RammerheadSessionAbstractStore');
const RammerheadSessionFileCache = require('./classes/RammerheadSessionFileCache');
const generateId = require('./util/generateId');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const StrShuffler = require('./util/StrShuffler');
const URLPath = require('./util/URLPath');

// Export modules for external use
module.exports = {
    RammerheadProxy,
    RammerheadLogging,
    RammerheadSession,
    RammerheadSessionAbstractStore,
    RammerheadSessionMemoryStore,
    RammerheadSessionFileCache,
    StrShuffler,
    generateId,
    addStaticFilesToProxy,
    URLPath
};

// Only start server if this file is run directly
if (require.main === module) {
    const port = process.env.PORT || 8081;

    console.log('=== Rammerhead Server Starting ===');
    console.log('Node version:', process.version);
    console.log('Working directory:', process.cwd());

    try {
        console.log('[1/4] Modules loaded successfully');

        console.log('[2/4] Creating session store...');
        const sessionStore = new RammerheadSessionMemoryStore();
        console.log('[2/4] ✓ Session store created');

        console.log('[3/4] Creating Rammerhead session...');
        const session = new RammerheadSession({
            store: sessionStore,
        });
        console.log('[3/4] ✓ Session created');

        console.log('[4/4] Creating proxy...');
        const proxy = new RammerheadProxy({
            session: session,
        });
        console.log('[4/4] ✓ Proxy created');

        // Try to add static files
        try {
            const publicPath = path.join(__dirname, '..', '..', 'public');
            addStaticFilesToProxy(publicPath, proxy);
            console.log('✓ Static files added from:', publicPath);
        } catch (staticErr) {
            console.log('ℹ No public directory found (this is OK)');
        }

        // Create HTTP server
        const server = http.createServer((req, res) => {
            try {
                proxy.request(req, res);
            } catch (err) {
                console.error('Request error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                }
            }
        });

        // Handle WebSocket upgrades
        server.on('upgrade', (req, socket, head) => {
            try {
                proxy.upgrade(req, socket, head);
            } catch (err) {
                console.error('Upgrade error:', err.message);
                socket.destroy();
            }
        });

        server.on('error', (err) => {
            console.error('Server error:', err);
        });

        server.on('clientError', (err, socket) => {
            console.error('Client error:', err.message);
            if (socket.writable) {
                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            }
        });

        // Start listening
        server.listen(port, '0.0.0.0', () => {
            console.log('');
            console.log('╔════════════════════════════════════════╗');
            console.log('║  ✓ Rammerhead Server Ready!           ║');
            console.log('║  Listening on 0.0.0.0:' + port + '           ║');
            console.log('╚════════════════════════════════════════╝');
            console.log('');
        });

        // Graceful shutdown
        const shutdown = (signal) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
            
            setTimeout(() => {
                console.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        process.on('uncaughtException', (err) => {
            console.error('\n!!! UNCAUGHT EXCEPTION !!!');
            console.error(err);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('\n!!! UNHANDLED REJECTION !!!');
            console.error('Reason:', reason);
            process.exit(1);
        });

    } catch (err) {
        console.error('\n!!! FATAL ERROR DURING STARTUP !!!');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}
