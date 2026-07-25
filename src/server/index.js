const fs = require('fs');
const http = require('http');
const gracefulFS = require('graceful-fs');
gracefulFS.gracefulify(fs);

const RammerheadProxy = require('../classes/RammerheadProxy');
const addStaticDirToProxy = require('../util/addStaticDirToProxy');
const RammerheadSessionFileCache = require('../classes/RammerheadSessionFileCache');
const config = require('../config');
const setupRoutes = require('./setupRoutes');
const setupPipeline = require('./setupPipeline');
const RammerheadLogging = require('../classes/RammerheadLogging');

const PORT = Number(process.env.PORT) || Number(config.port) || 10000;
const HOST = '0.0.0.0';

const logger = new RammerheadLogging({
    logLevel: config.logLevel,
    generatePrefix: config.generatePrefix
});

console.log('[INIT] Server starting...');

process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
    logger.error('Unhandled Rejection:', reason);
});

let proxyServer;
let server;

try {
    console.log('[INIT] Creating RammerheadProxy...');
    
    proxyServer = new RammerheadProxy({
        logger,
        loggerGetIP: config.getIP,
        bindingAddress: HOST,
        port: PORT,
        crossDomainPort: null,
        dontListen: true, // Let our explicit http server handle port binding
        ssl: null,
        getServerInfo: (req) => {
            const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
            const [hostname] = hostHeader.split(':');
            return {
                hostname: hostname || 'localhost',
                port: PORT,
                crossDomainPort: PORT,
                protocol: req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}:` : 'http:'
            };
        },
        disableLocalStorageSync: config.disableLocalStorageSync,
        diskJsCachePath: config.diskJsCachePath,
        jsCacheSize: config.jsCacheSize
    });
    
    console.log('[INIT] RammerheadProxy created successfully');

    if (config.publicDir) {
        console.log('[INIT] Adding static directory:', config.publicDir);
        addStaticDirToProxy(proxyServer, config.publicDir);
    }

    console.log('[INIT] Creating session store...');
    const sessionStore = new RammerheadSessionFileCache({
        logger,
        ...config.fileCacheSessionConfig
    });
    sessionStore.attachToProxy(proxyServer);
    
    console.log('[INIT] Setting up pipeline...');
    setupPipeline(proxyServer, sessionStore);
    
    console.log('[INIT] Setting up routes...');
    setupRoutes(proxyServer, sessionStore, logger);
    
    console.log('[INIT] Initialization complete');

    // Create a native HTTP server to handle health checks and proxying
    server = http.createServer((req, res) => {
        // Direct response for Render's health scanner on base routes
        if (req.url === '/health' || req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end('OK');
        }

        // Delegate all standard requests to Rammerhead
        proxyServer._onRequest(req, res);
    });

    // Handle WebSocket / WebTransport upgrades
    server.on('upgrade', (req, socket, head) => {
        proxyServer._onUpgradeRequest(req, socket, head);
    });

    server.on('error', (error) => {
        console.error('[ERROR] Server error:', error);
        logger.error('Server error:', error);
    });

    // Bind server explicitly to port 10000
    server.listen(PORT, HOST, () => {
        logger.info(`(server) Rammerhead proxy listening explicitly on http://${HOST}:${PORT}`);
        console.log(`[READY] Server bound and listening on ${HOST}:${PORT}`);
    });

} catch (error) {
    console.error('[FATAL] Initialization failed:', error);
    logger.error('Initialization failed:', error);
    process.exit(1);
}

// Graceful shutdown handling
function shutdown(signal) {
    console.log(`[SHUTDOWN] Received ${signal}`);
    if (server) {
        server.close(() => {
            console.log('[SHUTDOWN] Server closed cleanly');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
