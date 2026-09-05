const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = __dirname;
const NOTAS_DIR = path.join(__dirname, 'Notas');
const DB_FILE = path.join(__dirname, 'notas_bd.json');

// Asegurar que la carpeta Notas exista
if (!fs.existsSync(NOTAS_DIR)) {
    fs.mkdirSync(NOTAS_DIR, { recursive: true });
}

// Tipos MIME para servidor estático
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf'
};

const server = http.createServer((req, res) => {
    // Configuración CORS bqsica
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // API: GET /api/notes - Leer notas de notas_bd.json
    if (url.pathname === '/api/notes' && req.method === 'GET') {
        try {
            if (!fs.existsSync(DB_FILE)) {
                fs.writeFileSync(DB_FILE, '[]', 'utf-8');
            }
            const data = fs.readFileSync(DB_FILE, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(data || '[]');
        } catch (err) {
            console.error('Error leyendo BD:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    // API: POST /api/notes - Guardar/actualizar nota en notas_bd.json
    if (url.pathname === '/api/notes' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const newNote = JSON.parse(body);
                let notes = [];
                if (fs.existsSync(DB_FILE)) {
                    const content = fs.readFileSync(DB_FILE, 'utf-8');
                    notes = content ? JSON.parse(content) : [];
                }

                const existingIndex = notes.findIndex(n => n.noteNumber === newNote.noteNumber);
                if (existingIndex >= 0) {
                    notes[existingIndex] = { ...notes[existingIndex], ...newNote };
                } else {
                    notes.push(newNote);
                }

                fs.writeFileSync(DB_FILE, JSON.stringify(notes, null, 2), 'utf-8');
                console.log(`[BD Actualizada] Nota ${newNote.noteNumber} guardada en notas_bd.json`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, count: notes.length, notes }));
            } catch (err) {
                console.error('Error al guardar nota en BD:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // API: POST /api/save-file - Guardar PDF o PNG directamente en la carpeta Notas/
    if (url.pathname === '/api/save-file' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { filename, data } = JSON.parse(body);
                if (!filename || !data) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Faltan parámetros filename o data' }));
                }

                // Extraer base64
                const base64Data = data.replace(/^data:[^;]+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');

                // Asegurar que el nombre no contenga subcarpetas maliciosas
                const safeFilename = path.basename(filename);
                const filePath = path.join(NOTAS_DIR, safeFilename);

                fs.writeFileSync(filePath, buffer);
                console.log(`[Archivo Guardado] ${safeFilename} guardado en la carpeta Notas/`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, path: `Notas/${safeFilename}` }));
            } catch (err) {
                console.error('Error guardando archivo:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Servidor Estático de Archivos
    let filePath = path.join(PUBLIC_DIR, decodeURIComponent(url.pathname));
    if (url.pathname === '/') {
        filePath = path.join(PUBLIC_DIR, 'nota.html');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end('<h1>404 - Archivo no encontrado</h1>');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor Dunny corriendo en http://localhost:${PORT}`);
    console.log(`Carpeta de notas: ${NOTAS_DIR}`);
    console.log(`Base de datos: ${DB_FILE}`);
});
