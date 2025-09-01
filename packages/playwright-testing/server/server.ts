import express from 'express';
import type { Request, Response, Application } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PageRoute {
  route: string;
  file: string;
  label: string;
}

export function createApp(): Application {
  const PUBLIC_DIR = path.join(__dirname, 'public');
  const app = express();

  // Serve everything in /public as static assets
  app.use(express.static(PUBLIC_DIR));

  // Define all HTML routes in one place
  const pages: PageRoute[] = [
    { route: '/', file: 'index.html', label: 'Main page' },
    { route: '/iframe1', file: 'iframe1.html', label: 'Iframe 1' },
    { route: '/iframe2', file: 'iframe2.html', label: 'Iframe 2' },
    { route: '/nested-iframe', file: 'nested-iframe.html', label: 'Nested iframe' },
    { route: '/nav-page-1', file: 'nav-page-1.html', label: 'Navigation Test Page 1' },
    { route: '/nav-page-2', file: 'nav-page-2.html', label: 'Navigation Test Page 2' },
    { route: '/nav-page-3', file: 'nav-page-3.html', label: 'Navigation Test Page 3' },
  ];

  pages.forEach(({ route, file }) => {
    app.get(route, (req: Request, res: Response) => {
      res.sendFile(path.join(PUBLIC_DIR, file));
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).send('404: Page Not Found');
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response) => {
    console.error('Server error:', err);
    res.status(500).send('500: Internal Server Error');
  });

  return app;
}

// If this file is run directly, start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT ?? 3005;
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`🚀 Server listening at http://localhost:${PORT}`);
    const pages: Pick<PageRoute, 'route' | 'label'>[] = [
      { route: '/', label: 'Main page' },
      { route: '/iframe1', label: 'Iframe 1' },
      { route: '/iframe2', label: 'Iframe 2' },
      { route: '/nested-iframe', label: 'Nested iframe' },
    ];
    pages.forEach(({ route, label }) => {
      console.log(`📍 ${label}: http://localhost:${PORT}${route}`);
    });
  });
}
