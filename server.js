const { Command } = require('commander');
const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const superagent = require('superagent')

const program = new Command();

program
    .requiredOption('-h, --host <address>', 'адреса сервера')
    .requiredOption('-p, --port <number>', 'порт сервера', v => parseInt(v, 10))
    .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);
const { host, port, cache } = program.opts();

async function handleGetRequest(res, cacheFilePath, httpStatusCode) {
    let imageBuffer;

    try {
        imageBuffer = await fs.readFile(cacheFilePath);

        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        return res.end(imageBuffer);

    } catch (error) {
        if (error.code !== 'ENOENT') {
            res.writeHead(500);
            return res.end('Internal Server Error');
        } 

        const httpCatUrl = `https://http.cat/${httpStatusCode}`;
        console.log(`Cache miss for /${httpStatusCode}. Fetching from ${httpCatUrl}`);

        try {
            const response = await superagent
            .get(httpCatUrl)
            .buffer(true)
            .parse(superagent.parse.image);

            imageBuffer = response.body;

            await fs.writeFile(cacheFilePath, imageBuffer);
            console.log(`Successfully fetched and cached /${httpStatusCode}`);

            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            return res.end(imageBuffer);

        } catch (proxyError) {
            console.error(`Failed to fetch from http.cat: ${proxyError.message}`);

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Image not found on http.cat');
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
            return handleGetRequest(res, cacheFilePath, httpStatusCode);

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
