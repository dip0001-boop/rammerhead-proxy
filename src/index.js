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
    console.error('[FATAL]', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('[FATAL]', reason);
});


let proxyServer;


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


        disableLocalStorageSync:
            config.disableLocalStorageSync,


        diskJsCachePath:
            config.diskJsCachePath,


        jsCacheSize:
            config.jsCacheSize
    });


    console.log('[INIT] RammerheadProxy created successfully');


    proxyServer.GET('/health', (req, res) => {

        res.writeHead(200, {
            'Content-Type': 'text/plain'
        });

        res.end('OK');

    });


    proxyServer.GET('/ping', (req, res) => {

        res.writeHead(200, {
            'Content-Type': 'text/plain'
        });

        res.end('OK');

    });



    if (config.publicDir) {

        console.log(
            '[INIT] Adding static directory:',
            config.publicDir
        );

        addStaticDirToProxy(
            proxyServer,
            config.publicDir
        );

    }



    console.log('[INIT] Creating session store...');


    const sessionStore =
        new RammerheadSessionFileCache({
            logger,
            ...config.fileCacheSessionConfig
        });



    sessionStore.attachToProxy(proxyServer);



    console.log('[INIT] Setting up pipeline...');

    setupPipeline(
        proxyServer,
        sessionStore
    );



    console.log('[INIT] Setting up routes...');

    setupRoutes(
        proxyServer,
        sessionStore,
        logger
    );



    console.log('[INIT] Initialization complete');

    setTimeout(() => {

        console.log(
            `[READY] Server running on ${HOST}:${PORT}`
        );

    }, 1000);



}
catch(error){

    console.error(
        '[FATAL] Initialization failed:',
        error
    );

    process.exit(1);

}



function shutdown(signal){

    console.log(
        `[SHUTDOWN] ${signal}`
    );


    try{

        if(proxyServer){

            proxyServer.close();

        }

    }
    catch(e){}



    process.exit(0);

}



process.on(
    'SIGTERM',
    () => shutdown('SIGTERM')
);


process.on(
    'SIGINT',
    () => shutdown('SIGINT')
);
