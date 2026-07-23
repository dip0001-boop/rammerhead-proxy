'use strict';

const path = require('path');
const http = require('http');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

const PORT = Number.parseInt(process.env.PORT, 10) || 10000;
const HOST = '0.0.0.0';

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

const sessionStore = new RammerheadSessionMemoryStore();

const proxy = new RammerheadProxy({
    bindingAddress: HOST,
    port: PORT,
    crossDomainPort: null
});

// RammerheadProxy.openSession() expects this store.
// The constructor does not accept "sessionStore" automatically.
proxy.openSessions = sessionStore;

// Register the frontend files.
addStaticFilesToProxy(
    proxy,
    path.join(__dirname, '../public')
);

// Add a simple health endpoint for Render.
proxy.GET('/healthz', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
    });

    res.end('ok');
});

console.log('Static frontend files registered.');
console.log(`Rammerhead running on ${HOST}:${PORT}`);

let shuttingDown = false;

function shutdown(signal) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log(`${signal} received.`);

    try {
        proxy.close();
        console.log('Rammerhead proxy closed.');
    } catch (error) {
        console.error('Error while closing Rammerhead:', error);
    }
}

process.once('SIGTERM', () => {
    shutdown('SIGTERM');
});

process.once('SIGINT', () => {
    shutdown('SIGINT');
});

process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});
