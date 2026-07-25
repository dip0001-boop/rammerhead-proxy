const http = require('http');
const https = require('https');
const stream = require('stream');
const fs = require('fs');
const path = require('path');
const { getPathname } = require('testcafe-hammerhead/lib/utils/url');
const { Proxy } = require('testcafe-hammerhead');
const WebSocket = require('ws');
const httpResponse = require('../util/httpResponse');
const streamToString = require('../util/streamToString');
const URLPath = require('../util/URLPath');
const RammerheadLogging = require('../classes/RammerheadLogging');

require('../util/fixCorsHeader');
require('../util/fixWebsocket');
require('../util/addMoreErrorGuards');
require('../util/addUrlShuffling');
require('../util/patchAsyncResourceProcessor');

let addJSDiskCache = function (cachePath, size) {
    require('../util/addJSDiskCache')(cachePath, size);
    addJSDiskCache = () => {};
};

/**
 * @typedef {object} ServerInfo
 * @property {string} hostname
 * @property {number} port
 * @property {number} crossDomainPort
 * @property {string} protocol
 * @property {string} domain
 * @property {boolean} cacheRequests
 */

/**
 * @typedef {object} RammerheadServerInfo
 * @property {string} hostname
 * @property {number} port
 * @property {'https:'|'http:'} protocol
 */

/**
 * wrapper for hammerhead's Proxy
 */
class RammerheadProxy extends Proxy {
    constructor({
        loggerGetIP = (req) => req.socket.remoteAddress,
        logger = new RammerheadLogging({ logLevel: 'disabled' }),
        bindingAddress = '127.0.0.1',
        port = 8080,
        crossDomainPort = 8081,
        dontListen = false,
        ssl = null,
        getServerInfo = (req) => {
            const forwardedHost = req.headers['x-forwarded-host'];
            const hostHeader = forwardedHost || req.headers.host || `localhost:${port}`;
            const hostname = String(hostHeader).split(':')[0] || 'localhost';

            return {
                hostname,
                port,
                protocol:
                    req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted
                        ? 'https:'
                        : 'http:'
            };
        },
        disableLocalStorageSync = false,
        diskJsCachePath = null,
        jsCacheSize = 50 * 1024 * 1024
    } = {}) {
        let restoreHooks = () => {};

        if (!crossDomainPort) {
            const httpOrHttps = ssl ? https : http;
            const proxyHttpOrHttps = http;

            const originalProxyCreateServer = proxyHttpOrHttps.createServer;
            const originalCreateServer = httpOrHttps.createServer;

            let onlyOneHttpServer = null;

            proxyHttpOrHttps.createServer = function (...args) {
                const emptyFunc = () => {};

                if (onlyOneHttpServer) {
                    return {
                        on: emptyFunc,
                        listen: emptyFunc,
                        close: emptyFunc
                    };
                }

                if (args.length !== 2) {
                    throw new Error('unexpected argument length coming from hammerhead');
                }

                onlyOneHttpServer = originalCreateServer(...args);
                return onlyOneHttpServer;
            };

            const originalListen = http.Server.prototype.listen;

            http.Server.prototype.listen = function (...args) {
                if (dontListen) {
                    return this;
                }

                const callback = args.find((arg) => typeof arg === 'function');

                if (callback) {
                    return originalListen.call(this, port, bindingAddress, callback);
                }

                return originalListen.call(this, port, bindingAddress);
            };

            restoreHooks = () => {
                proxyHttpOrHttps.createServer = originalProxyCreateServer;
                http.Server.prototype.listen = originalListen;
            };

            super('hostname', 'port', 'port', {
                ssl,
                developmentMode: true,
                cache: true
            });

            this.crossDomainPort = null;
        } else {
            const originalListen = http.Server.prototype.listen;

            http.Server.prototype.listen = function (...args) {
                if (dontListen) {
                    return this;
                }

                const callback = args.find((arg) => typeof arg === 'function');

                if (callback) {
                    return originalListen.call(this, port, bindingAddress, callback);
                }

                return originalListen.call(this, port, bindingAddress);
            };

            restoreHooks = () => {
                http.Server.prototype.listen = originalListen;
            };

            super('doesntmatter', port, crossDomainPort, {
                ssl,
                developmentMode: true,
                cache: true
            });

            this.crossDomainPort = crossDomainPort;
        }

        this._restoreNativeHooks = restoreHooks;

        this._setupRammerheadServiceRoutes();
        this._setupLocalStorageServiceRoutes(disableLocalStorageSync);

        this.onRequestPipeline = [];
        this.onUpgradePipeline = [];
        this.websocketRoutes = [];

        this.rewriteServerHeaders = {
            'permissions-policy': (headerValue) =>
                headerValue && headerValue.replace(/sync-xhr/g, 'sync-yes'),

            'feature-policy': (headerValue) =>
                headerValue && headerValue.replace(/sync-xhr/g, 'sync-yes'),

            'referrer-policy': () => 'no-referrer-when-downgrade',
            'report-to': () => undefined,
            'cross-origin-embedder-policy': () => undefined,

            'access-control-allow-origin': () => '*',
            'access-control-allow-methods': () => '*',
            'access-control-allow-headers': () => '*'
        };

        this.getServerInfo = getServerInfo;

        this.serverInfo1 = null;
        this.serverInfo2 = null;

        this.loggerGetIP = loggerGetIP;
        this.logger = logger;

        addJSDiskCache(diskJsCachePath, jsCacheSize);
    }

