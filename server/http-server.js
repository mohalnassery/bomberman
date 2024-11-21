import express from 'express';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files with correct MIME types
app.use((req, res, next) => {
    if (req.path.endsWith('.js')) {
        res.type('application/javascript; charset=utf-8');
    }
    next();
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const networkInterface of interfaces[name]) {
            if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                return networkInterface.address;
            }
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`Game server is running on:`);
    console.log(`- Local: http://localhost:${PORT}`);
    console.log(`- Network: http://${localIP}:${PORT}`);
});
