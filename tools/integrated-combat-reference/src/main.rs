//! Independent native author/sampler/local blend and single continuous B6 Physics reference.
use ankhimate_core::{
    animation::{Axis, Interp, Key, Timeline},
    assets::ImageAsset,
    attachment::{Attachment, Rect, RegionAttachment},
    math::Transform,
    pose::{self, Pose},
    replay_animation::canonical_time,
    replay_physics::{ReplayInputs, ReplayPhysicsInstance},
    slot::Slot,
};
use ankhimate_document::Document;
use serde_json::json;
use std::{fs, path::PathBuf};
mod fixture {
    include!("../../crossfade-reference/src/support/linked_frog.rs");
}
#[derive(Clone, Copy)]
struct Cmd {
    request: u64,
    to: &'static str,
    duration: u64,
    incoming: u64,
    interrupt: bool,
}
fn gate_a() -> bool {
    std::env::args().nth(2).as_deref() == Some("gate-a")
}
fn commands() -> Vec<Cmd> {
    let rows = match std::env::args().nth(2).as_deref() {
        Some("gate-a") => vec![
            (60, "Attack", 48, 0, false),
            (180, "Idle", 48, 160, false),
            (420, "Attack", 24, 24, false),
            (540, "Idle", 24, 0, false),
            (900, "Hit", 12, 0, false),
            (1020, "Idle", 24, 0, false),
            (1140, "Death", 24, 0, false),
        ],
        Some("single") => vec![
            (60, "Attack", 96, 0, false),
            (73, "Hit", 48, 0, true),
            (180, "Idle", 48, 160, false),
            (420, "Attack", 48, 0, false),
            (540, "Idle", 24, 0, false),
            (900, "Death", 24, 0, false),
        ],
        _ => vec![
            (60, "Attack", 96, 0, false),
            (90, "Hit", 48, 0, true),
            (98, "Death", 36, 0, true),
            (180, "Idle", 48, 160, false),
            (420, "Attack", 96, 0, false),
            (480, "Hit", 24, 0, true),
            (488, "Death", 48, 0, true),
            (600, "Idle", 48, 0, false),
            (900, "Attack", 96, 0, false),
            (912, "Hit", 48, 0, true),
            (920, "Death", 36, 0, true),
            (1080, "Idle", 24, 160, false),
        ],
    };
    rows.into_iter()
        .map(|(request, to, duration, incoming, interrupt)| Cmd {
            request,
            to,
            duration,
            incoming,
            interrupt,
        })
        .collect()
}

