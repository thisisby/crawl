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

    let browser;
    try {
      const { default: puppeteer } = await import('puppeteer');
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto(validatedUrl.toString());

      // Do everything that index.js did: get page.content(), log it, then get DOM outerHTML
      const html = await page.content();
      console.log(html);

      const domHTML = await page.evaluate(() => document.documentElement.outerHTML);
      console.log(domHTML);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
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
