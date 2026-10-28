# Reproducing C6A locally

Use fresh output directories; the drivers refuse to overwrite existing campaign evidence. Runtime C5B parent is c3454f329d865373dd3515596348c8961e947c26; native Editor is275082e8f26d42389ed05fb92c45e2822006525d. Node24.18, TypeScript5.9.3, Pixi8.17, Playwright1.58.2 and Chrome156 were used. Install exact npm lockfile dependencies, then build. Set ANKHIMATE_BROWSER_PATH for another Chrome path; such a run is a new environment, not accepted historical evidence.

From the Runtime root:

```powershell
npm run build
npm run typecheck
npm test
node scripts/t840c6a/qualify.mjs NEW_OUTPUT
node scripts/t840c6a/safety.mjs NEW_OUTPUT
node scripts/t840c6a/consumer.mjs NEW_OUTPUT
node scripts/t840c6a/measure.mjs NEW_OUTPUT RUNTIME_ROOT visual
node scripts/t840c6a/memory.mjs NEW_OUTPUT RUNTIME_ROOT
node scripts/t840c6a/endurance.mjs NEW_OUTPUT
```

The external consumer compiles a separate project with public package imports/types and runs real WebGL2. Temporary dependency junction pointers are detached afterwards. No internal dist imports in consumer source.

Measure an independently archived/built C5B source and current source with mode fixed and identical old one-skin fixtures. Both run the same720 exact ticks/counts1,5,10,25. C6_COUNTS=25 repeats the25actor workloads; run C5B/current/current/C5B order for the repeat control. New multi-skin visual workloads have no equivalent C5B implementation: report their cost separately, never strip skins from native JSON for a fake baseline. Allocation/GC profiling is a separate intrusive run, not latency evidence.

Native helper: keep the unchanged Editor checkpoint in sibling directory editor. Rust1.95, offline/locked, existing native dependencies only. Do not run formatting on the Editor. The standalone helper under native/ uses normal Save/Reload/export APIs and Rust ReplayConsumerBridge. `cargo +1.95 fmt --manifest-path scripts/t840c6a/native/Cargo.toml --check` checks only this helper. The checked-in healthy authors and delivered fault authors are inputs; no runtimeJSON edit is involved.

```powershell
python scripts/t840c6a/create-authors.py NEW_AUTHOR_ROOT
python scripts/t840c6a/native-export.py NEW_NATIVE_ROOT NEW_AUTHOR_ROOT/authors
```

The deterministic Pillow recipe redraws primitive assets and produces both healthy/fault author sources. Native-export uses the checked-in healthy author inputs and the supplied generated fault author inputs, captures logs and writes hashes. CARGO_TARGET_DIR may point to an existing external shared cache. Regenerated native exports/ref JSON/PNGs and saved projects must match the delivered bytes. Do not overwrite accepted fixtures or sealed outputs.

Historic commands are retained in scripts/t840c5a and scripts/t840c5b. B3/B4/B5A/B5B1/B5B2/B6 compare scripts use accepted native reference folders; scripts/t840c3/vectors.mjs checks5968 host-time vectors. Expected196 Legacy failures must be compared by signatures, not converted into a green suite. No full Rust workspace rerun or new WASM qualification is claimed because Editor/core are unchanged. [Contract](../../docs/t840c6a/T840C6A-SKIN-CONTRACT.md).
