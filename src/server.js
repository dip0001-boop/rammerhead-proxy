'use strict';

const path = require('path');
const http = require('http');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadLogging = require('./classes/RammerheadLogging');
const RammerheadSession = require('./classes/RammerheadSession');
const RammerheadSessionAbstractStore = require('./classes/RammerheadSessionAbstractStore');
const RammerheadSessionFileCache = require('./classes/RammerheadSessionFileCache');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');

const generateId = require('./util/generateId');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');
const StrShuffler = require('./util/StrShuffler');
const URLPath = require('./util/URLPath');

const PORT = process.env.PORT || 8081;

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

try {
    // Create the session store
    const sessionStore = new RammerheadSessionMemoryStore();

    // Create the proxy
    const proxy = new RammerheadProxy({
        sessionStore
    });

    // Create HTTP server
    const server = http.createServer((req, res) => {
        proxy.handleRequest(req, res);
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Rammerhead proxy listening on 0.0.0.0:${PORT}`);
    });

    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down...');
        server.close(() => {
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down...');
        server.close(() => {
            process.exit(0);
        });
    });

} catch (error) {
    console.error('Fatal error during startup:');
    console.error(error);
    process.exit(1);
}
