// api/health.js — Vercel serverless function: GET /api/health
const { checkAll } = require('../lib/health.js');
const config = require('../lib/health-config.js');
const history = require('../lib/history.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');

  try {
    // Parse query params (works on both Vercel and local dev server)
    var parsedUrl = new URL(req.url, 'http://localhost');
    var envFilter = parsedUrl.searchParams.get('env') || null;
    var catFilter = parsedUrl.searchParams.get('category') || null;

    var opts = {};
    if (envFilter) opts.environment = envFilter;
    if (catFilter) opts.category = catFilter;

    var results = await checkAll(opts);

    // Build impact map: for each DOWN/DEGRADED endpoint, list cascading affected services
    var impactMap = {};
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r.status === 'DOWN' || r.status === 'DEGRADED') {
        var impacted = config.getImpactedServices(r.id);
        if (impacted.length > 0) {
          impactMap[r.id] = impacted.map(function(id) {
            var ep = config.getEndpoint(id);
            return { id: id, name: ep ? ep.name : id };
          });
        }
      }
    }

    // Record snapshot and compute history metrics
    var hist = history.loadHistory();
    hist = history.recordSnapshot(hist, results);
    history.saveHistory(hist);

    var sparklines = history.getSparklines(hist);
    var uptimes = history.getUptimes(hist);
    var incidents = history.getIncidents(hist);
    var dataPoints = hist.snapshots.length;
    var spanMinutes = dataPoints > 1
      ? Math.round((hist.snapshots[dataPoints - 1].t - hist.snapshots[0].t) / 60000)
      : 0;

    var summary = {
      timestamp: new Date().toISOString(),
      total: results.length,
      up: results.filter(function(r) { return r.status === 'UP'; }).length,
      degraded: results.filter(function(r) { return r.status === 'DEGRADED'; }).length,
      down: results.filter(function(r) { return r.status === 'DOWN'; }).length,
      environments: config.ENVIRONMENTS,
      appGroups: config.APP_GROUPS,
      dependencyGraph: config.getDependencyGraph(),
      impactMap: impactMap,
      results: results,
      history: { sparklines: sparklines, uptimes: uptimes, incidents: incidents, dataPoints: dataPoints, spanMinutes: spanMinutes },
    };
    res.status(200).json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
