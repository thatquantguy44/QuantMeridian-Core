import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import assert from 'node:assert/strict';

const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(bundle, 'evidence', name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(bundle, 'evidence', name), JSON.stringify(value, null, 2) + '\n');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const baseline = read('api-2000.json');
const main = read('api-10000.json');
assert.equal(baseline.ok, true); assert.equal(main.ok, true);
assert.deepEqual(baseline.result.fit, main.result.fit);
assert.equal(main.result.config.numPaths, 10000);
assert.equal(main.fomcAnchorApplied, false);
assert.equal(main.regimeFilter, null);
const sourcePath = path.join(bundle, 'evidence/source/src/lib/server/mcsEngine.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const { simulate } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const fit = main.result.fit;
const config = { ...main.result.config, seed: 20260914 };
for (const [api, count] of [[baseline, 2000], [main, 10000]]) {
  const reproduced = simulate(fit, { ...config, numPaths: count });
  assert.deepEqual(reproduced.horizons, api.result.horizons);
  assert.deepEqual(reproduced.currentCurve, api.result.currentCurve);
  assert.equal(reproduced.shockPoolSize, api.result.shockPoolSize);
}
// Prespecified before this script is executed: 20 consecutive seeds; primary
// diagnostic is 252-step 10Y p5/p50/p95 variability, all settings otherwise fixed.
const seeds = Array.from({ length: 20 }, (_, i) => 20260914 + i);
const runs = [];
for (const seed of seeds) {
  for (const numPaths of [2000, 10000]) {
    const result = simulate(fit, { ...config, seed, numPaths });
    runs.push({ seed, numPaths, shockPoolSize: result.shockPoolSize, horizons: result.horizons });
  }
}
const sd = values => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1));
};
const diagnostics = ['p5', 'p50', 'p95'].map(stat => {
  const series = count => runs.filter(r => r.numPaths === count).map(r => r.horizons.find(h => h.horizonDays === 252).byTenor['10'][stat]);
  return { stat, sdBps2000: sd(series(2000)) * 100, sdBps10000: sd(series(10000)) * 100 };
});
write('seed-runs.json', runs);
write('experiment-summary.json', {
  researchDate: '2026-11-01', source: 'Real local MCS API, Gold DB; no fixture or SIM fallback',
  factorAsOf: main.asOf, fitStart: fit.fitStartDate, fitEnd: fit.fitEndDate,
  fitObservations: fit.fitObservations, validFactorRowsImpliedByFit: fit.fitObservations + 1,
  shockPoolSize: main.result.shockPoolSize, lambda: fit.avgLambda,
  primaryPaths: 10000, comparisonPaths: 2000, seed: 20260914, seedSensitivity: seeds,
  anchor: 'off', regime: 'unconditional', horizons: config.checkpoints, tenors: config.tenors,
  implementationSha256: sha(source), fittedInputSha256: sha(JSON.stringify(fit)),
  reproduction: 'Both saved live API outputs reproduced exactly by the frozen platform engine at the default seed.',
  primaryTenorYears: 10, primaryHorizonSteps: 252, seedVariabilityBps: diagnostics,
  main12m10y: main.result.horizons.find(h => h.horizonDays === 252).byTenor['10'],
  main12m2y: main.result.horizons.find(h => h.horizonDays === 252).byTenor['2'],
  baseline12m10y: baseline.result.horizons.find(h => h.horizonDays === 252).byTenor['10'],
  limitation: 'Seed variability measures Monte Carlo sampling only, conditional on one fitted historical sample. No out-of-sample accuracy, parameter uncertainty, real-time backtest or tail calibration is established. The two path-count runs share the first 2000 paths at each seed.',
});
console.log(JSON.stringify({ reproduction: 'passed', seeds: seeds.length, runs: runs.length, diagnostics }, null, 2));
