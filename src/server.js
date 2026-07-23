'use strict';

const path = require('path');

const RammerheadProxy = require('./classes/RammerheadProxy');
const RammerheadSessionMemoryStore = require('./classes/RammerheadMemoryStore');
const addStaticFilesToProxy = require('./util/addStaticDirToProxy');

const PORT = Number(process.env.PORT || 8000);

console.log('Starting Rammerhead proxy server...');
console.log(`Port: ${PORT}`);

try {
    const sessionStore = new RammerheadSessionMemoryStore();

    const proxy = new RammerheadProxy({
        sessionStore,
        bindingAddress: '0.0.0.0',
        port: PORT,
        crossDomainPort: null
    });

    addStaticFilesToProxy(
        proxy,
        path.join(__dirname, '../public')
    );

    console.log('Static frontend files registered.');
    console.log(`Rammerhead running on port ${PORT}`);

    process.on('SIGTERM', () => {
        proxy.close();
        process.exit(0);
    });

    process.on('SIGINT', () => {
        proxy.close();
        process.exit(0);
    });

} catch (error) {
    console.error('Fatal error during startup:');
    console.error(error);
    process.exit(1);
}
