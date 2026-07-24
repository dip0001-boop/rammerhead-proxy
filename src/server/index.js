const fs = require('fs');
const gracefulFS = require('graceful-fs');
gracefulFS.gracefulify(fs);

// This is the key - we need to let hammerhead create and manage its own server
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

// Global error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    console.error('Unhandled Rejection:', reason);
});

let proxyServer;
let listeningServer;

try {
    // Create proxy WITHOUT managing listen ourselves
    // This lets hammerhead's Proxy class handle server creation internally
    proxyServer = new RammerheadProxy({
        logger,
        loggerGetIP: config.getIP,
        bindingAddress: HOST,
        port: PORT,
        crossDomainPort: null,
        dontListen: false, // Let hammerhead manage the server
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

    // Access the server that hammerhead created
    // The Proxy class stores servers as server1 and server2
    listeningServer = proxyServer.server1 || proxyServer.server;

    if (listeningServer) {
        // Add error handlers to the existing server
        listeningServer.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${PORT} is already in use`);
                process.exit(1);
            } else {
                logger.error('Server error:', error);
            }
        });

        listeningServer.on('listening', () => {
            logger.info(`(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`);
        });

        // If server is already listening, log immediately
        if (listeningServer.listening) {
            logger.info(`(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`);
        }
    } else {
        // Fallback - just log that we're ready
        logger.info(`(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`);
    }

} catch (error) {
    logger.error('Failed to initialize proxy:', error);
    console.error('Failed to initialize proxy:', error);
    console.error(error.stack);
    process.exit(1);
}

// Graceful shutdown
function shutdown() {
    logger.info('Shutting down gracefully...');
    
    if (proxyServer) {
        try {
            proxyServer.close();
        } catch (error) {
            logger.error('Error closing proxy:', error);
        }
    }
    
    if (listeningServer) {
        try {
            listeningServer.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        } catch (error) {
            logger.error('Error closing listening server:', error);
            process.exit(0);
        }
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
