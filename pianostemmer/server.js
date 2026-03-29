/**
 * Simple HTTPS Server for Piano Tuner
 * Run with: node server.js
 * Then visit: https://localhost:3000
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Generate self-signed certificate on first run
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('Generating self-signed certificate...');
    const { execSync } = require('child_process');
    try {
        execSync(`openssl req -nodes -new -x509 -keyout ${keyPath} -out ${certPath} -days 365 -subj "/CN=localhost"`, {
            stdio: 'pipe'
        });
        console.log('Certificate generated successfully!');
    } catch (error) {
        console.error('Error generating certificate. Make sure OpenSSL is installed.');
        console.error('On Windows, you can install it via: choco install openssl');
        process.exit(1);
    }
}

const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
};

const server = https.createServer(options, (req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

    // Security: prevent directory traversal
    if (!path.resolve(filePath).startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Read and serve file
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('404 - File not found');
            return;
        }

        // Set appropriate content type
        let contentType = 'text/html';
        if (filePath.endsWith('.js')) contentType = 'application/javascript';
        else if (filePath.endsWith('.css')) contentType = 'text/css';
        else if (filePath.endsWith('.json')) contentType = 'application/json';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║          Piano Tuner HTTPS Server Running                 ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  🎹 Open your browser and visit:                          ║
║     https://localhost:${PORT}                                ║
║                                                            ║
║  ⚠️  You'll see a security warning (expected for         ║
║     self-signed certificates). Click "Advanced" and       ║
║     proceed - this is safe for local development.         ║
║                                                            ║
║  Microphone access will now be available!               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
