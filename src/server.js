'use strict';

const path = require('path');

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

proxy.openSessions = sessionStore;

addStaticFilesToProxy(
    proxy,
    path.join(__dirname, '../public')
);

proxy.GET('/healthz', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
    });

    res.end('ok');
});

console.log('Static frontend files registered.');
console.log(`Rammerhead running on ${HOST}:${PORT}`);

// Keep the Node process alive.
// The Rammerhead proxy itself manages the HTTP server.
const keepAlive = setInterval(() => {
    // Intentionally empty.
}, 1000);

let shuttingDown = false;

function shutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log(`${signal} received.`);

    clearInterval(keepAlive);

    try {
        proxy.close();
        console.log('Rammerhead proxy closed.');
    } catch (error) {
        console.error('Error while closing Rammerhead:', error);
    }

    process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
    console.error(error.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});

process.on('exit', (code) => {
    console.log(`Process exiting with code: ${code}`);
});
