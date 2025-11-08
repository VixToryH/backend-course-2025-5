const { Command } = require('commander');
const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const program = new Command();

program
    .requiredOption('-h, --host <address>', 'адреса сервера')
    .requiredOption('-p, --port <number>', 'порт сервера', v => parseInt(v, 10))
    .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);
const { host, port, cache } = program.opts();

async function handleGetFromCache(res, cacheFilePath) {
    try {
        const imageBuffer = await fs.readFile(cacheFilePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(imageBuffer);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found in cache.');
        } else {
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
}

async function handlePutRequest(req, res, cacheFilePath) {
    const body = [];

    req.on('data', chunk => body.push(chunk));

    req.on('end', async () => {
        const imageBuffer = Buffer.concat(body);

        try {
            await fs.writeFile(cacheFilePath, imageBuffer);
            res.writeHead(201, { 'Content-Type': 'text/plain' });
            res.end('File created/updated successfully');
        } catch (error) {
            console.error('PUT failed:', error);
            res.writeHead(500);
            res.end('Failed to save file to cache.');
        }
    });
}

async function handleDeleteRequest(res, cacheFilePath) {
    try {
        await fs.unlink(cacheFilePath);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('File deleted successfully');
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found in cache.');
        } else {
            console.error('DELETE failed:', error);
            res.writeHead(500);
            res.end('Failed to delete file.');
        }
    }
}

async function proxyHandler(req, res) {
    const urlParts = req.url.split('/');
    const httpStatusCode = urlParts[1];

    if (!/^\d{3}$/.test(httpStatusCode)) {
        res.writeHead(400);
        return res.end('Invalid HTTP status code in URL path (must be 3 digits).');
    }

    const cacheFilePath = path.join(cache, `${httpStatusCode}.jpeg`);

    switch (req.method) {
        case 'GET':
            return handleGetFromCache(res, cacheFilePath);

        case 'PUT':
            return handlePutRequest(req, res, cacheFilePath);

        case 'DELETE':
            return handleDeleteRequest(res, cacheFilePath);    

        default:
            res.writeHead(405, { 
                'Content-Type': 'text/plain',
                'Allow': 'GET, PUT, DELETE' 
            });
            res.end('Method not allowed');
    }
}

async function checkAndCreateCacheDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Cache directory ready at: ${dirPath}`);
    } catch (error) {
        console.error(`Cannot create cache dir: ${error.message}`);
        process.exit(1);
    }
}

async function startServer() {
    await checkAndCreateCacheDir(cache);

    const server = http.createServer(proxyHandler);

    server.listen(port, host, () => {
        console.log(`Proxy server listening on http://${host}:${port}`);
    });
}

startServer();
