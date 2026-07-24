require('./server/index.js');

// Keep the process alive - the proxy doesn't create persistent event listeners
// so Node will exit if the event loop has nothing to do
setInterval(() => {}, 1000);
