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
// Hidden port to allow Hammerhead to initialize natively without conflicts
const INTERNAL_PORT = PORT + 1; 

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
let publicServer;

try {
    console.log('[INIT] Creating RammerheadProxy...');

    // 1. Let Rammerhead start natively on a hidden port so it initializes its internal state perfectly
    proxyServer = new RammerheadProxy({
        logger,
        loggerGetIP: config.getIP,
        bindingAddress: '127.0.0.1', 
        port: INTERNAL_PORT,         
        crossDomainPort: INTERNAL_PORT + 1,
        dontListen: false,           // CRITICAL: Must be false to prevent nativeAutomation crash
        ssl: null,
        getServerInfo: (req) => {
            const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
            const hostname = hostHeader.split(':')[0];
            const isHttps = req.headers['x-forwarded-proto'] === 'https' || process.env.RENDER;
            
            return {
                hostname: hostname || 'localhost',
                port: PORT, // Tell Rammerhead to route traffic using the public Render port
                crossDomainPort: PORT,
                protocol: isHttps ? 'https:' : 'http:'
            };
        },
        disableLocalStorageSync: config.disableLocalStorageSync,
        diskJsCachePath: config.diskJsCachePath,
        jsCacheSize: config.jsCacheSize
    });

    console.log('[INIT] RammerheadProxy initialized on internal port');

    if (config.publicDir) {
        addStaticDirToProxy(proxyServer, config.publicDir);
    }

    const sessionStore = new RammerheadSessionFileCache({
        logger,
        ...config.fileCacheSessionConfig
    });
    sessionStore.attachToProxy(proxyServer);

    setupPipeline(proxyServer, sessionStore);
    setupRoutes(proxyServer, sessionStore, logger);

    // 2. Create the explicit public HTTP server that Render requires for health checks
    publicServer = http.createServer((req, res) => {
        // Intercept Render's health probes
        if (req.url === '/health' || req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end('OK');
        }
        
        // Forward all other traffic to Rammerhead
        proxyServer._onRequest(req, res);
    });

    // Forward WebSocket connections
    publicServer.on('upgrade', (req, socket, head) => {
        proxyServer._onUpgradeRequest(req, socket, head);
    });

    // Bind strictly to the public port for Render
    publicServer.listen(PORT, HOST, () => {
        console.log(`[READY] Render public server fully live and bound to ${HOST}:${PORT}`);
    });

} catch (error) {
    console.error('[FATAL] Initialization failed:', error);
    logger.error('Initialization failed:', error);
    process.exit(1);
}

// Graceful shutdown
function shutdown(signal) {
    console.log(`[SHUTDOWN] Received ${signal}`);
    if (publicServer) {
        publicServer.close(() => {
            if (proxyServer) {
                try { proxyServer.close(); } catch(e) {}
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
