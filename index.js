const express = require('express');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 80;

const app = express();

app.get('/domhtml', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).type('text/plain; charset=utf-8').send('Missing "url" query parameter');
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
    res.status(400).type('text/plain; charset=utf-8').send('Invalid URL');
    return;
  }

  let browser;
  try {
    const { default: puppeteer } = await import('puppeteer');
    try {
      browser = await puppeteer.launch({ headless: true });
    } catch (launchErr) {
      if (String(launchErr).includes('Could not find Chrome')) {
        browser = await puppeteer.launch({ headless: true, channel: 'chrome' });
      } else {
        throw launchErr;
      }
    }
    const page = await browser.newPage();

    await page.goto(validatedUrl.toString());

    const html = await page.content();

    const domHTML = await page.evaluate(() => document.documentElement.outerHTML);

    res.status(200).json({ domHTML });
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain; charset=utf-8').send('Internal server error');
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // ignore close errors
      }
    }
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.use((req, res) => {
  res.status(404).type('text/plain; charset=utf-8').send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
