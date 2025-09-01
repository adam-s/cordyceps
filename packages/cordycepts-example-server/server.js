import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT ?? 3005;
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();

// Serve everything in /public as static assets
app.use(express.static(PUBLIC_DIR));

// Special handling for downloads directory with proper headers
app.use(
  '/downloads',
  (req, res, next) => {
    const fileName = path.basename(req.path);

    // Set Content-Disposition header to force download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Set appropriate MIME types
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.md': 'text/markdown',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };

    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }

    next();
  },
  express.static(path.join(PUBLIC_DIR, 'downloads'))
);

// Define all HTML routes in one place
const pages = [
  { route: '/', file: 'index.html', label: 'Main page' },
  { route: '/iframe1', file: 'iframe1.html', label: 'Iframe 1' },
  { route: '/iframe2', file: 'iframe2.html', label: 'Iframe 2' },
  { route: '/nested-iframe', file: 'nested-iframe.html', label: 'Nested iframe' },
];

pages.forEach(({ route, file }) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, file));
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('404: Page Not Found');
});

// Error handler
app.use((err, req, res) => {
  console.error('Server error:', err);
  res.status(500).send('500: Internal Server Error');
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
  pages.forEach(({ route, label }) => {
    console.log(`📍 ${label}: http://localhost:${PORT}${route}`);
  });
});
