#!/usr/bin/env node
'use strict';
// Local preview: builds, serves dist/ on http://localhost:3000 and rebuilds when files change.
// Run: npm run dev

const fs = require('fs');
const http = require('http');
const path = require('path');
const { build } = require('./build');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 3000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

function safeBuild() {
  try {
    build();
  } catch (e) {
    console.error('Build failed:', e.message);
  }
}
safeBuild();

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(dist, urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath);
    if (!file.startsWith(dist)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  })
  .listen(port, () => console.log(`Preview: http://localhost:${port}  (rebuilds on save)`));

let timer;
const rebuild = () => {
  clearTimeout(timer);
  timer = setTimeout(safeBuild, 150);
};
fs.watch(path.join(root, 'src'), { recursive: true }, rebuild);
fs.watch(path.join(root, 'site.config.json'), rebuild);
