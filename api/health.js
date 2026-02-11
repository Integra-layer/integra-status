// api/health.js — Vercel serverless function: GET /api/health
const { checkAll } = require('../lib/health.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');

  try {
    const results = await checkAll();
    const summary = {
      timestamp: new Date().toISOString(),
      total: results.length,
      up: results.filter(r => r.status === 'UP').length,
      degraded: results.filter(r => r.status === 'DEGRADED').length,
      down: results.filter(r => r.status === 'DOWN').length,
      results,
    };
    res.status(200).json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
