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

process.on('exit', (code) => {
    console.log(`[EXIT] Process exiting with code: ${code}`);
});

let proxyServer;
let listeningServer;

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
        getServerInfo: (req) => {
            const forwardedHost =
                req.headers['x-forwarded-host'] ||
                req.headers.host ||
                '';
            const hostname = forwardedHost.split(':')[0];
            return {
                hostname,
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
    const fileCacheOptions = {
        logger,
        ...config.fileCacheSessionConfig
    };

    const sessionStore = new RammerheadSessionFileCache(fileCacheOptions);
    sessionStore.attachToProxy(proxyServer);
    
    console.log('[INIT] Setting up pipeline...');
    setupPipeline(proxyServer, sessionStore);
    
    console.log('[INIT] Setting up routes...');
    setupRoutes(proxyServer, sessionStore, logger);
    
    console.log('[INIT] Initialization complete');

    // Extract underlying hammerhead server instances
    listeningServer = proxyServer.server1 || proxyServer.server;

    if (listeningServer && typeof listeningServer.on === 'function') {
        console.log('[INIT] Found listening server');
        
        listeningServer.on('error', (error) => {
            console.error('[ERROR] Server error:', error);
            logger.error('Server error:', error);
        });

        listeningServer.on('clientError', (error, socket) => {
            if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
                console.error('[ERROR] Client error:', error);
                logger.error('Client error:', error);
            }
        });
    } else {
        console.log('[INFO] Proxy running (Server managed by Hammerhead)');
    }

    logger.info(`(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`);
    console.log('[READY] Server ready and waiting for requests');

} catch (error) {
    console.error('[FATAL] Initialization failed:', error);
    logger.error('Initialization failed:', error);
    console.error(error.stack);
    setTimeout(() => {
        process.exit(1);
    }, 1000);
}

// Graceful shutdown
function shutdown(signal) {
    console.log(`[SHUTDOWN] Received ${signal}`);
    
    if (proxyServer) {
        try {
            proxyServer.close();
            console.log('[SHUTDOWN] Proxy closed');
        } catch (error) {
            console.error('[SHUTDOWN] Error closing proxy:', error);
        }
    }
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
