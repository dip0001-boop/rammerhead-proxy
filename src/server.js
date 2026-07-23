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

    new RammerheadProxy({
        sessionStore,
        bindingAddress: '0.0.0.0',
        port: PORT,
        crossDomainPort: null
    });

    console.log('Rammerhead proxy started successfully.');

    const proxy = require('./classes/RammerheadProxy');

} catch (error) {
    console.error('Fatal error during startup:');
    console.error(error);
    process.exit(1);
}