    WS(route, handler, websocketOptions = {}) {
        if (this.checkIsRoute(route)) {
            throw new TypeError('WS route already exists');
        }

        const wsServer = new WebSocket.Server({
            ...websocketOptions,
            noServer: true
        });

        this.websocketRoutes.push({
            route,
            handler,
            wsServer
        });

        return wsServer;
    }

    unregisterWS(route) {
        if (!this.getWSRoute(route, true)) {
            throw new TypeError('websocket route does not exist');
        }
    }

    getWSRoute(path, doDelete = false) {
        for (let i = 0; i < this.websocketRoutes.length; i++) {
            const route = this.websocketRoutes[i];

            if (
                (typeof route.route === 'string' && route.route === path) ||
                (route.route instanceof RegExp && route.route.test(path))
            ) {
                if (doDelete) {
                    this.websocketRoutes.splice(i, 1);
                }

                return route;
            }
        }

        return null;
    }

    _WSRouteHandler(req, socket, head) {
        const route = this.getWSRoute(req.url);

        if (!route) {
            return false;
        }

        this.logger.traffic(`WSROUTE UPGRADE ${this.loggerGetIP(req)} ${req.url}`);

        route.wsServer.handleUpgrade(req, socket, head, (client, upgradedReq) => {
            this.logger.traffic(`WSROUTE OPEN ${this.loggerGetIP(upgradedReq)} ${upgradedReq.url}`);

            client.once('close', () => {
                this.logger.traffic(`WSROUTE CLOSE ${this.loggerGetIP(upgradedReq)} ${upgradedReq.url}`);
            });

            route.handler(client, upgradedReq);
        });

        return true;
    }

    addToOnRequestPipeline(onRequest, beginning = false) {
        if (beginning) {
            this.onRequestPipeline.push(onRequest);
        } else {
            this.onRequestPipeline.unshift(onRequest);
        }
    }

    addToOnUpgradePipeline(onUpgrade, beginning = false) {
        if (beginning) {
            this.onUpgradePipeline.push(onUpgrade);
        } else {
            this.onUpgradePipeline.unshift(onUpgrade);
        }
    }

    checkIsRoute(req) {
        if (req instanceof RegExp) {
            return !!this.getWSRoute(req);
        }

        const routerQuery = `${req.method} ${getPathname(req.url || '')}`;

        const route = this.routes.get(routerQuery);

        if (route) {
            return true;
        }

        for (const routeWithParams of this.routesWithParams) {
            const routeMatch = routerQuery.match(routeWithParams.re);

            if (routeMatch) {
                return true;
            }
        }

        return !!this.getWSRoute(req.url);
    }

