const path = require('path');
const fs = require('fs');
const os = require('os');
const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window );

module.exports = {
    //// HOSTING CONFIGURATION ////

    bindingAddress: '0.0.0.0',
    port: process.env.PORT || 8081,
    crossDomainPort: null,
    publicDir: path.join(__dirname, '../public'), // set to null to disable

    // if workers is null or 1, multithreading is disabled
    workers: os.cpus().length,

    // ssl object is either null or { key: fs.readFileSync('path/to/key'), cert: fs.readFileSync('path/to/cert') }
    ssl: null,

    getServerInfo: (req) => ({
        hostname: new URL('http://' + req.headers.host).hostname,
        port: process.env.PORT || 8081,
        crossDomainPort: null,
        protocol: 'http:'
    }),

    // enforce a password for creating new sessions. set to null to disable
    password: null,

    // disable or enable localStorage sync
    disableLocalStorageSync: false,

    // restrict sessions to be only used per IP
    restrictSessionToIP: false,

    // use disk for caching js rewrites. set to null to use memory instead
    diskJsCachePath: path.join(__dirname, '../cache-js'),
    jsCacheSize: 50 * 1024 * 1024, // 50mb

    //// REWRITE HEADER CONFIGURATION ////

    stripClientHeaders: ['cf-ipcountry', 'cf-ray', 'x-forwarded-proto', 'cf-visitor', 'cf-connecting-ip', 'cdn-loop', 'x-forwarded-for'],
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
        deleteCorruptedSessions: true,
    },

    //// LOGGING CONFIGURATION ////

    logLevel: 'info',
    generatePrefix: (level) => `[${new Date().toISOString()}] [${level.toUpperCase()}] `,

    getIP: function (req) {
        return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    }
};

if (fs.existsSync(path.join(__dirname, '../config.js'))) Object.assign(module.exports, require('../config'));
