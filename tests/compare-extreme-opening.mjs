import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('../artifacts/manual-pits-avoidance/', import.meta.url);
const baseline = JSON.parse(await readFile(new URL('extreme-opening-baseline.json', directory)));
const after = JSON.parse(await readFile(new URL('extreme-opening-after.json', directory)));
const sum = (snapshot, field) => Object.values(snapshot.classes).reduce((total, group) => total + group[field], 0);
const rows = baseline.results.map(before => {
  const current = after.results.find(result => result.seed === before.seed);
  assert.ok(current);
  assert.equal(current.holesSha256, before.holesSha256, 'The exact seeded hole layout must remain unchanged');
  assert.deepEqual(current.holes, before.holes);
  assert.ok(current.progressSnapshots[10000], `Seed ${before.seed} must actually cover the equal-distance checkpoint within 60 seconds`);
  const metrics = snapshot => ({ hits: sum(snapshot, 'potholeHits'), damage: sum(snapshot, 'totalBodyDamage'), retired: sum(snapshot, 'retired'), progress: sum(snapshot, 'progress'), grassSeconds: sum(snapshot, 'grassSeconds'), wallEpisodes: sum(snapshot, 'wallEpisodes'), collisions: snapshot.collisionCount });
  return { seed: before.seed, holes: before.holes.length, before30: metrics(before.timeSnapshots[30]), after30: metrics(current.timeSnapshots[30]), before60: metrics(before.timeSnapshots[60]), after60: metrics(current.timeSnapshots[60]), before10000m: { elapsed: before.progressSnapshots[10000].elapsed, ...metrics(before.progressSnapshots[10000]) }, after10000m: { elapsed: current.progressSnapshots[10000].elapsed, ...metrics(current.progressSnapshots[10000]) } };
});
const total = (key, field) => rows.reduce((sum, row) => sum + row[key][field], 0);
const improvement = 1 - total('after10000m', 'hits') / total('before10000m', 'hits');
const result = { baselineSource: baseline.sourceSha256, afterSource: after.sourceSha256, layoutUnchanged: true, equalProgressHitReduction: improvement, rows };
await writeFile(new URL('opening-comparison.json', directory), JSON.stringify(result, null, 2));
const report = [
  '# Extreme opening comparison', '',
  'Five predetermined seeds use untouched twenty-car grids, identical pothole positions/sizes/severity, and ordinary fixed-step AI driving. No vehicle positions, damage, clocks, laps, or random state are injected. Both classes contain ten drivers.', '',
  '| Seed | Holes | Hits at 30 s, before → after | Hits at 60 s | Retirements at 60 s | Contacts at 60 s | Field progress at 60 s (m) |',
  '| --- | ---: | --- | --- | --- | --- | --- |',
  ...rows.map(row => `| ${row.seed} | ${row.holes} | ${row.before30.hits} → ${row.after30.hits} | ${row.before60.hits} → ${row.after60.hits} | ${row.before60.retired} → ${row.after60.retired} | ${row.before60.collisions} → ${row.after60.collisions} | ${row.before60.progress.toFixed(1)} → ${row.after60.progress.toFixed(1)} |`), '',
  'Equal progress means a total of 10,000 meters of forward progress across the twenty cars, measured from their original grid positions. Every seed reaches that checkpoint within sixty seconds in both versions; simply stopping cars cannot improve this comparison.', '',
  '| Seed | Time to equal progress, before → after (s) | Wheel impacts | Sum of body damage | Retired | Contacts | Grass driving (car-seconds) | Wall episodes |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map(row => { const a = row.before10000m, b = row.after10000m; return `| ${row.seed} | ${a.elapsed.toFixed(2)} → ${b.elapsed.toFixed(2)} | ${a.hits} → ${b.hits} | ${a.damage.toFixed(3)} → ${b.damage.toFixed(3)} | ${a.retired} → ${b.retired} | ${a.collisions} → ${b.collisions} | ${a.grassSeconds.toFixed(2)} → ${b.grassSeconds.toFixed(2)} | ${a.wallEpisodes} → ${b.wallEpisodes} |`; }), '',
  `Across the equal-distance checkpoints, wheel impacts decreased by **${(improvement * 100).toFixed(1)}%**. The full JSON retains separate stock/civilian totals, all twenty cars' damage/components/positions at each checkpoint, and individual 250/500-meter exposures. These are first-minute AI measurements, not full-race completion or a universal safety guarantee.`, '',
  '[Baseline data](extreme-opening-baseline.json), [updated data](extreme-opening-after.json), [comparison data](opening-comparison.json).', '',
  `Baseline simulation SHA-256: \`${baseline.sourceSha256}\`. Updated simulation SHA-256: \`${after.sourceSha256}\`.`, '',
].join('\n');
await writeFile(new URL('OPENING-COMPARISON.md', directory), report);
console.log(JSON.stringify({ improvement, hitsBefore: total('before10000m', 'hits'), hitsAfter: total('after10000m', 'hits'), collisionsBefore: total('before10000m', 'collisions'), collisionsAfter: total('after10000m', 'collisions'), rows }));
assert.ok(improvement >= 0.2, 'Require a material reduction in hazards at equal forward progress, not just a slower clock');