    async _onRequest(req, res, serverInfo) {
        serverInfo = this._rewriteServerInfo(req);

        const isWebsocket = res instanceof stream.Duplex;

        if (!isWebsocket) {
            const originalWriteHead = res.writeHead;
            const self = this;

            res.writeHead = function (statusCode, statusMessage, headers) {
                if (!headers) {
                    headers = statusMessage;
                    statusMessage = undefined;
                }

                if (headers) {
                    const alreadyRewrittenHeaders = [];

                    if (Array.isArray(headers)) {
                        for (let i = 0; i < headers.length - 1; i += 2) {
                            const header = headers[i].toLowerCase();

                            if (header in self.rewriteServerHeaders) {
                                alreadyRewrittenHeaders.push(header);

                                headers[i + 1] =
                                    self.rewriteServerHeaders[header] &&
                                    self.rewriteServerHeaders[header](headers[i + 1]);

                                if (!headers[i + 1]) {
                                    headers.splice(i, 2);
                                    i -= 2;
                                }
                            }
                        }

                        for (const header in self.rewriteServerHeaders) {
                            if (alreadyRewrittenHeaders.includes(header)) {
                                continue;
                            }

                            const value =
                                self.rewriteServerHeaders[header] &&
                                self.rewriteServerHeaders[header]();

                            if (value) {
                                headers.push(header, value);
                            }
                        }
                    } else {
                        for (const header in headers) {
                            if (header in self.rewriteServerHeaders) {
                                alreadyRewrittenHeaders.push(header);

                                headers[header] =
                                    self.rewriteServerHeaders[header] &&
                                    self.rewriteServerHeaders[header]();

                                if (!headers[header]) {
                                    delete headers[header];
                                }
                            }
                        }

                        for (const header in self.rewriteServerHeaders) {
                            if (alreadyRewrittenHeaders.includes(header)) {
                                continue;
                            }

                            const value =
                                self.rewriteServerHeaders[header] &&
                                self.rewriteServerHeaders[header]();

                            if (value) {
                                headers[header] = value;
                            }
                        }
                    }
                }

                if (statusMessage) {
                    originalWriteHead.call(this, statusCode, statusMessage, headers);
                } else {
                    originalWriteHead.call(this, statusCode, headers);
                }
            };
        }

        const isRoute = this.checkIsRoute(req);
        const ip = this.loggerGetIP(req);

        this.logger.traffic(`${isRoute ? 'ROUTE ' : ''}${ip} ${req.url}`);

        for (const handler of this.onRequestPipeline) {
            if (
                (await handler.call(
                    this,
                    req,
                    res,
                    serverInfo,
                    isRoute,
                    isWebsocket
                )) === true
            ) {
                return;
            }
        }

        if (isRoute && isWebsocket) {
            httpResponse.badRequest(
                this.logger,
                req,
                res,
                ip,
                'Rejected unsupported websocket request'
            );

            return;
        }

        super._onRequest(req, res, serverInfo);
    }

    async _onUpgradeRequest(req, socket, head, serverInfo) {
        serverInfo = this._rewriteServerInfo(req);

        for (const handler of this.onUpgradePipeline) {
            const isRoute = this.checkIsRoute(req);

            if (
                (await handler.call(
                    this,
                    req,
                    socket,
                    head,
                    serverInfo,
                    isRoute
                )) === true
            ) {
                return;
            }
        }

        if (this._WSRouteHandler(req, socket, head)) {
            return;
        }

        super._onUpgradeRequest(req, socket, head, serverInfo);
    }

    _rewriteServerInfo(req) {
        const serverInfo = this.getServerInfo(req);

        return {
            hostname: serverInfo.hostname,
            port: serverInfo.port,
            crossDomainPort:
                serverInfo.crossDomainPort ||
                this.crossDomainPort ||
                serverInfo.port,
            protocol: serverInfo.protocol,
            domain: `${serverInfo.protocol}//${serverInfo.hostname}:${serverInfo.port}`,
            cacheRequests: false
        };
    }

    _setupRammerheadServiceRoutes() {
        this.GET('/rammerhead.js', {
            content: fs.readFileSync(
                path.join(
                    __dirname,
                    '../client/rammerhead' +
                        (process.env.DEVELOPMENT ? '.js' : '.min.js')
                )
            ),
            contentType: 'application/x-javascript'
        });

        this.GET('/api/shuffleDict', (req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', '*');
            res.setHeader('Access-Control-Allow-Headers', '*');

            const { id } = new URLPath(req.url).getParams();

            if (!id || !this.openSessions.has(id)) {
                return httpResponse.badRequest(
                    this.logger,
                    req,
                    res,
                    this.loggerGetIP(req),
                    'Invalid session id'
                );
            }

            res.end(
                JSON.stringify(this.openSessions.get(id).shuffleDict) || ''
            );
        });
    }

