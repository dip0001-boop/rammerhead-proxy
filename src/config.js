const path = require('path');

const PORT = Number(process.env.PORT) || 10000;

module.exports = {
    // HOSTING
    bindingAddress: '0.0.0.0',
    port: PORT,
    crossDomainPort: null,

    publicDir: path.join(__dirname, '../public'),

    // IMPORTANT: one process only on Render
    workers: 1,

    ssl: null,

    getServerInfo: (req) => {
        const host = req.headers.host || '';

        return {
            hostname: host.split(':')[0],
            port: 443,
            crossDomainPort: 443,
            protocol: 'https:'
        };
    },

    // Password is handled by your own Vault frontend/backend system
    password: null,

    disableLocalStorageSync: false,

    restrictSessionToIP: false,

    diskJsCachePath: null,

    jsCacheSize: 50 * 1024 * 1024,

    // HEADERS
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

    // SESSIONS
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

    // LOGGING
    logLevel: 'info',

    generatePrefix: (level) =>
        `[${new Date().toISOString()}] [${level.toUpperCase()}] `,

    getIP: (req) => {
        return (
            req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress ||
            ''
        )
            .split(',')[0]
            .trim();
    }
};