fn author_events(d: &mut Document) {
    use ankhimate_core::animation::EventKey;
    for a in d.animations.values_mut() {
        let mut add = |time: f32, name: &str, index: i32| {
            a.events.push(EventKey {
                time,
                name: name.into(),
                int_value: index,
                float_value: index as f32 * 0.25,
                string_value: if index == 2 {
                    "eye_left".into()
                } else {
                    "native payload \" \\ Ω\n".into()
                },
                audio: if index == 1 {
                    "marker-only.ogg".into()
                } else {
                    String::new()
                },
                volume: 0.75,
                balance: -0.25,
            })
        };
        match a.name.as_str() {
            "Idle" => {
                add(0., "idle_zero", 0);
                add(0.05, "idle_early", 1);
                add(0.25, "idle_pulse", 2);
                add(0.25, "idle_second", 3);
                add(0.6, "idle_expression", 4);
                add(1.4, "idle_near_loop", 5);
                add(1.5, "idle_end", 6);
            }
            "Attack" => {
                add(0.4, "attack_recover", 4);
                add(0., "attack_zero", 0);
                add(0.2, "attack_impact", 2);
                add(0.05, "attack_prepare", 1);
                add(0.2, "attack_impact_echo", 3);
                add(49. / 120., "attack_after", 5);
                add(0.82, "attack_near_end", 6);
                add(11. / 120., "attack_expression", 7);
            }
            "Hit" => {
                add(0., "hit_zero", 0);
                add(1. / 120., "hit_react", 1);
                add(0.2, "hit_after", 2);
                add(0.65, "hit_end", 3);
            }
            "Death" => {
                add(0., "death_zero", 0);
                add(1. / 120., "death_start", 1);
                add(0.6, "death_expression", 2);
                add(1.17, "death_end", 3);
            }
            _ => panic!(),
        }
    }
}
fn event_owner(m: &serde_json::Value) -> (String, u64) {
    let tr = &m["transition"];
    if tr["status"] == "active" {
        (
            tr["to"].as_str().unwrap().into(),
            tr["toTick"].as_str().unwrap().parse().unwrap(),
        )
    } else {
        (
            m["activeClip"].as_str().unwrap().into(),
            m["activeTick"].as_str().unwrap().parse().unwrap(),
        )
    }
}
fn event_window(d: &Document, m: &serde_json::Value) -> Vec<serde_json::Value> {
    let tick = m["tick"].as_str().unwrap().parse::<u64>().unwrap();
    if tick == 0 || m["transition"]["startTick"] == m["tick"] {
        return vec![];
    }
    let (owner, local) = event_owner(m);
    assert!(local > 0);
    let a = d.animations.values().find(|a| a.name == owner).unwrap();
    let duration = f64::from(a.duration);
    let from = (local - 1) as f64 / 120.;
    let to = local as f64 / 120.;
    let first = if a.looping {
        (from / duration).floor() as u64
    } else {
        0
    };
    let last = if a.looping {
        (to / duration).floor() as u64
    } else {
        0
    };
    let mut result = vec![];
    for lap in first..=last {
        let lo = (from - lap as f64 * duration).clamp(0., duration) as f32;
        let hi = (to - lap as f64 * duration).clamp(0., duration) as f32;
        let mut used = vec![false; a.events.len()];
        for e in ankhimate_core::animation::events_in_window(a, lo, hi, false) {
            let i = a
                .events
                .iter()
                .enumerate()
                .position(|(i, v)| !used[i] && *v == e)
                .unwrap();
            used[i] = true;
            result.push(json!({"clip":owner,"clipTick":local.to_string(),"clipTime":time(d,&owner,local),"tick":tick.to_string(),"lap":lap.to_string(),"keyIndex":i,"ordinal":result.len(),"event":{"time":e.time,"name":e.name,"int":e.int_value,"float":e.float_value,"string":e.string_value,"audio":e.audio,"volume":e.volume,"balance":e.balance}}));
        }
    }
    result
}
fn view(d: &Document) -> ankhimate_formats::ProjectRef<'_> {
    ankhimate_formats::ProjectRef {
        skeleton: &d.skeleton,
        animations: &d.animations,
        animation_order: &[],
        assets: &d.assets,
        name: &d.meta.name,
        fps: d.meta.fps,
        export_presets: &d.export_presets,
        psd_layer_paths: &d.psd_layer_paths,
    }
}
fn keys(duration: f32, values: [f32; 4]) -> Vec<Key<f32>> {
    values
        .into_iter()
        .enumerate()
        .map(|(i, value)| Key {
            time: [0., duration * 0.3, duration * 0.6, duration][i],
            value,
            interp: match i {
                1 => Interp::Bezier {
                    out_handle: glam::vec2(0.2, 0.),
                    in_handle: glam::vec2(0.8, 1.),
                },
                2 => Interp::Stepped,
                _ => Interp::Linear,
            },
        })
        .collect()
}
fn author() -> Document {
    let mut d = fixture::fixture();
    fixture::flag(&mut d, true);
    assert!(!fixture::pose(&d, 0.).locals.is_empty());
    d.meta.name = "Combat Frog Integrated".into();
    let skin = &mut d.skeleton.skins[d.skeleton.default_skin];
    skin.entries
        .retain(|_, a| !matches!(a,Attachment::Mesh(m)if m.linked.is_some()));
    for slot in d.skeleton.slots.values_mut() {
        slot.attachment = Some(
            match slot.name.as_str() {
                "body" => "body",
                "cape" => "cape",
                "badge" => "sun",
                "after" => "star",
                _ => panic!(),
            }
            .into(),
        );
    }
    let template = d.animations.values().next().unwrap().clone();
    d.animations.clear();
    for (name, duration, looping, factor) in [
        ("Idle", 1.5, true, 1.),
        ("Attack", 0.83, false, 3.),
        ("Hit", 0.65, false, -2.),
        ("Death", 1.17, false, -4.),
    ] {
        let mut a = template.clone();
        a.name = name.into();
        a.duration = duration;
        a.looping = looping;
        a.events.clear();
        a.timelines.clear();
        for (i, (bone, _)) in d.skeleton.bones.iter().enumerate() {
            let values = if i == 5 {
                if name == "Attack" {
                    [-170., -175., 175., -170.]
                } else {
                    [170., 175., -175., 170.]
                }
            } else {
                [
                    0.,
                    (i + 1) as f32 * 2. * factor,
                    -((i + 1) as f32) * factor,
                    0.,
                ]
            };
            a.timelines.push(Timeline::BoneRotate {
                bone,
                keys: keys(duration, values),
            });
        }
        let root = d
            .skeleton
            .bones
            .iter()
            .find(|(_, b)| b.name == "root")
            .unwrap()
            .0;
        let b0 = d
            .skeleton
            .bones
            .iter()
            .find(|(_, b)| b.name == "b0")
            .unwrap()
            .0;
        for (axis, values) in [
            (Axis::X, [0., 5. * factor, -2. * factor, 0.]),
            (Axis::Y, [0., 2. * factor, -factor, 0.]),
        ] {
            a.timelines.push(Timeline::BoneTranslate {
                bone: root,
                axis,
                keys: keys(duration, values),
            });
        }
        a.timelines.push(Timeline::BoneScale {
            bone: root,
            axis: Axis::X,
            keys: keys(duration, [1., 1.15, 0.9, 1.]),
        });
        a.timelines.push(Timeline::BoneScale {
            bone: b0,
            axis: Axis::Y,
            keys: keys(duration, [1., 0.85, 1.2, 1.]),
        });
        a.timelines.push(Timeline::BoneShear {
            bone: b0,
            axis: Axis::Y,
            keys: keys(duration, [0., 2. * factor, -factor, 0.]),
        });
        d.animations.insert(a);
    }
    let slot = d
        .skeleton
        .slots
        .iter()
        .find(|(_, s)| s.name == "body")
        .unwrap()
        .0;
    let Attachment::Mesh(mesh) = d.skeleton.skins[d.skeleton.default_skin]
        .get(slot, "body")
        .unwrap()
    else {
        panic!()
    };
    let influences = mesh.weights.iter().map(Vec::len).sum::<usize>();
    assert!(influences > 4);
    assert!(
        !fixture::independent(&d, &fixture::pose(&d, 0.), slot, "body", "body", 0.)
            .0
            .is_empty()
    );
    for a in d.animations.values_mut() {
        if a.name == "Hit" {
            continue;
        }
        let factor = match a.name.as_str() {
            "Idle" => 1.,
            "Attack" => 3.,
            _ => -2.,
        };
        let keys = (0..4)
            .map(|i| Key {
                time: [0., a.duration * 0.3, a.duration * 0.6, a.duration][i],
                value: (0..influences)
                    .map(|j| {
                        let gain = [0.2, 1., -0.4, 0.2][i] * factor;
                        glam::vec2(
                            ((j % 3) as f32 - 1.) * 2.5 * gain,
                            ((j % 4) as f32 + 1.) * 2. * gain,
                        )
                    })
                    .collect(),
                interp: match i {
                    1 => Interp::Bezier {
                        out_handle: glam::vec2(0.2, -0.1),
                        in_handle: glam::vec2(0.8, 1.1),
                    },
                    2 => Interp::Stepped,
                    _ => Interp::Linear,
                },
            })
            .collect();
        a.timelines.push(Timeline::Deform {
            slot,
            attachment: "body".into(),
            keys,
        });
    }
    expressions(&mut d);
    author_events(&mut d);
    ankhimate_document::rebind::rebind_meshes(&mut d);
    d
}
fn expressions(d: &mut Document) {
    use image::{ImageFormat, Rgba, RgbaImage};
    for name in ["eyes_open", "eyes_closed", "mouth_smile", "mouth_hurt"] {
        let mut image = RgbaImage::new(20, 12);
        for (x, y, p) in image.enumerate_pixels_mut() {
            let xx = x as f32 - 9.5;
            let yy = y as f32 - 5.5;
            *p = if name == "eyes_open" || name == "mouth_smile" {
                if xx * xx / 81. + yy * yy / 25. < 1. {
                    if xx * xx + yy * yy < 8. {
                        Rgba([8, 20, 28, 255])
                    } else {
                        Rgba([245, 245, 210, 245])
                    }
                } else {
                    Rgba([0, 0, 0, 0])
                }
            } else if (3..=16).contains(&x) && (5..=7).contains(&y) {
                Rgba([8, 20, 28, 255])
            } else {
                Rgba([0, 0, 0, 0])
            };
        }
        let mut bytes = std::io::Cursor::new(vec![]);
        image.write_to(&mut bytes, ImageFormat::Png).unwrap();
        d.assets
            .add(ImageAsset::new(name, bytes.into_inner(), 20, 12));
    }
    let root = d
        .skeleton
        .bones
        .iter()
        .find(|(_, b)| b.name == "root")
        .unwrap()
        .0;
    for (name, x) in [("eye_left", -8.), ("eye_right", 7.), ("mouth", 0.)] {
        let mut slot = Slot::new(name.into(), root);
        slot.attachment = Some("open".into());
        let id = d.skeleton.slots.insert(slot);
        d.skeleton.draw_order.push(id);
        for (attachment, texture) in [("open", "eyes_open"), ("closed", "eyes_closed")] {
            d.skeleton.skins[d.skeleton.default_skin].entries.insert(
                (id, attachment.into()),
                Attachment::Region(RegionAttachment {
                    texture: (if name == "mouth" {
                        if attachment == "open" {
                            "mouth_smile"
                        } else {
                            "mouth_hurt"
                        }
                    } else {
                        texture
                    })
                    .into(),
                    local_offset: glam::vec2(x, if name == "mouth" { 3. } else { 16. }),
                    local_rotation: 0.,
                    local_scale: glam::Vec2::ONE,
                    width: 15.,
                    height: 9.,
                    uv_rect: Rect {
                        x: 0.,
                        y: 0.,
                        w: 1.,
                        h: 1.,
                    },
                    pivot: glam::Vec2::splat(0.5),
                    sequence: None,
                }),
            );
        }
    }
    let ids = |name: &str| {
        d.skeleton
            .slots
            .iter()
            .find(|(_, s)| s.name == name)
            .unwrap()
            .0
    };
    let body = ids("body");
    let badge = ids("badge");
    let after = ids("after");
    let eyes = [ids("eye_left"), ids("eye_right"), ids("mouth")];
    // Genuine alternate attachment, different texture, page and dimensions.
    let original = d.skeleton.skins[d.skeleton.default_skin]
        .get(badge, "sun")
        .unwrap()
        .clone();
    let mut alternate = original;
    if let Attachment::Region(v) = &mut alternate {
        v.texture = "moon".into();
        v.width = 48.;
        v.height = 80.;
    } else {
        panic!();
    }
    d.skeleton.skins[d.skeleton.default_skin]
        .entries
        .insert((badge, "moon".into()), alternate);
    for a in d.animations.values_mut() {
        let hurt = a.name == "Hit" || a.name == "Death";
        let mut colors = if hurt {
            [
                [1., 0.3, 0.25, 1.],
                [0.7, 0.2, 0.5, 0.6],
                [1., 0.6, 0.4, 0.8],
                [0.6, 0.8, 1., 0.5],
            ]
        } else {
            [
                [0.65, 1., 0.8, 0.85],
                [1., 0.8, 0.4, 1.],
                [0.4, 0.8, 1., 0.7],
                [0.65, 1., 0.8, 0.85],
            ]
        };
        if a.name == "Death" {
            colors[3][3] = 0.4;
        }
        let mut keys: Vec<_> = colors
            .into_iter()
            .enumerate()
            .map(|(i, value)| Key {
                time: [0., a.duration * 0.3, a.duration * 0.6, a.duration][i],
                value,
                interp: match i {
                    1 => Interp::Bezier {
                        out_handle: glam::vec2(0.2, 0.),
                        in_handle: glam::vec2(0.8, 1.),
                    },
                    2 => Interp::Stepped,
                    _ => Interp::Linear,
                },
            })
            .collect();
        a.timelines.push(Timeline::SlotColor {
            slot: body,
            keys: std::mem::take(&mut keys),
        });
        for eye in eyes {
            a.timelines.push(Timeline::SlotAttachment {
                slot: eye,
                keys: vec![
                    Key {
                        time: 0.,
                        value: Some(if hurt { "closed" } else { "open" }.into()),
                        interp: Interp::Stepped,
                    },
                    Key {
                        time: 0.6_f32.min(a.duration * 0.8),
                        value: Some(if hurt { "open" } else { "closed" }.into()),
                        interp: Interp::Stepped,
                    },
                ],
            });
        }
        a.timelines.push(Timeline::SlotAttachment {
            slot: badge,
            keys: vec![
                Key {
                    time: 0.,
                    value: Some(if hurt { "moon" } else { "sun" }.into()),
                    interp: Interp::Stepped,
                },
                Key {
                    time: a.duration * 0.5,
                    value: None,
                    interp: Interp::Stepped,
                },
                Key {
                    time: a.duration * 0.7,
                    value: Some(if hurt { "sun" } else { "moon" }.into()),
                    interp: Interp::Stepped,
                },
            ],
        });
        a.timelines.push(Timeline::SlotVisible {
            slot: after,
            keys: vec![
                Key {
                    time: 0.,
                    value: !hurt,
                    interp: Interp::Stepped,
                },
                Key {
                    time: a.duration * 0.4,
                    value: hurt,
                    interp: Interp::Stepped,
                },
            ],
        });
        a.timelines.push(Timeline::DrawOrder {
            keys: vec![
                Key {
                    time: a.duration * 0.25,
                    value: vec![(badge, 3)],
                    interp: Interp::Stepped,
                },
                Key {
                    time: a.duration * 0.75,
                    value: vec![],
                    interp: Interp::Stepped,
                },
            ],
        });
    }
}
fn native_slots(d: &Document, clip_name: &str, t: f32) -> serde_json::Value {
    let p = sample(d, clip_name, t);
    json!({"slots":d.skeleton.slots.iter().map(|(id,s)|{let a=p.attachment_name(&d.skeleton,id);json!({"name":s.name,"owner":a.map(|_|"default"),"attachment":a,"visible":p.slot_visible.get(id).copied().unwrap_or(true),"color":p.slot_colors[id]})}).collect::<Vec<_>>(),"drawOrder":p.draw_order.iter().map(|id|&d.skeleton.slots[*id].name).collect::<Vec<_>>()})
}
fn slot_state(
    d: &Document,
    m: &serde_json::Value,
    captures: &std::collections::BTreeMap<u64, serde_json::Value>,
) -> serde_json::Value {
    let tr = &m["transition"];
    let mut result = native_slots(
        d,
        m["activeClip"].as_str().unwrap(),
        m["activeTime"].as_f64().unwrap() as f32,
    );
    if tr["status"] == "active" {
        if !tr["source"].is_null() {
            result = captures[&tr["source"]["tick"]
                .as_str()
                .unwrap()
                .parse::<u64>()
                .unwrap()]
                .clone();
        }
        let target = native_slots(
            d,
            tr["to"].as_str().unwrap(),
            tr["toTime"].as_f64().unwrap() as f32,
        );
        let w = tr["weight"].as_f64().unwrap();
        for (i, v) in result["slots"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .enumerate()
        {
            for k in 0..4 {
                let a = v["color"][k].as_f64().unwrap();
                let b = target["slots"][i]["color"][k].as_f64().unwrap();
                let mixed = if w == 0. {
                    a
                } else if w == 1. {
                    b
                } else {
                    a + (b - a) * w
                };
                assert!((0.0..=1.0).contains(&mixed));
                v["color"][k] = json!(mixed as f32);
            }
        }
    }
    result["kind"] = json!("animated-slots/v1");
    result["tick"] = m["tick"].clone();
    result["clip"] = m["activeClip"].clone();
    result["skin"] = json!("default");
    result
}
fn clip<'a>(d: &'a Document, name: &str) -> &'a ankhimate_core::animation::Animation {
    d.animations.values().find(|a| a.name == name).unwrap()
}
fn time(d: &Document, name: &str, t: u64) -> f32 {
    let a = clip(d, name);
    canonical_time(t, a.duration, a.looping).unwrap()
}
fn state(
    d: &Document,
    t: u64,
    origins: &std::collections::BTreeMap<u64, serde_json::Value>,
) -> serde_json::Value {
    let cmds = commands();
    let mut active = "Idle";
    let mut anchor = 0_i64;
    let mut last = serde_json::Value::Null;
    for (index, c) in cmds.iter().enumerate() {
        let start = c.request + 1;
        if t < start {
            break;
        }
        let elapsed = (t - start).min(c.duration);
        let source = origins.get(&c.request).filter(|_| c.interrupt);
        let from = source
            .map(|v| v["clip"].as_str().unwrap())
            .unwrap_or(active);
        let from_tick = source
            .map(|v| v["clipTick"].as_str().unwrap().parse::<u64>().unwrap())
            .unwrap_or(((start + elapsed) as i64 - anchor) as u64);
        let to_tick = c.incoming + elapsed;
        last = json!({"requestedTick":c.request.to_string(),"startTick":start.to_string(),"durationTicks":c.duration.to_string(),"from":from,"to":c.to,"fromTick":from_tick.to_string(),"toTick":to_tick.to_string(),"fromTime":time(d,from,from_tick),"toTime":time(d,c.to,to_tick),"elapsedTicks":elapsed.to_string(),"weight":(elapsed as f64/c.duration as f64)as f32,"status":if elapsed==c.duration{"complete"}else{"active"}});
        if let Some(source) = source {
            last["source"] = source.clone();
        }
        if elapsed < c.duration {
            if cmds.get(index + 1).is_some_and(|next| next.request < t) {
                continue;
            }
            let local = source
                .map(|v| v["clipTick"].as_str().unwrap().parse::<u64>().unwrap())
                .unwrap_or((t as i64 - anchor) as u64);
            return json!({"kind":if gate_a(){"integrated-crossfade/v1"}else{"interruptible-integrated-crossfade/v1"},"tick":t.to_string(),"activeClip":from,"activeTick":local.to_string(),"activeTime":time(d,from,local),"transition":last});
        }
        active = c.to;
        anchor = start as i64 - c.incoming as i64;
    }
    json!({"kind":if gate_a(){"integrated-crossfade/v1"}else{"interruptible-integrated-crossfade/v1"},"tick":t.to_string(),"activeClip":active,"activeTick":(t as i64-anchor).to_string(),"activeTime":time(d,active,(t as i64-anchor)as u64),"transition":last})
}
fn sample(d: &Document, name: &str, t: f32) -> Pose {
    let mut s = d.skeleton.clone();
    s.constraint_order.clear();
    let mut p = Pose::new();
    pose::evaluate(&s, &[(clip(d, name), t, 1.)], &mut p);
    p
}
fn shortest(delta: f64) -> f64 {
    let mut v = delta % (2. * std::f64::consts::PI);
    if (v.abs() - std::f64::consts::PI).abs() <= 2_f64.powi(-20) {
        return v.signum() * std::f64::consts::PI;
    }
    if v > std::f64::consts::PI {
        v -= 2. * std::f64::consts::PI;
    }
    if v < -std::f64::consts::PI {
        v += 2. * std::f64::consts::PI;
    }
    v
}
fn inputs(
    d: &Document,
    st: &serde_json::Value,
    captures: &std::collections::BTreeMap<u64, ReplayInputs>,
) -> ReplayInputs {
    let mut a = sample(
        d,
        st["activeClip"].as_str().unwrap(),
        st["activeTime"].as_f64().unwrap() as f32,
    );
    let tr = &st["transition"];
    if tr["status"] == "active" && !tr["source"].is_null() {
        let key = tr["source"]["tick"]
            .as_str()
            .unwrap()
            .parse::<u64>()
            .unwrap();
        for (id, local) in &captures[&key] {
            a.locals[*id] = *local;
        }
    }
    let incoming = if tr["status"] == "active" {
        Some(sample(
            d,
            tr["to"].as_str().unwrap(),
            tr["toTime"].as_f64().unwrap() as f32,
        ))
    } else {
        None
    };
    let weight = tr["weight"].as_f64().unwrap_or(0.);
    d.skeleton
        .bones
        .keys()
        .map(|id| {
            let x = a.locals[id];
            let out = if let Some(b) = &incoming {
                let y = b.locals[id];
                let lerp = |a: f32, b: f32| {
                    if weight == 0. {
                        a
                    } else if weight == 1. {
                        b
                    } else {
                        (f64::from(a) + (f64::from(b) - f64::from(a)) * weight) as f32
                    }
                };
                Transform {
                    position: glam::vec2(
                        lerp(x.position.x, y.position.x),
                        lerp(x.position.y, y.position.y),
                    ),
                    rotation: if weight == 0. {
                        x.rotation
                    } else {
                        (f64::from(x.rotation)
                            + shortest(f64::from(y.rotation) - f64::from(x.rotation)) * weight)
                            as f32
                    },
                    scale: glam::vec2(lerp(x.scale.x, y.scale.x), lerp(x.scale.y, y.scale.y)),
                    shear: glam::vec2(lerp(x.shear.x, y.shear.x), lerp(x.shear.y, y.shear.y)),
                }
            } else {
                x
            };
            assert!(out.scale.min_element() > 1e-6);
            (id, out)
        })
        .collect()
}
fn bones(d: &Document, p: &Pose) -> Vec<serde_json::Value> {
    d.skeleton.bones.iter().map(|(id,b)|{let v=p.locals[id];let w=p.world(id);json!({"name":b.name,"local":[v.position.x,v.position.y,v.rotation,v.scale.x,v.scale.y,v.shear.x,v.shear.y],"world":[w.a,w.b,w.c,w.d,w.tx,w.ty]})}).collect()
}
mod native;
fn main() {
    let out = PathBuf::from(std::env::args().nth(1).expect("NEW_OUTPUT"));
    fs::create_dir(&out).expect("refuse existing output");
    if std::env::args().nth(2).as_deref() == Some("vectors") {
        write_vectors(&out);
        return;
    }
    let d = author();
    let schema = ankhimate_formats::convert::to_schema(&view(&d));
    ankhimate_formats::save(&out.join("Combat-Frog.ankh"), &view(&d), &[]).unwrap();
    let (loaded, _) = ankhimate_formats::load(&out.join("Combat-Frog.ankh")).unwrap();
    let mut d = Document::from_loaded(loaded);
    ankhimate_document::rebind::rebind_meshes(&mut d);
    assert_eq!(schema, ankhimate_formats::convert::to_schema(&view(&d)));
    fs::write(
        out.join("author.json"),
        serde_json::to_vec_pretty(&schema).unwrap(),
    )
    .unwrap();
    let mut preset = ankhimate_export::presets::default_preset();
    preset.atlas.settings.trim = false;
    preset.atlas.settings.max_page = 96;
    let plan = ankhimate_export::run::plan(&schema, &d.assets, &preset).unwrap();
    ankhimate_export::run::write(&plan, &out.join("native")).unwrap();
    fs::create_dir(out.join("source")).unwrap();
    for a in d.assets.images.values() {
        fs::write(out.join("source").join(format!("{}.png", a.name)), &a.bytes).unwrap();
    }
    let native: serde_json::Value =
        serde_json::from_slice(&fs::read(out.join("native/skeleton.json")).unwrap()).unwrap();
    assert_eq!(native["format_version"], 2);
    assert_eq!(
        native["animations"].as_object().unwrap().len(),
        d.animations.len()
    );
    for a in d.animations.values() {
        assert_eq!(
            native["animations"][&a.name]["events"]
                .as_array()
                .unwrap()
                .len(),
            a.events.len()
        );
    }
    fs::write(out.join("export-read-receipt.json"), serde_json::to_vec_pretty(&json!({"native_v2":true,"clips":native["animations"].as_object().unwrap().keys().collect::<Vec<_>>(),"source":"actual Save/Reopen native publication; all bone, slot, FFD, drawOrder and event clips read back into native timelines before independent evaluation"})).unwrap()).unwrap();
    let authored_reference = reference(&d);
    native::read(&mut d, &native);
    let mut reference = reference(&d);
    assert_eq!(
        authored_reference, reference,
        "actual native readback preserves all integrated native evaluations"
    );
    let replay = crate::reference(&d);
    assert_eq!(
        reference, replay,
        "native replay must reexecute the same commands from reset state"
    );
    for frame in reference["frames"].as_array_mut().unwrap() {
        for draw in frame["draws"].as_array_mut().unwrap() {
            let texture = draw["texture"].as_str().unwrap();
            let region = native["atlas"]["regions"]
                .as_array()
                .unwrap()
                .iter()
                .find(|r| r["name"] == texture)
                .unwrap();
            let page = &native["atlas"]["pages"][region["page"].as_u64().unwrap() as usize];
            let f = |v: &serde_json::Value| v.as_f64().unwrap();
            let uvs = draw["sourceUV"]
                .as_array()
                .unwrap()
                .iter()
                .flat_map(|uv| {
                    [
                        (f(&region["x"]) + 0.5 + f(&uv[0]) * (f(&region["original_width"]) - 1.)
                            - f(&region["offset_x"]))
                            / f(&page["width"]),
                        (f(&region["y"]) + 0.5 + f(&uv[1]) * (f(&region["original_height"]) - 1.)
                            - f(&region["offset_y"]))
                            / f(&page["height"]),
                    ]
                })
                .collect::<Vec<_>>();
            draw["page"] = region["page"].clone();
            draw["region"] = region.clone();
            draw["uvs"] = json!(uvs);
            draw["rawWorld"] = draw["world"].clone();
            for term in draw["contributions"].as_array_mut().unwrap() {
                term["fallback"] = json!(term["total"] == 0.);
            }
        }
    }
    fs::write(
        out.join("oracle.json"),
        serde_json::to_vec(&reference).unwrap(),
    )
    .unwrap();

    println!(
        "A17 1441 composed states,1440 single native Physics inputs, independent native replay reexecuted; genuine Save/reopen/native export"
    );
}

