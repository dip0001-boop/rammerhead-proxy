const http = require('http');
const path = require('path');

// Import Rammerhead modules
const {
    RammerheadProxy,
    RammerheadSession,
    RammerheadSessionMemoryStore,
    addStaticFilesToProxy
} = require('./server/index.js');

const port = process.env.PORT || 8081;

try {
    console.log('Starting Rammerhead proxy server...');
    
    // Create session store (in-memory)
    const sessionStore = new RammerheadSessionMemoryStore();
    console.log('Session store created');

    // Create Rammerhead session
    const session = new RammerheadSession({
        store: sessionStore,
    });
    console.log('Session created');

    // Create proxy
    const proxy = new RammerheadProxy({
        session: session,
    });
    console.log('Proxy created');

    // Try to add static files from public directory
    try {
        const publicPath = path.join(__dirname, '..', 'public');
        addStaticFilesToProxy(publicPath, proxy);
        console.log('Static files added from public directory');
    } catch (e) {
        console.log('No public directory or static files - continuing without them');
    }

    // Create HTTP server
    const server = http.createServer((req, res) => {
        try {
            proxy.request(req, res);
        } catch (err) {
            console.error('Error handling request:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    });

    // Handle upgrade for WebSocket
    server.on('upgrade', (req, socket, head) => {
        try {
            proxy.upgrade(req, socket, head);
        } catch (err) {
            console.error('Error handling upgrade:', err);
            socket.destroy();
        }
    });

    // Handle server errors
    server.on('error', (err) => {
        console.error('Server error:', err);
    });

    // Start server and listen
    server.listen(port, '0.0.0.0', () => {
        console.log(`✓ Rammerhead proxy server listening on port ${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully...');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('SIGINT received, shutting down gracefully...');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });

} catch (err) {
    console.error('Fatal error during startup:', err);
    process.exit(1);
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
