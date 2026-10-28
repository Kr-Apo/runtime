# FFD numerical contract

## Authoritative conventions

A2 `core/src/attachment.rs::influence_range`, `skin_vertex_with_deform`, `bind_to_pose`, `animation.rs` deform sampling, and `document/src/rebind.rs` establish the author convention. Each weighted key contains **two scalar components per influence**, in vertex order then influence order. They are attachment-author-space vectors, not world-space displacements or per-vertex averages. No four-influence truncation is allowed.

For setup host world H0, influence setup world B0j, accepted influence world Bj(t), setup vertex vi, authored offset dij(t), and coefficient wj:

```
Ij = inverse(B0j) * H0
Pij(t) = Bj(t) * Ij * [vi + dij(t), 1]
Pi(t) = sum(wj * Pij(t)) / sum(wj)
```

E1 exports each influence base `lij = Ij * [vi,1]` as precise JSON coordinates. A3 therefore adds **linear(Ij) * dij** to that influence base and then calls the existing weightedPoints. Translation is not applied to an offset vector. Order, coefficients, UVs, triangles and bind data remain intact. JavaScript doubles are retained until the existing Float32 render-buffer boundary.

A vertex with no influences has no packed FFD entries and uses accepted host world times vi. A positive row may contain zero coefficients or sums different from one; all influences remain present and the actual sum normalizes it. A nonempty all-zero row is explicitly outside A3, because native fallback would take a first deform vector rather than the empty-row rule.

## Time and interpolation

The existing canonicalTime at 120Hz, clip duration and looping policy determine the time from **completed tick**, never the future requested tick or RAF time. Sampling reuses Legacy's existing vector-number interpolator (Linear, Stepped, outgoing Bezier with unchanged handles). The sample query crosses the established f32 time boundary. No Physics or FFD sampling occurs in the view. Empty/missing tracks mean zero rest offsets; otherwise every key must have the exact packed length. Before-first/after-last hold behavior remains the native/Legacy convention.

The fixture has duration 1.5s: impact tick60, Stepped boundary tick96, returned rest tick132, loop tick180. Ticks95/96/97 and179/180/181 are measured, as are nonlinear transitions. Offsets return to zero at rest; ongoing Physics need not match the initial setup pose after a loop.

## Independent Rust composition

Rust Replay B4 itself still refuses deform. The reference tool uses a private **author animation** copy containing bone timelines for the existing Rust Replay consumer, while sampling FFD from the unchanged original full author clip at the accepted Rust clip time. It installs that same consumer's accepted local/world matrices in the FFD pose, then invokes native mesh.skin_vertex_with_deform. Per-influence terms also come from native binds and those accepted matrices. Mesh FFD does not drive this fixture's Physics solver. No TypeScript value feeds the oracle; the native export and saved project retain the original full clip.

The first oracle experiment omitted reconstruction of skipped derived binds after formats::load; Rust consequently used rigid fallback. Its erroneous 1.60035 maximum comparison is retained under `NUMERIC-ORACLE-MISSING-BINDS.json`, clearly invalidated. The corrected tool calls the actual document::rebind_meshes routine, asserts bind presence and regenerates in a new directory. This corrected fixture is deterministic across two runs. No tolerance or Rust mesh equation was changed to resolve that preparation error.

Across 721 ticks: max offsets 6.899502e-6, final world vertices 2.1819012e-5, accepted world components 1.0017871e-5, Physics record components 3.340901e-6. Full per-tick nonzero differences are retained. Selected GPU proof uses the historical separate linear/translation/angle tolerances; these maxima are not a universal domain certificate.