#[test]
fn signed_half_turns_use_the_declared_native_precision_tie() {
    for sign in [-1., 1.] {
        let raw = f64::from(std::f32::consts::PI) * sign;
        assert!((shortest(raw) - std::f64::consts::PI * sign).abs() < 1e-12);
    }
    assert!(
        (shortest((-170_f64 - 170.) * std::f64::consts::PI / 180.) - 20_f64.to_radians()).abs()
            < 1e-12
    );
}
#[test]
fn captures_start_at_zero_and_repeat_without_nested_sources() {
    let d = author();
    let mut captures = std::collections::BTreeMap::new();
    let mut origins = std::collections::BTreeMap::new();
    for t in 0..=1440 {
        let st = state(&d, t, &origins);
        let local = inputs(&d, &st, &captures);
        if let Some(source) = st["transition"].get("source")
            && st["transition"]["elapsedTicks"] == "0"
        {
            let key = source["tick"].as_str().unwrap().parse::<u64>().unwrap();
            assert_eq!(format!("{local:?}"), format!("{:?}", captures[&key]));
        }
        for (i, _c) in commands()
            .iter()
            .enumerate()
            .filter(|(_, c)| c.request == t && c.interrupt)
        {
            origins.insert(t,json!({"kind":"frozen","tick":t.to_string(),"command":i+1,"clip":st["activeClip"],"clipTick":st["activeTick"],"clipTime":st["activeTime"]}));
            captures.insert(t, local.clone());
        }
    }
    assert!(!captures.is_empty());
}

