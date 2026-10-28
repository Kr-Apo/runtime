# Event numerical contract — A5

## Existing authority

Rust `core/src/animation.rs:97` defines EventKey: f32 time, name, i32 int_value, f32 float_value, string_value, audio asset-name string, volume and balance. The editor's timeline event strip (`editor/src/ui/timeline/events.rs`) creates native event commands; schema Save/Reopen preserves fields. A2 `export/src/context.rs:1138` and its native preset export `time,name,int,float,string,audio,volume,balance`. No new native field/version is required.

`events_in_window` at Rust animation.rs:150 stable-sorts by time and collects `(from,to]`. Equal-time events retain authored vector order. Each lap collects `(0,duration]`, so t=0 never fires, including the origin. The comment claiming t=0 fired during wrap contradicts its actual predicate; predicate behavior is authority. Exact duration fires for the ending lap. Rust tests cover boundaries, chronological sorting, repeat laps, nonlooping and overshoot. A5 adds independent explicit-zero/tie/window vectors without modifying Rust.

Legacy `RigPlayer.update` stable-sorts, collects incoming clip events with double-precision delta windows and replaces a public per-update array. Outgoing crossfade clips do not emit. A pure pose/pause redraw does not emit. Legacy time accumulation, interruption and public polling are not reused or altered by A5.

## Canonical composition

Advancing candidate N owns the absolute interval `((N-1)/120,N/120]`, independent of RAF and the requested future target. Duration is recovered as the native positive finite f32, then represented as an exact binary rational. Integer arithmetic determines lap indices and local remainders. Each resulting local fragment has f32 endpoints and uses the Rust `(lo,hi]` predicate on native-f32 event times. Nonlooping windows clamp both endpoints to duration. No tick accumulation or arbitrary host delta determines event windows.

The independent reference composes the unmodified Rust `events_in_window(..., false)` across corresponding canonical lap fragments. The Rust generator uses separate f64 absolute tick/lap arithmetic for the tested ranges, then f32 endpoints; it does not copy TypeScript outputs. Rust's existing Replay consumer does not accept events: a private bone-only clip copy removes event data to obtain accepted bone/Physics frames. Event windows come from the original full author clip. No positive exported JSON is changed.

This is a documented composition of the existing Rust window function with Replay ticks, not a claim that accumulated absolute-f32 timestamps or every Legacy caller are equivalent. The short-clip vector qualifies duration 0.002 seconds, multiple laps per tick; additional vectors use 0.83 and 1.5 seconds, looping and nonlooping. The primary continuous comparison spans ticks 0..720. Arbitrary clips/horizons are not newly certified by this finite evidence.

## Boundaries and order

- Origin tick 0 has no event collection. t=0 keys remain inspectable in the source but never enqueue.
- A first positive key crossed by tick 1 emits there; a positive exact-f32 boundary belongs to its closing window only.
- Exact duration belongs to the ending lap. Next lap begins at exclusive zero.
- Stable sort uses recovered f32 time; equal-time ties preserve source index. Within a tick, delivery follows lap/time/source order.
- Several events in one tick and repeated keys across short-clip laps produce distinct occurrences. `keyIndex` is the original authored index; `ordinal` is order inside that accepted tick.
- Physics records accumulate continuously across clip laps. A loop is not a reset, epoch change or skin event.

## Admission and results

Native v2, fixed default skin, one clip, finite positive f32 duration. At most 4096 keys, bounded nonempty names and native string/audio metadata, i32 int, finite f32-compatible float, nonnegative volume, balance [-1,1]. Omitted optional native fields remain omitted; actual A2 supplies them. Native audio is a string, including empty; null/objects are refused in A5. Key times must be nonnegative and no later than native duration. Authored unsorted storage is accepted because Rust sorts; malformed/sparse event lists and unknown properties are refused. Source/payload strings are bounded to 1024 UTF16 units each. Extremely short overflowing per-tick enumeration is refused, not silently skipped.

All 721 main ticks match exact event count/order/name/payload/key/lap and accepted tick: 28 occurrences over four laps; no origin event. Four independent vectors cover another 1332 advancing windows. Existing bone limits remain linear1e-4 / translation0.01, Physics angle/angular velocity0.001 / other0.01. Max main bone-component error1.001787e-5, Physics3.340901e-6. No event-time epsilon or historical threshold was widened. Exact traces and per-tick windows are in NUMERIC.json, author-final/rust.json and event-vectors.json.
