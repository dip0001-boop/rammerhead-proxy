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

// Catch all uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('(server) Uncaught Exception:', error);
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('(server) Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
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

    logger.info(
        `(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`
    );

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

    // Add error listener to proxy server
    if (proxyServer.server) {
        proxyServer.server.on('error', (error) => {
            logger.error('(server) Proxy server error:', error);
            console.error('Proxy server error:', error);
        });
    }
    if (proxyServer.server1) {
        proxyServer.server1.on('error', (error) => {
            logger.error('(server) Proxy server1 error:', error);
            console.error('Proxy server1 error:', error);
        });
    }

} catch (error) {
    logger.error('(server) Failed to initialize proxy:', error);
    console.error('Failed to initialize proxy:', error);
    process.exit(1);
}