#[test]
fn paired_snapshots_preserve_native_slots_at_zero_and_flat_repeated_interruptions() {
    let d = author();
    let mut origins = std::collections::BTreeMap::new();
    let mut locals = std::collections::BTreeMap::new();
    let mut slots = std::collections::BTreeMap::new();
    for t in 0..=1440 {
        let m = state(&d, t, &origins);
        let p = inputs(&d, &m, &locals);
        let s = slot_state(&d, &m, &slots);
        if m["transition"]["status"] == "active"
            && m["transition"]["elapsedTicks"] == "0"
            && !m["transition"]["source"].is_null()
        {
            let n = m["transition"]["source"]["tick"]
                .as_str()
                .unwrap()
                .parse::<u64>()
                .unwrap();
            assert_eq!(s["slots"], slots[&n]["slots"]);
            assert_eq!(s["drawOrder"], slots[&n]["drawOrder"]);
            assert_eq!(format!("{p:?}"), format!("{:?}", locals[&n]));
        }
        for (i, _) in commands()
            .iter()
            .enumerate()
            .filter(|(_, c)| c.request == t && c.interrupt)
        {
            origins.insert(t, json!({"kind":"frozen","tick":t.to_string(),"command":i+1,"clip":m["activeClip"],"clipTick":m["activeTick"],"clipTime":m["activeTime"]}));
            locals.insert(t, p.clone());
            slots.insert(t, s.clone());
        }
    }
    assert_eq!(
        slots.len(),
        commands().iter().filter(|c| c.interrupt).count()
    );
}
#[test]
fn native_expression_curves_and_live_source_discretes_are_not_a_static_setup_fixture() {
    let d = author();
    let before = native_slots(&d, "Idle", 71.0 / 120.0);
    let after = native_slots(&d, "Idle", 72.0 / 120.0);
    for name in ["eye_left", "eye_right"] {
        let get = |v: &serde_json::Value| {
            v["slots"]
                .as_array()
                .unwrap()
                .iter()
                .find(|v| v["name"] == name)
                .unwrap()["attachment"]
                .clone()
        };
        assert_eq!(get(&before), "open");
        assert_eq!(get(&after), "closed");
    }
    assert_ne!(
        native_slots(&d, "Idle", 0.0)["drawOrder"],
        after["drawOrder"]
    );
    let death = native_slots(&d, "Death", 1.17);
    assert!((death["slots"][0]["color"][3].as_f64().unwrap() - 0.4).abs() < 1e-6);
}

