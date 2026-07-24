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
    // Don't exit immediately - log it but keep running
});

try {
    const proxyServer = new RammerheadProxy({
        logger,
        loggerGetIP: config.getIP,
        bindingAddress: HOST,
        port: PORT,
        crossDomainPort: null,
        // Let Rammerhead create and listen to its own HTTP server.
        dontListen: false,
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

    // The Proxy parent class should have created an HTTP server
    // Access it via the inherited properties from testcafe-hammerhead Proxy
    let httpServer = proxyServer._server1 || proxyServer._server || proxyServer.server1 || proxyServer.server;
    
    console.log(`[DEBUG] proxyServer properties:`, Object.keys(proxyServer).filter(k => k.includes('server') || k.includes('Server')));
    
    if (httpServer) {
        console.log('[DEBUG] Found HTTP server');
        httpServer.on('error', (error) => {
            logger.error('(server) HTTP server error:', error);
            console.error('HTTP server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use`);
            }
        });
    } else {
        console.log('[DEBUG] Warning: Could not find HTTP server on proxy object');
    }

    // Log that server is ready - Render will detect the open port shortly
    logger.info(
        `(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`
    );
    console.log('[DEBUG] Server initialization complete');

    // Handle SIGTERM from Render
    process.on('SIGTERM', () => {
        logger.info('(server) Received SIGTERM, closing proxy server');
        try {
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
