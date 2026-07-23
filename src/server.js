'use strict';

const path = require('path');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

const sessionStore = new RammerheadSessionMemoryStore();

const proxy = new RammerheadProxy({
    sessionStore,
    bindingAddress: HOST,
    port: PORT,
    crossDomainPort: null
});

addStaticFilesToProxy(
    proxy,
    path.join(__dirname, '../public')
);

console.log('Static frontend files registered.');
console.log(`Rammerhead running on ${HOST}:${PORT}`);

let shuttingDown = false;

function shutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);

    try {
        proxy.close();
    } catch (error) {
        console.error('Error while closing proxy:', error);
    }

    setTimeout(() => {
        process.exit(0);
    }, 1000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
