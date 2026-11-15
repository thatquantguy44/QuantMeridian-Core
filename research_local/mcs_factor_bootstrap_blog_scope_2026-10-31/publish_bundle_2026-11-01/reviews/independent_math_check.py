"""Independent Python check; never imports or executes the author's JS helpers.
Run from anywhere with Python 3 and numpy. Output is written only to reviews/.
"""
import hashlib
import json
import math
import pathlib
import statistics
import time

import numpy as np

BUNDLE = pathlib.Path(__file__).resolve().parents[1]
read = lambda name: json.loads((BUNDLE / 'evidence' / name).read_text())
main = read('api-10000.json')
base = read('api-2000.json')
runs = read('seed-runs.json')
summary = read('experiment-summary.json')
assert main['ok'] and base['ok']
assert main['source'] == base['source'] == 'DB'
assert main['result']['fit'] == base['result']['fit']
assert main['result']['config']['numPaths'] == 10000
assert base['result']['config']['numPaths'] == 2000
assert not main['fomcAnchorApplied'] and not base['fomcAnchorApplied']
assert main['regimeFilter'] is base['regimeFilter'] is None
fit = main['result']['fit']
assert len(fit['residuals']) == len(fit['residualRegimes']) == fit['fitObservations'] == 2497
assert sum(fit['regimeCounts'].values()) == 2497
assert main['result']['shockPoolSize'] == base['result']['shockPoolSize'] == 2497
assert len(runs) == 40
sd_check = []
for stat in ('p5', 'p50', 'p95'):
    row = {'stat': stat}
    for count in (2000, 10000):
        sample = [r for r in runs if r['numPaths'] == count]
        assert sorted(r['seed'] for r in sample) == list(range(20260914, 20260934))
        values = [next(h for h in r['horizons'] if h['horizonDays'] == 252)['byTenor']['10'][stat] for r in sample]
        sd = statistics.stdev(values) * 100
        row[f'sdBps{count}'] = sd
        expected = next(s for s in summary['seedVariabilityBps'] if s['stat'] == stat)[f'sdBps{count}']
        assert abs(sd - expected) < 1e-12
    sd_check.append(row)
for r in runs:
    if r['seed'] == 20260914:
        assert r['horizons'] == (main if r['numPaths'] == 10000 else base)['result']['horizons']

# Independently implement the specified 32-bit Mulberry32 sequence in Python.
# Each row consumes a complete path's random stream, before the next path.
MASK = (1 << 32) - 1

def shock_indices(seed, count, steps, pool_size):
    state = seed & MASK
    draws = np.empty(count * steps, dtype=np.int32)
    for i in range(count * steps):
        state = (state + 0x6d2b79f5) & MASK
        mixed = ((state ^ (state >> 15)) * (state | 1)) & MASK
        mixed ^= (mixed + (((mixed ^ (mixed >> 7)) * (mixed | 61)) & MASK)) & MASK
        unsigned = (mixed ^ (mixed >> 14)) & MASK
        draws[i] = math.floor((unsigned / (1 << 32)) * pool_size)
    return draws.reshape(count, steps)

started = time.perf_counter()
config = main['result']['config']
steps = max(config['horizonDays'], *config['checkpoints'])
residuals = np.array(fit['residuals'])
def simulate_seed(seed):
    indices = shock_indices(seed, 10000, steps, 2497)
    factors = np.tile(fit['lastFactors'], (10000, 1))
    collected = {}
    for step in range(steps):
        current = factors
        factors = np.empty_like(current)
        for eq, (c, b0, b1, b2) in enumerate(fit['coefficients']):
            # No engine code, esbuild, JS simulator, or author helper is executed.
            factors[:, eq] = c + b0 * current[:, 0] + b1 * current[:, 1] + b2 * current[:, 2] + residuals[indices[:, step], eq]
        if step + 1 in config['checkpoints']:
            collected[step + 1] = factors.copy()
    return collected

collected = simulate_seed(20260914)

