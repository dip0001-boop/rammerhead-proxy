require('./server/index.js');

// Keep Node alive
setInterval(() => {}, 1000);

process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] SIGTERM received');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[SHUTDOWN] SIGINT received');
    process.exit(0);
});