fn native_offsets(d: &Document, name: &str, t: f32) -> Vec<glam::Vec2> {
    let slot = d
        .skeleton
        .slots
        .iter()
        .find(|(_, s)| s.name == "body")
        .unwrap()
        .0;
    let Attachment::Mesh(m) = d.skeleton.skins[d.skeleton.default_skin]
        .get(slot, "body")
        .unwrap()
    else {
        panic!()
    };
    let n = m.weights.iter().map(Vec::len).sum();
    let p = sample(d, name, t);
    let out = p
        .deforms
        .get(&(slot, "body".into()))
        .cloned()
        .unwrap_or_else(|| vec![glam::Vec2::ZERO; n]);
    let independent = fixture::offsets(clip(d, name), slot, "body", t);
    if independent.is_empty() {
        assert!(out.iter().all(|v| *v == glam::Vec2::ZERO));
    } else {
        for (x, y) in out.iter().zip(independent) {
            assert!((*x - y).abs().max_element() < 0.0001);
        }
    }
    out
}
fn deform(
    d: &Document,
    st: &serde_json::Value,
    frozen: &std::collections::BTreeMap<u64, Vec<glam::Vec2>>,
) -> Vec<glam::Vec2> {
    let tr = &st["transition"];
    let a = if tr["status"] == "active" && !tr["source"].is_null() {
        frozen[&tr["source"]["tick"]
            .as_str()
            .unwrap()
            .parse::<u64>()
            .unwrap()]
            .clone()
    } else {
        native_offsets(
            d,
            st["activeClip"].as_str().unwrap(),
            st["activeTime"].as_f64().unwrap() as f32,
        )
    };
    if tr["status"] != "active" {
        return a;
    }
    let b = native_offsets(
        d,
        tr["to"].as_str().unwrap(),
        tr["toTime"].as_f64().unwrap() as f32,
    );
    let w = tr["weight"].as_f64().unwrap();
    assert_eq!(a.len(), b.len());
    a.iter()
        .zip(b)
        .map(|(x, y)| {
            glam::vec2(
                if w == 0. {
                    x.x
                } else if w == 1. {
                    y.x
                } else {
                    (f64::from(x.x) + (f64::from(y.x) - f64::from(x.x)) * w) as f32
                },
                if w == 0. {
                    x.y
                } else if w == 1. {
                    y.y
                } else {
                    (f64::from(x.y) + (f64::from(y.y) - f64::from(x.y)) * w) as f32
                },
            )
        })
        .collect()
}
mod geometry;
fn reference(d: &Document) -> serde_json::Value {
    let mut ffd_captures = std::collections::BTreeMap::new();
    let mut slots_captured = std::collections::BTreeMap::new();
    let mut captures = std::collections::BTreeMap::new();
    let mut origins = std::collections::BTreeMap::new();
    let mut physics = ReplayPhysicsInstance::new(
        &d.skeleton,
        1,
        &inputs(d, &state(d, 0, &origins), &captures),
    )
    .unwrap();
    let context = physics.context();
    let mut frames = vec![];
    let mut calls = 0;
    for tick in 0..=1440 {
        let mixing = state(d, tick, &origins);
        let local = inputs(d, &mixing, &captures);
        let offsets = deform(d, &mixing, &ffd_captures);
        let slot_snapshot = slot_state(d, &mixing, &slots_captured);
        let mut events = event_window(d, &mixing);
        for e in &mut events {
            e["slotState"] = slot_snapshot.clone();
            e["mixing"] = mixing.clone();
        }
        let mut s = d.skeleton.clone();
        s.constraint_order.clear();
        for (id, v) in &local {
            s.bones[*id].local_transform = *v;
        }
        let mut pure = Pose::new();
        pose::evaluate(&s, &[], &mut pure);
        if tick > 0 {
            physics
                .request_tick(
                    &context,
                    tick,
                    |scheduled| {
                        calls += 1;
                        assert_eq!(scheduled.index, tick);
                        Ok(local.clone())
                    },
                    |_| {},
                )
                .unwrap();
        }
        let f = physics.frame();
        assert_eq!(f.tick, tick);
        let mut draws = vec![];
        for slot_name in slot_snapshot["drawOrder"].as_array().unwrap() {
            let (id, slot) = d
                .skeleton
                .slots
                .iter()
                .find(|(_, s)| s.name == slot_name.as_str().unwrap())
                .unwrap();
            let state = slot_snapshot["slots"]
                .as_array()
                .unwrap()
                .iter()
                .find(|v| v["name"] == slot.name)
                .unwrap();
            if state["visible"] == false {
                continue;
            }
            let Some(name) = state["attachment"].as_str() else {
                continue;
            };
            let a = d.skeleton.skins[d.skeleton.default_skin]
                .get(id, name)
                .unwrap();
            let host = f.pose.world(slot.bone);
            let (texture, points, uv, indices, terms) = match a {
                Attachment::Mesh(m) => {
                    let (points, terms) = geometry::independent(
                        d,
                        &f.pose,
                        id,
                        name,
                        if slot.name == "body" { &offsets } else { &[] },
                    );
                    (
                        m.texture.clone(),
                        points,
                        m.uvs.iter().map(|v| v.to_array()).collect::<Vec<_>>(),
                        m.triangles.iter().flatten().copied().collect::<Vec<_>>(),
                        terms,
                    )
                }
                Attachment::Region(a) => {
                    let u = &a.uv_rect;
                    (
                        a.texture.clone(),
                        a.local_corners()
                            .map(|v| host.transform_point(v))
                            .map(|v| [f64::from(v.x), f64::from(v.y)])
                            .to_vec(),
                        vec![
                            [u.x, u.y],
                            [u.x, u.y + u.h],
                            [u.x + u.w, u.y + u.h],
                            [u.x + u.w, u.y],
                        ],
                        vec![0, 1, 2, 0, 2, 3],
                        vec![],
                    )
                }
                _ => panic!(),
            };
            draws.push(json!({"slot":slot.name,"attachment":name,"texture":texture,"world":points,"positions":points.iter().flat_map(|v|[v[0],-v[1]]).collect::<Vec<_>>(),"sourceUV":uv,"indices":indices,"contributions":terms,"color":state["color"]}));
        }
        frames.push(json!({"owner":{"owner":"default","slot":"body","attachment":"body"},"offsets":offsets.iter().flat_map(|v|v.to_array()).collect::<Vec<_>>(),"tick":tick,"preview":false,"skin":"default","mixing":mixing,"events":events,"slotState":slot_snapshot,"slots":slot_snapshot["slots"],"pureBones":bones(d,&pure),"bones":bones(d,&f.pose),"drawOrder":slot_snapshot["drawOrder"],"draws":draws,"records":f.records.iter().map(|r|json!({"constraint":d.skeleton.constraints[r.constraint].name(),"values":[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y]})).collect::<Vec<_>>()}));
        for (i, _c) in commands()
            .iter()
            .enumerate()
            .filter(|(_, c)| c.request == tick && c.interrupt)
        {
            let last = &frames.last().unwrap()["mixing"];
            origins.insert(tick,json!({"kind":"frozen","tick":tick.to_string(),"command":i+1,"clip":last["activeClip"],"clipTick":last["activeTick"],"clipTime":last["activeTime"]}));
            captures.insert(tick, local.clone());
            slots_captured.insert(tick, slot_snapshot.clone());
            ffd_captures.insert(tick, offsets.clone());
        }
    }
    assert_eq!(calls, 1440);

    json!({"source":"Independent native event windows + A14 native pose/slot composition + one native Physics; no TypeScript expected inputs","physicsProviderCalls":calls,"commands":commands().iter().map(|c|json!({"requestedTick":c.request,"to":c.to,"durationTicks":c.duration,"incomingTick":c.incoming,"interrupt":c.interrupt})).collect::<Vec<_>>(),"frames":frames})
}

