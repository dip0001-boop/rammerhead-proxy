require('./server/index.js');

process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] SIGTERM received');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[SHUTDOWN] SIGINT received');
    process.exit(0);
});

// Keep alive for Render
setInterval(() => {}, 1000);
