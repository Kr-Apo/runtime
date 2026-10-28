# T-840C2 — Capability matrix

This table describes the new experimental Pixi entry. Existing Legacy Pixi capabilities and tests do not widen its gate.

| Capability | Experimental graphics route | Evidence / other layers |
| --- | --- | --- |
| Native v2 / embedded atlas | Supported, qualified | Native single- and two-page exports; complete-source validation |
| Native v1 | Refused | Existing core v1 reader unchanged |
| Bone transformation clips, scalar curves | Supported, qualified on fixture | Every clip checked by B3/B4; 721 retained Rust frames and C1 cadence tests |
| Physics-only constraints and fixed schedule | Supported, qualified | Real ReplayConsumer; B3–B6 parity retained |
| No Physics constraints / mixed constraints / paths / IK | Refused | This is deliberately a narrow Physics pilot route; Legacy remains separate |
| Fixed default skin and membership | Supported, qualified | One native default skin; valid bone/constraint membership |
| Visual alternate skin switching | Refused / no API | Numerical skin scheduling exists in core B5B1; graphics integration not qualified |
| Static region attachments / setup slots / setup draw order | Supported, qualified | Shared existing region geometry, alpha, page validation and completed bone pose |
| Attachment sequences or animated slot/attachment channels | Refused | No silent setup-only fallback for animated data |
| Rigid/weighted/linked meshes, FFD | Refused | Some core/Legacy functionality exists; not qualified through ReplayV1 graphics |
| Clipping, paths, animated draw order | Refused | Historical Legacy clipping campaign does not qualify this route |
| Normal blend | Supported, qualified | Existing PMA texture/rendering conventions |
| Dark tint, other blend modes | Refused | Even a present zero dark tint field refuses; no shader work |
| Static slot color/alpha | Supported | Native RGBA setup colors; color animation refused |
| Crossfade, layers | Not implemented here, options refused | Legacy playback capabilities are separate |
| Gameplay events | Refused | No event scheduling contract added |
| Exact 120 Hz ticks and rational time | Supported, qualified | B2–B6 tests; completed-pose-only rendering |
| Pause/resume/stop/reset/replay | Supported, qualified | Existing transport delegated, contexts preserved |
| Pure seek preview | Supported, explicitly separate | Never a Physics checkpoint; explicit presentation method |
| Host `performance.now()` conversion | Example-only, experimental | Three quantization/clock tests and browser pause/resume; no distributed clock API |
| WebGL2 / installed desktop Chrome | Supported, qualified on one system | Real readPixels, transforms, vertices, lifetime, contexts |
| WebGL1 / WebGPU / Canvas | Refused | Explicit renderer gate; negative tests |
| Mobile / other GPUs / browser families | Unqualified | No compatibility claim |
| Shared pages / independent state / disposal | Supported, qualified | Borrowed/owned maps; two live owners; success/failure/abort cleanup |

Validation rejects nonfinite data, invalid identities/references/schedules and unsupported channels through the actual core validator, then invalid atlas/renderer data through shared Pixi checks. Any unsupported clip makes the asset fail before display, even if the caller selected another clip. No constraint or channel is stripped to obtain acceptance.