#[test]
fn events_owned_by_incoming_have_empty_start_stable_ties_and_no_abandoned_future() {
    let d = author();
    let result = reference(&d);
    let frames = result["frames"].as_array().unwrap();
    for c in commands() {
        assert!(
            frames[(c.request + 1) as usize]["events"]
                .as_array()
                .unwrap()
                .is_empty()
        );
    }
    let at = |t: usize| {
        frames[t]["events"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| e["event"]["name"].as_str().unwrap())
            .collect::<Vec<_>>()
    };
    assert_eq!(at(85), vec!["attack_impact", "attack_impact_echo"]);
    assert!(
        frames
            .iter()
            .flat_map(|f| f["events"].as_array().unwrap())
            .all(|e| e["event"]["time"] != 0.0)
    );
    assert!(
        !frames[91..420]
            .iter()
            .flat_map(|f| f["events"].as_array().unwrap())
            .any(|e| e["clip"] == "Attack")
    );
    assert!(
        !frames[481..900]
            .iter()
            .flat_map(|f| f["events"].as_array().unwrap())
            .any(|e| e["clip"] == "Attack")
    );
    assert_eq!(frames[85]["events"][0]["slotState"]["clip"], "Idle");
    assert_eq!(frames[85]["events"][0]["clip"], "Attack");
}

