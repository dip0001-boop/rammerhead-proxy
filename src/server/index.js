const fs = require('fs');
const gracefulFS = require('graceful-fs');

gracefulFS.gracefulify(fs);

const exitHook = require('async-exit-hook');
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

exitHook((done) => {
    logger.info('(server) Received exit signal, closing proxy server');

    try {
        proxyServer.close();
    } catch (error) {
        logger.error(error);
    }

    logger.info('(server) Closed proxy server');

    if (typeof done === 'function') {
        done();
    }
});
