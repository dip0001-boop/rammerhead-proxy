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

const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';

const logger = new RammerheadLogging({
    logLevel: config.logLevel,
    generatePrefix: config.generatePrefix
});

/*
 * IMPORTANT:
 * dontListen is true because we explicitly start the actual server below.
 * This prevents Rammerhead's internal listener logic from interfering with
 * Render's required PORT.
 */
const proxyServer = new RammerheadProxy({
    logger,
    loggerGetIP: config.getIP,
    bindingAddress: HOST,
    port: PORT,
    crossDomainPort: null,
    dontListen: true,
    ssl: null,

    getServerInfo: (req) => {
        const host = req.headers.host || '';
        const hostname = host.split(':')[0];

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

const server = proxyServer.server1;

if (!server) {
    throw new Error('Rammerhead did not create its main HTTP server');
}

server.on('error', (error) => {
    logger.error(`Server error: ${error.message}`);
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    logger.info(
        `(server) Rammerhead proxy is listening on http://${HOST}:${PORT}`
    );
});

exitHook((done) => {
    logger.info('(server) Received exit signal, closing proxy server');

    try {
        proxyServer.close();
    } catch (error) {
        logger.error(error);
    }

    logger.info('(server) Closed proxy server');

    if (done) {
        done();
    }
});
