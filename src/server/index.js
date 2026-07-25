const fs = require('fs');
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

try {
    console.log('[INIT] Creating RammerheadProxy...');

    // Allow Rammerhead to bind directly to the public interface/port natively.
    // This guarantees .open() runs fully, preventing the 'nativeAutomation' null error.
    proxyServer = new RammerheadProxy({
        logger,
        loggerGetIP: config.getIP,
        bindingAddress: HOST,
        port: PORT,
        crossDomainPort: null,
        dontListen: false, // Must be false to initialize internal proxy options
        ssl: null,
        getServerInfo: (req) => {
            const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
            const hostname = hostHeader.split(':')[0];
            const isHttps = req.headers['x-forwarded-proto'] === 'https' || process.env.RENDER;
            
            return {
                hostname: hostname || 'localhost',
                port: PORT,
                crossDomainPort: PORT,
                protocol: isHttps ? 'https:' : 'http:'
            };
        },
        disableLocalStorageSync: config.disableLocalStorageSync,
        diskJsCachePath: config.diskJsCachePath,
        jsCacheSize: config.jsCacheSize
    });

    console.log('[INIT] RammerheadProxy created successfully');

    // Built-in health check routes for Render
    proxyServer.GET('/health', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    });

    proxyServer.GET('/ping', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    });

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
    console.log(`[READY] Server ready and listening on ${HOST}:${PORT}`);

} catch (error) {
    console.error('[FATAL] Initialization failed:', error);
    logger.error('Initialization failed:', error);
    process.exit(1);
}

// Graceful shutdown handling
function shutdown(signal) {
    console.log(`[SHUTDOWN] Received ${signal}`);
    if (proxyServer) {
        try {
            proxyServer.close();
        } catch (e) {}
    }
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
