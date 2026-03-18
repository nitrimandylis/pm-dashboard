// IB Dashboard — Bun server
// Serves static files + proxies Notion API calls (keeps API key server-side)
//
// Usage: NOTION_API_KEY=secret_... bun server.js
//   or:  cp .env.example .env && bun server.js  (bun auto-loads .env)

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const PORT = Number(process.env.PORT) || 8080;

if (!NOTION_API_KEY) {
  console.warn('⚠  NOTION_API_KEY not set — Notion sync will not work.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
};

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // ── Notion API proxy ──────────────────────────────────────────────────
    if (url.pathname.startsWith('/api/notion/')) {
      if (!NOTION_API_KEY) {
        return json({ error: 'NOTION_API_KEY not configured on server' }, 500);
      }
      const notionPath = url.pathname.replace('/api/notion', '');
      const notionUrl  = `https://api.notion.com/v1${notionPath}${url.search}`;
      const body       = req.method !== 'GET' ? await req.text() : undefined;

      const upstream = await fetch(notionUrl, {
        method:  req.method,
        headers: {
          Authorization:    `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type':   'application/json',
        },
        body,
      });

      const text = await upstream.text();
      return new Response(text, {
        status:  upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Static files ──────────────────────────────────────────────────────
    let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const ext    = pathname.slice(pathname.lastIndexOf('.'));

    try {
      const file = Bun.file(import.meta.dir + pathname);
      if (!(await file.exists())) throw new Error('not found');
      return new Response(file, {
        headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
      });
    } catch {
      // SPA fallback
      return new Response(Bun.file(import.meta.dir + '/index.html'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  },
});

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

console.log(`IB Dashboard → http://localhost:${PORT}`);
