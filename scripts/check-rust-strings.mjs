// Verify the JSON consumed by the official tests comes from the live exporter.
// This check is read-only; it does not refresh the recorded fixture.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const editor = process.argv[2];
if (!editor) throw new Error('Usage: node scripts/check-rust-strings.mjs <editor-directory> [cargo-executable]');
const cargo = process.argv[3] ?? process.env.CARGO ?? 'cargo';
const result = spawnSync(cargo, [
  'run', '--quiet', '--locked', '--offline', '-p', 'ankhimate-export', '--example', 'runtime_strings_roundtrip',
], { cwd: resolve(editor), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 120_000 });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Rust JSON round-trip reference failed (${result.status}):\n${result.stderr}`);
const current = JSON.parse(result.stdout);
const recorded = JSON.parse(readFileSync(new URL('../core/test/fixtures/runtime_strings_roundtrip.json', import.meta.url), 'utf8'));
assert.deepEqual(recorded, current, 'Rust JSON fixture is stale; review the generated strings before updating it');
console.info(`Current Rust native JSON matches the recorded ${current.cases.length} round-trip cases. Run npm test to verify TypeScript.`);
