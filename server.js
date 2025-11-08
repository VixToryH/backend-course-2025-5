const { Command } = require('commander'); 
const http = require('http');           
const fs = require('fs/promises');      
const path = require('path');           

const program = new Command();

program
    .requiredOption('-h, --host <address>', 'адреса сервера')
    .requiredOption('-p, --port <number>', 'порт сервера', (value) => parseInt(value, 10))
    .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();
const { host, port, cache } = options;

async function checkAndCreateCacheDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Cache directory ready at: ${dirPath}`);
    } catch (error) {
        console.error(`Error checking/creating cache directory: ${error.message}`);
        process.exit(1);
    }
}

function proxyHandler(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Proxy Server is running!');
}

async function startServer() {
    await checkAndCreateCacheDir(cache);

    const server = http.createServer(proxyHandler);

    server.listen(port, host, () => {
        console.log(`Proxy server listening on http://${host}:${port}`);
    });
}

startServer();
