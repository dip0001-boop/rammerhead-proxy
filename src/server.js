'use strict';

const path = require('path');
const crypto = require('crypto');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

const PORT = Number.parseInt(process.env.PORT, 10) || 10000;
const HOST = '0.0.0.0';

const PASSWORD = 'bannana13!';

console.log('Starting THE VAULT / Rammerhead...');
console.log(`Port: ${PORT}`);

const sessionStore = new RammerheadSessionMemoryStore();

const proxy = new RammerheadProxy({
    bindingAddress: HOST,
    port: PORT,
    crossDomainPort: PORT + 1
});

proxy.openSessions = sessionStore;

/* -----------------------------
SESSION HELPERS
----------------------------- */

function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

function getParams(req) {
    return new URL(
        req.url,
        `http://${req.headers.host || 'localhost'}`
    ).searchParams;
}

function checkPassword(req) {
    return getParams(req).get('pwd') === PASSWORD;
}

function sendText(res, status, text) {
    res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
    });

    res.end(text);
}

/* -----------------------------
RAMMERHEAD SESSION ROUTES
----------------------------- */

proxy.GET('/newsession', (req, res) => {
    if (!checkPassword(req)) {
        sendText(res, 403, 'Invalid password');
        return;
    }

    let id;

    do {
        id = generateSessionId();
    } while (sessionStore.has(id));

    sessionStore.add(id);

    sendText(res, 200, id);
});

proxy.GET('/editsession', (req, res) => {
    if (!checkPassword(req)) {
        sendText(res, 403, 'Invalid password');
        return;
    }

    const params = getParams(req);
    const id = params.get('id');

    if (!id || !sessionStore.has(id)) {
        sendText(res, 400, 'Invalid session ID');
        return;
    }

    const session = sessionStore.get(id);

    const enableShuffling =
        params.get('enableShuffling') === '1';

    if (enableShuffling) {
        session.shuffleDict = session.shuffleDict || {};
    } else {
        session.shuffleDict = null;
    }

    const httpProxy = params.get('httpProxy');

    if (httpProxy) {
        try {
            const parsed = new URL(httpProxy);

            session.externalProxySettings = {
                host: parsed.hostname,
                hostname: parsed.hostname,
                port: parsed.port || '80'
            };

            if (parsed.username || parsed.password) {
                session.externalProxySettings.proxyAuth =
                    `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
            }
        } catch {
            sendText(res, 400, 'Invalid HTTP proxy');
            return;
        }
    } else {
        session.externalProxySettings = null;
    }

    sendText(res, 200, 'ok');
});

proxy.GET('/deletesession', (req, res) => {
    if (!checkPassword(req)) {
        sendText(res, 403, 'Invalid password');
        return;
    }

    const id = getParams(req).get('id');

    if (!id) {
        sendText(res, 400, 'Missing session ID');
        return;
    }

    sessionStore.delete(id);

    sendText(res, 200, 'ok');
});

/* -----------------------------
STATIC VAULT FRONTEND
----------------------------- */

addStaticFilesToProxy(
    proxy,
    path.join(__dirname, '../public')
);

proxy.GET('/healthz', (req, res) => {
    sendText(res, 200, 'ok');
});

console.log('Static frontend files registered.');
console.log('Rammerhead session routes registered.');

/* -----------------------------
START SERVER
----------------------------- */

proxy.start({
    hostname: HOST,
    port1: PORT,
    port2: PORT + 1,
    ssl: null,
    developmentMode: true,
    cache: true
});

console.log(`Rammerhead running on ${HOST}:${PORT}`);

/* -----------------------------
SHUTDOWN
----------------------------- */

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
