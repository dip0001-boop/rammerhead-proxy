const fs = require('fs');
const http = require('http');
const gracefulFS = require('graceful-fs');

gracefulFS.gracefulify(fs);

const RammerheadProxy = require('./src/classes/RammerheadProxy');
const addStaticDirToProxy = require('./src/util/addStaticDirToProxy');
const RammerheadSessionFileCache = require('./src/classes/RammerheadSessionFileCache');
const config = require('./src/config');
const setupRoutes = require('./src/server/setupRoutes');
const setupPipeline = require('./src/server/setupPipeline');
const RammerheadLogging = require('./src/classes/RammerheadLogging');

const PORT = Number(process.env.PORT) || Number(config.port) || 10000;
const HOST = '0.0.0.0';

const logger = new RammerheadLogging({
    logLevel: config.logLevel,
    generatePrefix: config.generatePrefix
});

console.log('[INIT] Server starting...');
console.log(`[INIT] PORT: ${PORT}, HOST: ${HOST}`);

process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
    logger.error('Unhandled Rejection:', reason);
});

// Create a temporary health check server to respond immediately to Render health checks
const healthCheckServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
});

let proxyServer;
let isListening = false;

healthCheckServer.listen(PORT, HOST, () => {
    console.log(`[HEALTH] Health check server listening on ${HOST}:${PORT}`);
    isListening = true;
});

healthCheckServer.on('error', (err) => {
    console.error('[ERROR] Health check server error:', err);
});

setTimeout(() => {
    try {
        console.log('[INIT] Creating RammerheadProxy...');

        proxyServer = new RammerheadProxy({
            logger,
            loggerGetIP: config.getIP,
            bindingAddress: HOST,
            port: PORT,
            crossDomainPort: null,
            dontListen: false,
            ssl: null,
            getServerInfo: config.getServerInfo,
            disableLocalStorageSync: config.disableLocalStorageSync,
            diskJsCachePath: config.diskJsCachePath,
            jsCacheSize: config.jsCacheSize
        });

        console.log('[INIT] RammerheadProxy created successfully');

        // Health check endpoints
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

        // Close the temporary health check server once proxy is ready
        healthCheckServer.close(() => {
            console.log('[INIT] Closed temporary health check server');
        });

        console.log('[INIT] Initialization complete');
        
        setTimeout(() => {
            console.log(`[READY] Server running on ${HOST}:${PORT}`);
        }, 1000);

    } catch (error) {
        console.error('[FATAL] Initialization failed:', error);
        logger.error('Initialization failed:', error);
        process.exit(1);
    }
}, 100);

// Graceful shutdown handling
function shutdown(signal) {
    console.log(`[SHUTDOWN] Received ${signal}`);
    if (proxyServer) {
        try {
            proxyServer.close();
        } catch (e) {
            console.error('[ERROR] Error closing proxy:', e);
        }
    }
    if (healthCheckServer) {
        try {
            healthCheckServer.close();
        } catch (e) {
            console.error('[ERROR] Error closing health check server:', e);
        }
    }
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep the process alive
setInterval(() => {}, 1000);
