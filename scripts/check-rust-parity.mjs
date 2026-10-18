// Check that the fixture used by the official TS tests comes from the current
// editor's real exporter/evaluator. No snapshot or source is rewritten.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const editor = process.argv[2];
if (!editor) throw new Error('Usage: node scripts/check-rust-parity.mjs <editor-directory> [cargo-executable]');
const cargo = process.argv[3] ?? process.env.CARGO ?? 'cargo';
const result = spawnSync(cargo, [
  'run', '--quiet', '--locked', '--offline', '-p', 'ankhimate-export', '--example', 'runtime_axes_parity',
], { cwd: resolve(editor), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 120_000 });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Rust parity reference failed (${result.status}):\n${result.stderr}`);
const current = JSON.parse(result.stdout);
const recorded = JSON.parse(readFileSync(new URL('../core/test/fixtures/runtime_axes_parity.json', import.meta.url), 'utf8'));
assert.deepEqual(recorded, current, 'Rust parity snapshot is stale; regenerate it with the editor example and review the differences');
console.info(`Current Rust exporter/evaluator matches the recorded ${current.cases.length} parity cases. Run npm test to compare TypeScript.`);
