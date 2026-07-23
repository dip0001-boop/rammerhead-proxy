'use strict';

const path = require('path');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

const PORT = Number(process.env.PORT || 10000);

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

const sessionStore = new RammerheadSessionMemoryStore();

const proxy = new RammerheadProxy({
    bindingAddress: '0.0.0.0',
    port: PORT,
    crossDomainPort: null
});

proxy.openSessions = sessionStore;

// Register the frontend files
addStaticFilesToProxy(
    proxy,
    path.join(__dirname, '../public')
);

console.log('Static frontend files registered.');
console.log(`Rammerhead running on port ${PORT}`);

// Keep the process alive
process.stdin.resume();

// Graceful shutdown
function shutdown(signal) {
    console.log(`Received ${signal}. Shutting down...`);

    try {
        proxy.close();
    } catch (error) {
        console.error('Error while shutting down:', error);
    }

    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
