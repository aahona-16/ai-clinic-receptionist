const net = require('net');

const server = net.createServer();

server.listen(4000, () => {
  console.log('Port 4000 is now free');
  server.close();
  process.exit(0);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Port 4000 is in use, but we cannot forcefully kill it with current permissions');
    process.exit(1);
  }
});

setTimeout(() => {
  server.close();
  process.exit(1);
}, 1000);
