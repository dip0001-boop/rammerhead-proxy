const path = require('path');

const PORT = Number(process.env.PORT) || 10000;

module.exports = {
    //// HOSTING CONFIGURATION ////

    bindingAddress: '0.0.0.0',

    port: PORT,

    crossDomainPort: null,

    publicDir: path.join(__dirname, '../public'),

    // Render should run a single Rammerhead worker
    workers: 1,

    ssl: null,

    getServerInfo: (req) => ({
        hostname: new URL('https://' + req.headers.host).hostname,
        port: 443,
        crossDomainPort: null,
        protocol: 'https:'
    }),

    password: null,

    disableLocalStorageSync: false,

    restrictSessionToIP: false,

    diskJsCachePath: null,

    jsCacheSize: 50 * 1024 * 1024,

    //// REWRITE HEADER CONFIGURATION ////

    stripClientHeaders: [
        'cf-ipcountry',
        'cf-ray',
        'x-forwarded-proto',
        'cf-visitor',
        'cf-connecting-ip',
        'cdn-loop',
        'x-forwarded-for'
    ],

    rewriteServerHeaders: {},

    //// SESSION STORE CONFIG ////

    fileCacheSessionConfig: {
        saveDirectory: path.join(__dirname, '../sessions'),

        cacheTimeout: 1000 * 60 * 20,

        cacheCheckInterval: 1000 * 60 * 10,

        deleteUnused: true,

        staleCleanupOptions: {
            staleTimeout: 1000 * 60 * 60 * 24 * 3,
            maxToLive: null,
            staleCheckInterval: 1000 * 60 * 60 * 6
        },

        deleteCorruptedSessions: true
    },

    //// LOGGING CONFIGURATION ////

    logLevel: 'info',

    generatePrefix: (level) =>
        `[${new Date().toISOString()}] [${level.toUpperCase()}] `,

    getIP: function (req) {
        return (
            req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            ''
        ).split(',')[0].trim();
    }
};
