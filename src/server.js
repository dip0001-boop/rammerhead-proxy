const http = require('http');
const {
    RammerheadProxy,
    RammerheadSession,
    RammerheadSessionMemoryStore,
    addStaticFilesToProxy
} = require('./server/index.js');

const port = process.env.PORT || 8081;

// Create session store
const sessionStore = new RammerheadSessionMemoryStore();

// Create Rammerhead session
const session = new RammerheadSession({
    store: sessionStore,
});

// Create proxy
const proxy = new RammerheadProxy({
    session: session,
});

// Add static files (if you have a public directory)
try {
    addStaticFilesToProxy('./public', proxy);
} catch (e) {
    console.log('No public directory found, skipping static files');
}

// Create HTTP server
const server = http.createServer((req, res) => {
    proxy.request(req, res);
});

// Handle upgrade for WebSocket
server.on('upgrade', (req, socket, head) => {
    proxy.upgrade(req, socket, head);
});

// Start server
server.listen(port, '0.0.0.0', () => {
    console.log(`Rammerhead proxy server listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Error handling
server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
});