reproduction = {}
for count, api in [(2000, base), (10000, main)]:
    errors = []
    checked = 0
    output = []
    for horizon in api['result']['horizons']:
        h = horizon['horizonDays']
        f = collected[h][:count]
        by_tenor = {}
        for tenor in config['tenors']:
            x = tenor / fit['avgLambda']
            decay = math.exp(-x)
            loading = (1 - decay) / x
            yields = f[:, 0] + f[:, 1] * loading + f[:, 2] * (loading - decay)
            key = str(tenor)
            q = np.quantile(yields, [0.05, 0.25, 0.5, 0.75, 0.95], method='linear')
            values = dict(zip(('p5', 'p25', 'p50', 'p75', 'p95'), map(float, q)))
            values['mean'] = float(np.mean(yields))
            by_tenor[key] = values
            for stat, value in values.items():
                errors.append(abs(value - horizon['byTenor'][key][stat]))
                checked += 1
        output.append({'horizonDays': h, 'byTenor': by_tenor})
    current_errors = []
    for tenor in config['tenors']:
        x = tenor / fit['avgLambda']
        g = (1 - math.exp(-x)) / x
        b0, b1, b2 = fit['lastFactors']
        y = b0 + b1 * g + b2 * (g - math.exp(-x))
        current_errors.append(abs(y - api['result']['currentCurve'][str(tenor)]))
    assert max(errors) < 1e-12
    assert max(current_errors) < 1e-12
    reproduction[str(count)] = {
        'numSummaryValuesChecked': checked,
        'maxAbsSummaryErrorPercent': max(errors),
        'maxAbsCurrentCurveErrorPercent': max(current_errors),
        'horizons': output,
    }

# Independently regenerate the complete seed repetition as well as recomputing
# its sample SD from saved values. The two path counts share each seed's prefix.
seed_max_error = 0.0
seed_summary_count = 0
for seed in range(20260914, 20260934):
    saved_factors = collected if seed == 20260914 else simulate_seed(seed)
    for run in [r for r in runs if r['seed'] == seed]:
        count = run['numPaths']
        for horizon in run['horizons']:
            f = saved_factors[horizon['horizonDays']][:count]
            for tenor in config['tenors']:
                x = tenor / fit['avgLambda']
                decay = math.exp(-x)
                g = (1 - decay) / x
                yields = f[:, 0] + f[:, 1] * g + f[:, 2] * (g - decay)
                stats = dict(zip(('p5', 'p25', 'p50', 'p75', 'p95'), np.quantile(yields, [0.05, 0.25, 0.5, 0.75, 0.95], method='linear')))
                stats['mean'] = np.mean(yields)
                for stat, value in stats.items():
                    error = abs(float(value) - horizon['byTenor'][str(tenor)][stat])
                    seed_max_error = max(seed_max_error, error)
                    seed_summary_count += 1
assert seed_max_error < 1e-12

paths = [
    'article.md', 'latex_sidebar.md', 'experiment_notes.md',
    'scripts/run-experiment.mjs', 'scripts/platform-proxy.mjs',
    'evidence/api-10000.json', 'evidence/api-2000.json',
    'evidence/experiment-summary.json', 'evidence/seed-runs.json',
    'evidence/source/src/lib/server/mcsEngine.ts',
    'evidence/source/src/app/api/simulations/mcs/route.ts',
    'evidence/source/src/app/simulations/mcs/page.tsx',
    'evidence/platform-captured-response.json', 'evidence/platform-requests.jsonl',
    'evidence/platform-capture-dom.txt',
    'assets/mcs-10000-10y.jpg', 'assets/mcs-10000-2y.jpg',
    'reviews/independent_math_check.py',
]
hashes = {p: hashlib.sha256((BUNDLE / p).read_bytes()).hexdigest() for p in paths}
assert hashes['evidence/source/src/lib/server/mcsEngine.ts'] == summary['implementationSha256']
captured = read('platform-captured-response.json')
assert captured['result'] == main['result']
result = {
    'check': 'independent Python implementation and statistics.stdev, no author helpers',
    'seed': 20260914,
    'sameFit': True, 'mainPaths': 10000, 'comparisonPaths': 2000,
    'independentlyRegeneratedSeedSummaryValues': seed_summary_count,
    'maxAbsSeedSummaryErrorPercent': seed_max_error,
    'poolSize': 2497, 'seedRunCount': 40, 'seedCountPerPathSetting': 20,
    'sampleStandardDeviationsBps': sd_check,
    'fixedSeedReproduction': reproduction,
    'nestedPaths': 'The 2000-path calculation uses exactly the first 2000 rows of the 10000-path residual-index matrix; every saved baseline summary matches.',
    'captureResultMatchesMain': True,
    'elapsedSeconds': time.perf_counter() - started,
    'sha256': hashes,
}
(BUNDLE / 'reviews/independent_math_check.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('sha256','fixedSeedReproduction')}, indent=2))
print('Reproduction errors:', {k: {s:v[s] for s in ['numSummaryValuesChecked','maxAbsSummaryErrorPercent','maxAbsCurrentCurveErrorPercent']} for k,v in reproduction.items()})
