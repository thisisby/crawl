const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad request');
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && requestUrl.pathname === '/domhtml') {
    const targetUrl = requestUrl.searchParams.get('url');
    const useBrowser = requestUrl.searchParams.get('useBrowser') === '1';

    if (!targetUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Missing "url" query parameter');
      return;
    }

    // Validate URL and protocol
    let validatedUrl;
    try {
      validatedUrl = new URL(targetUrl);
      if (!/^https?:$/.test(validatedUrl.protocol)) {
        throw new Error('Unsupported protocol');
      }
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Invalid URL');
      return;
    }

    // If browser rendering is NOT explicitly requested, fetch static HTML directly (no Chrome required)
    if (!useBrowser) {
      try {
        const response = await fetch(validatedUrl.toString(), {
          headers: {
            // Pretend to be a regular browser to avoid simplistic bot blocks
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (!response.ok) {
          throw new Error(`Fetch failed with status ${response.status}`);
        }
        const html = await response.text();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      } catch (err) {
        console.error(err);
        res.statusCode = 502;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Upstream fetch failed');
      }
      return;
    }

    let browser;
    try {
      const { default: puppeteer } = await import('puppeteer');
      const launchOptions = { headless: true };
      if (process.env.PUPPETEER_CACHE_DIR) {
        launchOptions.executablePath = process.env.PUPPETEER_CACHE_DIR;
      }
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();

      await page.goto(validatedUrl.toString());

      // Do everything that index.js did: get page.content(), log it, then get DOM outerHTML
      const html = await page.content();
      console.log(html);

      const domHTML = await page.evaluate(() => document.documentElement.outerHTML);
      console.log(domHTML);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(domHTML);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Internal server error');
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          // ignore close errors
        }
      }
    }
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
