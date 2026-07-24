const fs = require('fs');
const gracefulFS = require('graceful-fs');

gracefulFS.gracefulify(fs);

if (require('cluster').isMaster) {
    require('dotenv-flow').config();
}

const exitHook = require('async-exit-hook');
const RammerheadProxy = require('../classes/RammerheadProxy');
const addStaticDirToProxy = require('../util/addStaticDirToProxy');
const RammerheadSessionFileCache = require('../classes/RammerheadSessionFileCache');
const config = require('../config');
const setupRoutes = require('./setupRoutes');
const setupPipeline = require('./setupPipeline');
const RammerheadLogging = require('../classes/RammerheadLogging');

const PORT = Number(process.env.PORT) || config.port || 10000;
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
    dontListen: false,
    ssl: null,
    getServerInfo: (req) => {
        const host = req.headers.host || `${HOST}:${PORT}`;
        const parsed = new URL(`http://${host}`);

        return {
            hostname: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : PORT,
            protocol: req.socket.encrypted ? 'https:' : 'http:'
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

exitHook(() => {
    logger.info('(server) Received exit signal, closing proxy server');

    try {
        proxyServer.close();
    } catch (error) {
        logger.error(error);
    }

    logger.info('(server) Closed proxy server');
});

logger.info(
    `(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`
);
