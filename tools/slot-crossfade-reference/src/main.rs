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
    let rows = if gate_a() {
        vec![
            (60, "Attack", 48, 0, false),
            (180, "Idle", 48, 160, false),
            (300, "Hit", 36, 0, false),
            (420, "Idle", 48, 0, false),
        ]
    } else {
        let first = if std::env::args().nth(2).as_deref() == Some("before") {
            71
        } else {
            73
        };
        vec![
            (60, "Attack", 96, 0, false),
            (first, "Hit", 48, 0, true),
            (80, "Death", 36, 0, true),
            (180, "Idle", 48, 160, false),
            (420, "Attack", 48, 0, false),
            (430, "Hit", 24, 0, true),
            (438, "Death", 48, 0, true),
            (600, "Idle", 48, 0, false),
        ]
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
    d.meta.name = "Combat Frog — Animated Expressions".into();
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
    expressions(&mut d);
    ankhimate_document::rebind::rebind_meshes(&mut d);
    d
}
fn expressions(d: &mut Document) {
    use image::{ImageFormat, Rgba, RgbaImage};
    for name in ["eyes_open", "eyes_closed"] {
        let mut image = RgbaImage::new(20, 12);
        for (x, y, p) in image.enumerate_pixels_mut() {
            let xx = x as f32 - 9.5;
            let yy = y as f32 - 5.5;
            *p = if name == "eyes_open" {
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
    for (name, x) in [("eye_left", -8.), ("eye_right", 7.)] {
        let mut slot = Slot::new(name.into(), root);
        slot.attachment = Some("open".into());
        let id = d.skeleton.slots.insert(slot);
        d.skeleton.draw_order.push(id);
        for (attachment, texture) in [("open", "eyes_open"), ("closed", "eyes_closed")] {
            d.skeleton.skins[d.skeleton.default_skin].entries.insert(
                (id, attachment.into()),
                Attachment::Region(RegionAttachment {
                    texture: texture.into(),
                    local_offset: glam::vec2(x, 16.),
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
    let eyes = [ids("eye_left"), ids("eye_right")];
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
            colors[3][3] = 0.;
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
            return json!({"kind":if gate_a(){"crossfade-slots/v1"}else{"interruptible-crossfade-slots/v1"},"tick":t.to_string(),"activeClip":from,"activeTick":local.to_string(),"activeTime":time(d,from,local),"transition":last});
        }
        active = c.to;
        anchor = start as i64 - c.incoming as i64;
    }
    json!({"kind":if gate_a(){"crossfade-slots/v1"}else{"interruptible-crossfade-slots/v1"},"tick":t.to_string(),"activeClip":active,"activeTick":(t as i64-anchor).to_string(),"activeTime":time(d,active,(t as i64-anchor)as u64),"transition":last})
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
fn main() {
    let out = PathBuf::from(std::env::args().nth(1).expect("NEW_OUTPUT"));
    fs::create_dir(&out).expect("refuse existing output");
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
    let mut slots_captured = std::collections::BTreeMap::new();
    let mut captures = std::collections::BTreeMap::new();
    let mut origins = std::collections::BTreeMap::new();
    let mut physics = ReplayPhysicsInstance::new(
        &d.skeleton,
        1,
        &inputs(&d, &state(&d, 0, &origins), &captures),
    )
    .unwrap();
    let context = physics.context();
    let mut frames = vec![];
    let mut calls = 0;
    for tick in 0..=720 {
        let mixing = state(&d, tick, &origins);
        let local = inputs(&d, &mixing, &captures);
        let slot_snapshot = slot_state(&d, &mixing, &slots_captured);
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
                    let (points, terms) = fixture::independent(&d, &f.pose, id, name, name, 0.);
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
        frames.push(json!({"tick":tick,"preview":false,"skin":"default","mixing":mixing,"slotState":slot_snapshot,"slots":slot_snapshot["slots"],"pureBones":bones(&d,&pure),"bones":bones(&d,&f.pose),"drawOrder":slot_snapshot["drawOrder"],"draws":draws,"records":f.records.iter().map(|r|json!({"constraint":d.skeleton.constraints[r.constraint].name(),"values":[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y]})).collect::<Vec<_>>()}));
        for (i, _c) in commands()
            .iter()
            .enumerate()
            .filter(|(_, c)| c.request == tick && c.interrupt)
        {
            let last = &frames.last().unwrap()["mixing"];
            origins.insert(tick,json!({"kind":"frozen","tick":tick.to_string(),"command":i+1,"clip":last["activeClip"],"clipTick":last["activeTick"],"clipTime":last["activeTime"]}));
            captures.insert(tick, local.clone());
            slots_captured.insert(tick, slot_snapshot.clone());
        }
    }
    assert_eq!(calls, 720);
    fs::write(out.join("oracle.json"),serde_json::to_vec(&json!({"source":"Native A10 author Save/reopen/export. Independent Rust full per-clip local sampling, f64 shortest-arc local interpolation, native FK, explicit native RGBA interpolation and source-until-completion discrete policy, frozen pose+slots and one native ReplayPhysicsInstance closure per accepted tick. No TypeScript expected inputs.","physicsProviderCalls":calls,"commands":commands().iter().map(|c|json!({"requestedTick":c.request,"to":c.to,"durationTicks":c.duration,"incomingTick":c.incoming,"interrupt":c.interrupt})).collect::<Vec<_>>(),"frames":frames})).unwrap()).unwrap();
    println!(
        "A14 721 Gate A/B reference states,720 single native Physics inputs; genuine Save/reopen/native export"
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
    for t in 0..=720 {
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
    for t in 0..=720 {
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
    assert_eq!(slots.len(), 4);
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
    assert_eq!(death["slots"][0]["color"][3], 0.0);
}