fn write_vectors(out: &std::path::Path) {
    use ankhimate_core::animation::EventKey;
    let mut vectors = vec![];
    for (name, duration, looping, incoming) in [
        ("f32-loop", 0.83_f32, true, 0_u64),
        ("short-loops", 0.002, true, 3),
        ("clamped", 0.83, false, 48),
        ("same-keys", 1.5, true, 160),
    ] {
        let mut d = author();
        let a = d
            .animations
            .values_mut()
            .find(|a| a.name == "Attack")
            .unwrap();
        let factor = duration / a.duration;
        for t in &mut a.timelines {
            macro_rules! scale {
                ($ks:expr) => {
                    for k in $ks {
                        k.time *= factor;
                    }
                };
            }
            match t {
                Timeline::BoneRotate { keys, .. }
                | Timeline::BoneTranslate { keys, .. }
                | Timeline::BoneScale { keys, .. }
                | Timeline::BoneShear { keys, .. } => scale!(keys),
                Timeline::SlotColor { keys, .. } => scale!(keys),
                Timeline::SlotVisible { keys, .. } => scale!(keys),
                Timeline::SlotAttachment { keys, .. } => scale!(keys),
                Timeline::DrawOrder { keys } => scale!(keys),
                Timeline::Deform { keys, .. } => scale!(keys),
                _ => panic!("vector family"),
            }
        }
        a.duration = duration;
        a.looping = looping;
        let event = |time, name: &str| EventKey {
            time,
            name: name.into(),
            int_value: 7,
            float_value: 0.25,
            string_value: "native vector".into(),
            audio: String::new(),
            volume: 1.,
            balance: 0.,
        };
        a.events = vec![
            event(duration, "end"),
            event(0., "zero"),
            event(duration * 0.2, "sameA"),
            event(duration * 0.2, "sameB"),
        ];
        let folder = out.join(name);
        fs::create_dir(&folder).unwrap();
        let schema = ankhimate_formats::convert::to_schema(&view(&d));
        ankhimate_formats::save(&folder.join("Combat-Frog.ankh"), &view(&d), &[]).unwrap();
        let (loaded, _) = ankhimate_formats::load(&folder.join("Combat-Frog.ankh")).unwrap();
        let d = Document::from_loaded(loaded);
        assert_eq!(schema, ankhimate_formats::convert::to_schema(&view(&d)));
        let mut preset = ankhimate_export::presets::default_preset();
        preset.atlas.settings.trim = false;
        preset.atlas.settings.max_page = 96;
        let plan = ankhimate_export::run::plan(&schema, &d.assets, &preset).unwrap();
        ankhimate_export::run::write(&plan, &folder.join("native")).unwrap();
        let rows=(61..=421).map(|tick|{let local=incoming+tick-61;let m=json!({"tick":tick.to_string(),"activeClip":"Idle","activeTick":tick.to_string(),"transition":{"status":"active","to":"Attack","toTick":local.to_string(),"startTick":"61"}});json!({"tick":tick,"events":event_window(&d,&m)})}).collect::<Vec<_>>();
        vectors.push(json!({"name":name,"duration":duration,"looping":looping,"incomingTick":incoming,"rows":rows}));
    }
    fs::write(
        out.join("vectors.json"),
        serde_json::to_vec(&vectors).unwrap(),
    )
    .unwrap();
}

