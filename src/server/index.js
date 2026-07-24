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

    // Try to get the actual HTTP server and listen properly
    let httpServer = null;
    
    if (proxyServer.server1) {
        httpServer = proxyServer.server1;
        console.log('[DEBUG] Found proxyServer.server1');
    } else if (proxyServer.server) {
        httpServer = proxyServer.server;
        console.log('[DEBUG] Found proxyServer.server');
    } else {
        console.log('[DEBUG] No server found on proxyServer, creating manual HTTP server');
        // Fallback: create a simple HTTP server that delegates to proxy
        httpServer = http.createServer((req, res) => {
            proxyServer._onRequest(req, res, {});
        });
    }

    // Ensure the server is listening
    if (httpServer && !httpServer.listening) {
        console.log(`[DEBUG] Calling listen on port ${PORT} with host ${HOST}`);
        httpServer.listen(PORT, HOST, () => {
            console.log(`[DEBUG] HTTP Server listening callback fired`);
            logger.info(
                `(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`
            );
        });
    } else if (httpServer && httpServer.listening) {
        console.log('[DEBUG] Server already listening');
        logger.info(
            `(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`
        );
    } else {
        console.log('[DEBUG] Could not find or create HTTP server');
        logger.info(
            `(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`
        );
    }

    // Add error listeners
    if (httpServer) {
        httpServer.on('error', (error) => {
            logger.error('(server) HTTP server error:', error);
            console.error('HTTP server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use`);
            }
        });

        httpServer.on('clientError', (error, socket) => {
            logger.error('(server) HTTP client error:', error);
            console.error('HTTP client error:', error);
        });
    }

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
