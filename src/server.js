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
    sessionStore,

    bindingAddress: '0.0.0.0',
    port: PORT,

    // Keep this disabled for Render's single public port
    crossDomainPort: null
});

// Register the frontend files
addStaticFilesToProxy(
    proxy,
    path.join(__dirname, '../public')
);

console.log('Static frontend files registered.');
console.log(`Rammerhead running on port ${PORT}`);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Shutting down...');
    proxy.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT. Shutting down...');
    proxy.close();
    process.exit(0);
});
