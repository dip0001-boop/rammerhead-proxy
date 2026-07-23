'use strict';

const path = require('path');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

const PORT = Number.parseInt(process.env.PORT, 10) || 10000;
const HOST = '0.0.0.0';

console.log('[1] Starting server...');
console.log(`[2] Port: ${PORT}`);

let proxy;
let sessionStore;

try {
    console.log('[3] Creating session store...');
    sessionStore = new RammerheadSessionMemoryStore();

    console.log('[4] Creating Rammerhead proxy...');

    proxy = new RammerheadProxy({
        bindingAddress: HOST,
        port: PORT,
        crossDomainPort: null
    });

    console.log('[5] Proxy created.');

    proxy.openSessions = sessionStore;

    console.log('[6] Registering static files...');

    addStaticFilesToProxy(
        proxy,
        path.join(__dirname, '../public')
    );

    console.log('[7] Static frontend files registered.');

    console.log('[8] Registering health route...');

    proxy.GET('/healthz', (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store'
        });

        res.end('ok');
    });

    console.log('[9] Health route registered.');
    console.log(`[10] Rammerhead running on ${HOST}:${PORT}`);

} catch (error) {
    console.error('================================');
    console.error('SERVER STARTUP ERROR');
    console.error('================================');
    console.error(error);
    console.error(error.stack);
    process.exit(1);
}

let shuttingDown = false;

function shutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;
    console.log(`${signal} received.`);

    try {
        proxy.close();
        console.log('Rammerhead proxy closed.');
    } catch (error) {
        console.error('Error while closing Rammerhead:', error);
    }
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
