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

        // Required for Render
        bindingAddress: '0.0.0.0',
        port: PORT,

        // Use one public port
        crossDomainPort: null
    });

    // Serve everything inside public/
    addStaticFilesToProxy(
        proxy,
        path.join(__dirname, '../public')
    );

    console.log('Static frontend files registered.');
    console.log(`Rammerhead listening on port ${PORT}`);

    process.on('SIGTERM', () => {
        process.exit(0);
    });

    process.on('SIGINT', () => {
        process.exit(0);
    });

} catch (error) {
    console.error('Fatal error during startup:');
    console.error(error);
    process.exit(1);
}