#[test]
fn integrated_frozen_ffd_is_flat_exact_at_zero_and_absent_hit_is_rest() {
    let d = author();
    let mut origins = std::collections::BTreeMap::new();
    let mut frozen = std::collections::BTreeMap::new();
    assert!(
        native_offsets(&d, "Hit", 0.25)
            .iter()
            .all(|v| *v == glam::Vec2::ZERO)
    );
    for tick in 0..=1440 {
        let m = state(&d, tick, &origins);
        let offsets = deform(&d, &m, &frozen);
        if m["transition"]["status"] == "active"
            && m["transition"]["elapsedTicks"] == "0"
            && !m["transition"]["source"].is_null()
        {
            let origin = m["transition"]["source"]["tick"]
                .as_str()
                .unwrap()
                .parse::<u64>()
                .unwrap();
            assert_eq!(offsets, frozen[&origin]);
        }
        for (i, _) in commands()
            .iter()
            .enumerate()
            .filter(|(_, c)| c.request == tick && c.interrupt)
        {
            origins.insert(tick,json!({"kind":"frozen","tick":tick.to_string(),"command":i+1,"clip":m["activeClip"],"clipTick":m["activeTick"],"clipTime":m["activeTime"]}));
            frozen.insert(tick, offsets.clone());
        }
    }
    assert_eq!(
        frozen.len(),
        commands().iter().filter(|c| c.interrupt).count()
    );
}
