#!/usr/bin/env node

const http = require('http');
const path = require('path');

const port = process.env.PORT || 8081;

console.log('=== Rammerhead Server Starting ===');
console.log('Node version:', process.version);
console.log('Port:', port);

try {
    console.log('[1/5] Loading Rammerhead modules...');
    
    // Load the classes and utilities (but don't instantiate them yet)
    const RammerheadProxy = require('./server/classes/RammerheadProxy');
    const RammerheadSession = require('./server/classes/RammerheadSession');
    const RammerheadSessionMemoryStore = require('./server/classes/RammerheadMemoryStore');
    const addStaticFilesToProxy = require('./server/util/addStaticDirToProxy');
    
    console.log('[1/5] ✓ Modules loaded');

    console.log('[2/5] Creating session store...');
    const sessionStore = new RammerheadSessionMemoryStore();
    console.log('[2/5] ✓ Session store created');

    console.log('[3/5] Creating Rammerhead session...');
    const session = new RammerheadSession({
        store: sessionStore,
    });
    console.log('[3/5] ✓ Session created');

    console.log('[4/5] Creating proxy...');
    const proxy = new RammerheadProxy({
        session: session,
        dontListen: true,
        port: port,
        bindingAddress: '0.0.0.0',
        crossDomainPort: null,
    });
    console.log('[4/5] ✓ Proxy created');

    // Try to add static files
    try {
        const publicPath = path.join(__dirname, '..', 'public');
        addStaticFilesToProxy(publicPath, proxy);
        console.log('[4/5] ✓ Static files added');
    } catch (e) {
        console.log('[4/5] ℹ No public directory found (this is OK)');
    }

    console.log('[5/5] Creating HTTP server...');
    
    // Create HTTP server that delegates to the proxy
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
            if (socket.writable) {
                socket.destroy();
            }
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

    console.log('[5/5] ✓ HTTP server created');

    // Start listening
    server.listen(port, '0.0.0.0', () => {
        console.log('');
        console.log('╔════════════════════════════════════════╗');
        console.log('║  ✓ Rammerhead Server Ready!           ║');
        console.log('║  Listening on 0.0.0.0:' + String(port).padEnd(24) + '║');
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
    console.error('\n!!! FATAL ERROR !!!');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
}
