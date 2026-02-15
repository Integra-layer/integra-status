#!/usr/bin/env node
// Local dev server — serves public/ and handles /api/health
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

const healthHandler = require('./api/health.js');

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/health')) {
    // Wrap res to add json() helper like Vercel
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };
    return healthHandler(req, res);
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  const fullPath = path.join(PUBLIC, filePath);
  const ext = path.extname(fullPath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Integra Status Page running at http://localhost:' + PORT);
});
