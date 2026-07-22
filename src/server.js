#!/usr/bin/env node

/**
 * BULLETPROOF RAMMERHEAD SERVER
 * This version catches EVERY possible error and logs it clearly
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const port = process.env.PORT || 8081;

// Write to stdout with timestamps
function log(level, msg) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${msg}`);
}

// Catch ALL errors, even ones we don't expect
process.on('uncaughtException', (err) => {
    log('FATAL', `UNCAUGHT EXCEPTION: ${err.message}`);
    log('FATAL', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log('FATAL', `UNHANDLED REJECTION: ${reason}`);
    if (reason && reason.stack) log('FATAL', reason.stack);
    process.exit(1);
});

log('INFO', '=== RAMMERHEAD SERVER STARTING ===');
log('INFO', `Node: ${process.version}`);
log('INFO', `Port: ${port}`);
log('INFO', `CWD: ${process.cwd()}`);

// Step 1: Verify files exist
log('INFO', '[1/6] Verifying file structure...');
const requiredFiles = [
    './server/classes/RammerheadProxy.js',
    './server/classes/RammerheadSession.js',
    './server/classes/RammerheadMemoryStore.js',
    './server/util/addStaticDirToProxy.js'
];

for (const file of requiredFiles) {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) {
        log('ERROR', `MISSING FILE: ${fullPath}`);
        process.exit(1);
    }
    log('INFO', `✓ Found ${file}`);
}

// Step 2: Load modules
log('INFO', '[2/6] Loading modules...');
let RammerheadProxy, RammerheadSession, RammerheadSessionMemoryStore, addStaticFilesToProxy;

try {
    RammerheadProxy = require('./server/classes/RammerheadProxy');
    log('INFO', '✓ RammerheadProxy loaded');
} catch (err) {
    log('ERROR', `Failed to load RammerheadProxy: ${err.message}`);
    log('ERROR', err.stack);
    process.exit(1);
}

try {
    RammerheadSession = require('./server/classes/RammerheadSession');
    log('INFO', '✓ RammerheadSession loaded');
} catch (err) {
    log('ERROR', `Failed to load RammerheadSession: ${err.message}`);
    log('ERROR', err.stack);
    process.exit(1);
}

try {
    RammerheadSessionMemoryStore = require('./server/classes/RammerheadMemoryStore');
    log('INFO', '✓ RammerheadSessionMemoryStore loaded');
} catch (err) {
    log('ERROR', `Failed to load RammerheadSessionMemoryStore: ${err.message}`);
    log('ERROR', err.stack);
    process.exit(1);
}

try {
    addStaticFilesToProxy = require('./server/util/addStaticDirToProxy');
    log('INFO', '✓ addStaticFilesToProxy loaded');
} catch (err) {
    log('ERROR', `Failed to load addStaticFilesToProxy: ${err.message}`);
    log('ERROR', err.stack);
    process.exit(1);
}

// Step 3: Create session store
log('INFO', '[3/6] Creating session store...');
let sessionStore;
try {
    sessionStore = new RammerheadSessionMemoryStore();
    log('INFO', '✓ Session store created');
} catch (err) {
    log('ERROR', `Failed to create session store: ${err.message}`);
    log('ERROR', err.stack);
    process.exit(1);
}

// Step 4: Create session
log('INFO', '[4/6] Creating session...');
let session;
try {
    session = new RammerheadSession({
        store: sessionStore,
    });
    log('INFO', '✓ Session created');
} catch (err) {
    log('ERROR', `Failed to create session: ${err.message}`);
    log('ERROR', err.stack);
    process.exit(1);
}

// Step 5: Create proxy
log('INFO', '[5/6] Creating proxy...');
let proxy;
try {
    proxy = new RammerheadProxy({
        session: session,
        dontListen: true,
        port: port,
        bindingAddress: '0.0.0.0',
        crossDomainPort: null,
    });
    log('INFO', '✓ Proxy created');
} catch (err) {
    log('ERROR', `Failed to create proxy: ${err.message}`);
    log('ERROR', err.stack);
    process.exit(1);
}

// Try to add static files (optional)
try {
    const publicPath = path.join(__dirname, '..', 'public');
    if (fs.existsSync(publicPath)) {
        addStaticFilesToProxy(publicPath, proxy);
        log('INFO', `✓ Static files added from ${publicPath}`);
    } else {
        log('INFO', 'ℹ No public directory (this is fine)');
    }
} catch (err) {
    log('WARN', `Static files error (non-fatal): ${err.message}`);
}

// Step 6: Create HTTP server
log('INFO', '[6/6] Creating HTTP server...');

const server = http.createServer((req, res) => {
    try {
        proxy.request(req, res);
    } catch (err) {
        log('ERROR', `Request error: ${err.message}`);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
});

server.on('upgrade', (req, socket, head) => {
    try {
        proxy.upgrade(req, socket, head);
    } catch (err) {
        log('ERROR', `Upgrade error: ${err.message}`);
        if (socket.writable) socket.destroy();
    }
});

server.on('error', (err) => {
    log('ERROR', `Server error: ${err.message}`);
    log('ERROR', err.stack);
});

server.on('clientError', (err, socket) => {
    log('WARN', `Client error: ${err.message}`);
    if (socket.writable) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
});

// START LISTENING
try {
    server.listen(port, '0.0.0.0', () => {
        log('INFO', '');
        log('SUCCESS', '╔══════════════════════════════════════╗');
        log('SUCCESS', '║  ✓ RAMMERHEAD SERVER READY!         ║');
        log('SUCCESS', `║  Listening on 0.0.0.0:${String(port).padEnd(23)}║`);
        log('SUCCESS', '╚══════════════════════════════════════╝');
        log('INFO', '');
    });
} catch (err) {
    log('FATAL', `Failed to start server: ${err.message}`);
    log('FATAL', err.stack);
    process.exit(1);
}

// Graceful shutdown
const shutdown = (signal) => {
    log('INFO', `${signal} received - shutting down gracefully...`);
    server.close(() => {
        log('INFO', 'Server closed');
        process.exit(0);
    });
    
    setTimeout(() => {
        log('ERROR', 'Shutdown timeout - forcing exit');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

log('INFO', 'Server initialization complete. Waiting for requests...');
