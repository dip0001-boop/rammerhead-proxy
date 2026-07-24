const fs = require('fs');
const gracefulFS = require('graceful-fs');
gracefulFS.gracefulify(fs);
const http = require('http');
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

console.log(`[DEBUG] Starting server with PORT=${PORT}, HOST=${HOST}`);

// Catch all uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('(server) Uncaught Exception:', error);
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('(server) Unhandled Rejection:', reason);
    console.error('Unhandled Rejection:', reason);
});

try {
    // Create HTTP server first, BEFORE proxy initialization
    const httpServer = http.createServer();
    
    console.log('[DEBUG] Created HTTP server, setting up listeners');
    
    const proxyServer = new RammerheadProxy({
        logger,
        loggerGetIP: config.getIP,
        bindingAddress: HOST,
        port: PORT,
        crossDomainPort: null,
        dontListen: true, // WE handle the listening
        ssl: null,
        getServerInfo: (req) => {
            const forwardedHost =
                req.headers['x-forwarded-host'] ||
                req.headers.host ||
                '';
            const hostname = forwardedHost.split(':')[0];
            return {
                hostname,
                port: 443,
                protocol: 'https:'
            };
        },
        disableLocalStorageSync: config.disableLocalStorageSync,
        diskJsCachePath: config.diskJsCachePath,
        jsCacheSize: config.jsCacheSize
    });

    if (config.publicDir) {
        addStaticDirToProxy(proxyServer, config.publicDir);
    }

    const fileCacheOptions = {
        logger,
        ...config.fileCacheSessionConfig
    };
    const sessionStore = new RammerheadSessionFileCache(fileCacheOptions);
    sessionStore.attachToProxy(proxyServer);
    setupPipeline(proxyServer, sessionStore);
    setupRoutes(proxyServer, sessionStore, logger);

    // Attach the proxy request handler to our HTTP server
    httpServer.on('request', (req, res) => {
        proxyServer._onRequest(req, res, {});
    });

    // Handle upgrade requests (WebSocket)
    httpServer.on('upgrade', (req, socket, head) => {
        proxyServer._onUpgradeRequest(req, socket, head, {});
    });

    // Add error handling
    httpServer.on('error', (error) => {
        logger.error('(server) HTTP server error:', error);
        console.error('HTTP server error:', error);
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use`);
            process.exit(1);
        }
    });

    httpServer.on('clientError', (error, socket) => {
        if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
            // Ignore these common client errors
            return;
        }
        logger.error('(server) HTTP client error:', error);
        console.error('HTTP client error:', error);
    });

    // Now listen
    console.log(`[DEBUG] Calling httpServer.listen(${PORT}, '${HOST}')`);
    httpServer.listen(PORT, HOST, () => {
        console.log('[DEBUG] HTTP Server listening callback fired');
        logger.info(
            `(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`
        );
    });

    // Handle SIGTERM from Render
    process.on('SIGTERM', () => {
        logger.info('(server) Received SIGTERM, closing proxy server');
        try {
            httpServer.close();
            proxyServer.close();
        } catch (error) {
            logger.error(error);
        }
        logger.info('(server) Closed proxy server');
        process.exit(0);
    });

    // Handle Ctrl+C / SIGINT
    process.on('SIGINT', () => {
        logger.info('(server) Received SIGINT, closing proxy server');
        try {
            httpServer.close();
            proxyServer.close();
        } catch (error) {
            logger.error(error);
        }
        logger.info('(server) Closed proxy server');
        process.exit(0);
    });

} catch (error) {
    logger.error('(server) Failed to initialize proxy:', error);
    console.error('Failed to initialize proxy:', error);
    console.error(error.stack);
    process.exit(1);
}