    _setupLocalStorageServiceRoutes(disableSync) {
        this.POST('/syncLocalStorage', async (req, res) => {
            if (disableSync) {
                res.writeHead(404);
                res.end('server disabled localStorage sync');
                return;
            }

            const badRequest = (msg) =>
                httpResponse.badRequest(
                    this.logger,
                    req,
                    res,
                    this.loggerGetIP(req),
                    msg
                );

            const respondJson = (obj) =>
                res.end(JSON.stringify(obj));

            const { sessionId, origin } =
                new URLPath(req.url).getParams();

            if (!sessionId || !this.openSessions.has(sessionId)) {
                return badRequest('Invalid session id');
            }

            if (!origin) {
                return badRequest('Invalid origin');
            }

            let parsed;

            try {
                parsed = JSON.parse(await streamToString(req));
            } catch (e) {
                return badRequest('bad client body');
            }

            const now = Date.now();
            const session = this.openSessions.get(sessionId, false);

            if (!session.data.localStorage) {
                session.data.localStorage = {};
            }

            switch (parsed.type) {
                case 'sync':
                    if (parsed.fetch) {
                        if (!session.data.localStorage[origin]) {
                            session.data.localStorage[origin] = {
                                data: {},
                                timestamp: now
                            };

                            return respondJson({
                                timestamp: now,
                                data: {}
                            });
                        }

                        return respondJson({
                            timestamp:
                                session.data.localStorage[origin].timestamp,
                            data:
                                session.data.localStorage[origin].data
                        });
                    }

                    parsed.timestamp = parseInt(parsed.timestamp);

                    if (isNaN(parsed.timestamp)) {
                        return badRequest(
                            'must specify valid timestamp'
                        );
                    }

                    if (parsed.timestamp > now) {
                        return badRequest(
                            'cannot specify timestamp in the future'
                        );
                    }

                    if (!parsed.data || typeof parsed.data !== 'object') {
                        return badRequest('data must be an object');
                    }

                    for (const prop in parsed.data) {
                        if (typeof parsed.data[prop] !== 'string') {
                            return badRequest(
                                'data[prop] must be a string'
                            );
                        }
                    }

                    if (!session.data.localStorage[origin]) {
                        session.data.localStorage[origin] = {
                            data: parsed.data,
                            timestamp: now
                        };

                        return respondJson({});
                    }

                    if (
                        session.data.localStorage[origin].timestamp <=
                        parsed.timestamp
                    ) {
                        session.data.localStorage[origin].data =
                            parsed.data;

                        session.data.localStorage[origin].timestamp =
                            parsed.timestamp;

                        return respondJson({});
                    }

                    return respondJson({
                        timestamp:
                            session.data.localStorage[origin].timestamp,
                        data:
                            session.data.localStorage[origin].data
                    });

                case 'update':
                    if (!session.data.localStorage[origin]) {
                        return badRequest(
                            'must perform sync first on a new origin'
                        );
                    }

                    if (
                        !parsed.updateData ||
                        typeof parsed.updateData !== 'object'
                    ) {
                        return badRequest(
                            'updateData must be an object'
                        );
                    }

                    for (const prop in parsed.updateData) {
                        if (
                            !parsed.updateData[prop] ||
                            typeof parsed.updateData[prop] !== 'string'
                        ) {
                            return badRequest(
                                'updateData[prop] must be a non-empty string'
                            );
                        }
                    }

                    for (const prop in parsed.updateData) {
                        session.data.localStorage[origin].data[prop] =
                            parsed.updateData[prop];
                    }

                    session.data.localStorage[origin].timestamp = now;

                    return respondJson({
                        timestamp: now
                    });

                default:
                    return badRequest(
                        'unknown type ' + parsed.type
                    );
            }
        });
    }

    openSession() {
        throw new TypeError(
            'unimplemented. please use a RammerheadSessionStore and use their .add() method'
        );
    }

    close() {
        try {
            super.close();
        } finally {
            try {
                this.openSessions.close();
            } catch (_) {}

            try {
                if (this._restoreNativeHooks) {
                    this._restoreNativeHooks();
                    this._restoreNativeHooks = null;
                }
            } catch (_) {}
        }
    }

    GET(route, handler) {
        if (route === '/hammerhead.js') {
            handler.content = fs.readFileSync(
                path.join(
                    __dirname,
                    '../client/hammerhead' +
                        (process.env.DEVELOPMENT ? '.js' : '.min.js')
                )
            );
        }

        super.GET(route, handler);
    }

    POST(route, handler) {
        super.POST(route, handler);
    }
}

module.exports = RammerheadProxy;
