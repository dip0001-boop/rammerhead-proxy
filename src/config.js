const path = require('path');
const fs = require('fs');

const PORT = Number(process.env.PORT) || 10000;

module.exports = {
    //// HOSTING CONFIGURATION ////

    bindingAddress: '0.0.0.0',

    // Render provides the port through process.env.PORT
    port: PORT,

    // Disable the second server on Render
    crossDomainPort: null,

    publicDir: path.join(__dirname, '../public'),

    // Render should run one Node process
    workers: 1,

    ssl: null,

    // Render terminates HTTPS before forwarding traffic to Node.
    // The public URL is HTTPS, but the internal Node server is HTTP.
    getServerInfo: (req) => {
        const host = req.headers.host || '';

        return {
            hostname: host.split(':')[0],
            port: 443,
            crossDomainPort: 443,
            protocol: 'https:'
        };
    },

    //// SESSION CONFIGURATION ////

    password: null,

    disableLocalStorageSync: false,

    restrictSessionToIP: true,

    diskJsCachePath: path.join(__dirname, '../cache-js'),

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

    logLevel: 'traffic',

    generatePrefix: (level) =>
        `[${new Date().toISOString()}] [${level.toUpperCase()}] `,

    getIP: function (req) {
        return (
            req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress ||
            ''
        ).split(',')[0].trim();
    }
};

if (fs.existsSync(path.join(__dirname, '../config.js'))) {
    Object.assign(module.exports, require('../config'));
}
