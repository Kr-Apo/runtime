//! Independent native author/sampler/local blend and single continuous B6 Physics reference.
use ankhimate_core::{
    animation::{Axis, Interp, Key, Timeline},
    attachment::Attachment,
    math::Transform,
    pose::{self, Pose},
    replay_animation::canonical_time,
    replay_physics::{ReplayInputs, ReplayPhysicsInstance},
};
use ankhimate_document::Document;
use serde_json::json;
use std::{fs, path::PathBuf};
mod fixture {
    include!("support/linked_frog.rs");
}
#[derive(Clone, Copy)]
struct Cmd {
    request: u64,
    to: &'static str,
    duration: u64,
    incoming: u64,
}
const COMMANDS: [Cmd; 4] = [
    Cmd {
        request: 60,
        to: "Attack",
        duration: 24,
        incoming: 0,
    },
    Cmd {
        request: 180,
        to: "Idle",
        duration: 36,
        incoming: 160,
    },
    Cmd {
        request: 300,
        to: "Hit",
        duration: 12,
        incoming: 0,
    },
    Cmd {
        request: 420,
        to: "Idle",
        duration: 48,
        incoming: 0,
    },
];
fn commands() -> [Cmd; 4] {
    if std::env::args().nth(2).as_deref() == Some("loop") {
        [
            Cmd {
                request: 168,
                to: "Attack",
                duration: 48,
                incoming: 0,
            },
            Cmd {
                request: 360,
                to: "Idle",
                duration: 60,
                incoming: 160,
            },
            Cmd {
                request: 480,
                to: "Hit",
                duration: 24,
                incoming: 0,
            },
            Cmd {
                request: 600,
                to: "Idle",
                duration: 48,
                incoming: 0,
            },
        ]
    } else {
        COMMANDS
    }
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
    d.meta.name = "Combat Frog — Crossfade".into();
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
    ankhimate_document::rebind::rebind_meshes(&mut d);
    d
}
fn clip<'a>(d: &'a Document, name: &str) -> &'a ankhimate_core::animation::Animation {
    d.animations.values().find(|a| a.name == name).unwrap()
}
fn time(d: &Document, name: &str, t: u64) -> f32 {
    let a = clip(d, name);
    canonical_time(t, a.duration, a.looping).unwrap()
}
fn state(d: &Document, t: u64) -> serde_json::Value {
    let mut active = "Idle";
    let mut anchor = 0_i64;
    let mut last = serde_json::Value::Null;
    for c in commands() {
        let start = c.request + 1;
        if t < start {
            break;
        }
        let elapsed = (t - start).min(c.duration);
        let end = start + elapsed;
        let from_tick = (end as i64 - anchor) as u64;
        let to_tick = c.incoming + elapsed;
        last = json!({"requestedTick":c.request.to_string(),"startTick":start.to_string(),"durationTicks":c.duration.to_string(),"from":active,"to":c.to,"fromTick":from_tick.to_string(),"toTick":to_tick.to_string(),"fromTime":time(d,active,from_tick),"toTime":time(d,c.to,to_tick),"elapsedTicks":elapsed.to_string(),"weight":(elapsed as f64/c.duration as f64)as f32,"status":if elapsed==c.duration{"complete"}else{"active"}});
        if elapsed < c.duration {
            return json!({"kind":"crossfade/v1","tick":t.to_string(),"activeClip":active,"activeTick":(t as i64-anchor).to_string(),"activeTime":time(d,active,(t as i64-anchor)as u64),"transition":last});
        }
        active = c.to;
        anchor = start as i64 - c.incoming as i64;
    }
    json!({"kind":"crossfade/v1","tick":t.to_string(),"activeClip":active,"activeTick":(t as i64-anchor).to_string(),"activeTime":time(d,active,(t as i64-anchor)as u64),"transition":last})
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
fn inputs(d: &Document, t: u64) -> ReplayInputs {
    let st = state(d, t);
    let a = sample(
        d,
        st["activeClip"].as_str().unwrap(),
        st["activeTime"].as_f64().unwrap() as f32,
    );
    let tr = &st["transition"];
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
    let mut physics = ReplayPhysicsInstance::new(&d.skeleton, 1, &inputs(&d, 0)).unwrap();
    let context = physics.context();
    let mut frames = vec![];
    let mut calls = 0;
    for tick in 0..=720 {
        let local = inputs(&d, tick);
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
                        Ok(inputs(&d, scheduled.index))
                    },
                    |_| {},
                )
                .unwrap();
        }
        let f = physics.frame();
        assert_eq!(f.tick, tick);
        let mut draws = vec![];
        for &id in &d.skeleton.draw_order {
            let slot = &d.skeleton.slots[id];
            let Some(name) = &slot.attachment else {
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
            draws.push(json!({"slot":slot.name,"attachment":name,"texture":texture,"world":points,"positions":points.iter().flat_map(|v|[v[0],-v[1]]).collect::<Vec<_>>(),"sourceUV":uv,"indices":indices,"contributions":terms,"color":slot.color}));
        }
        frames.push(json!({"tick":tick,"preview":false,"skin":"default","mixing":state(&d,tick),"pureBones":bones(&d,&pure),"bones":bones(&d,&f.pose),"drawOrder":d.skeleton.draw_order.iter().map(|id|d.skeleton.slots[*id].name.clone()).collect::<Vec<_>>(),"draws":draws,"records":f.records.iter().map(|r|json!({"constraint":d.skeleton.constraints[r.constraint].name(),"values":[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y]})).collect::<Vec<_>>()}));
    }
    assert_eq!(calls, 720);
    fs::write(out.join("oracle.json"),serde_json::to_vec(&json!({"source":"Native A10 author Save/reopen/export. Independent Rust full per-clip local sampling, f64 shortest-arc local interpolation, native FK, one native ReplayPhysicsInstance closure per accepted tick. No TypeScript expected inputs.","physicsProviderCalls":calls,"commands":commands().iter().map(|c|json!({"requestedTick":c.request,"to":c.to,"durationTicks":c.duration,"incomingTick":c.incoming})).collect::<Vec<_>>(),"frames":frames})).unwrap()).unwrap();
    println!(
        "A12 721 Gate A/B reference states,720 single native Physics inputs; genuine Save/reopen/native export"
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
fn source_and_incoming_times_are_independent_at_endpoints_and_loop() {
    let d = author();
    assert_eq!(state(&d, 60)["activeClip"], "Idle");
    assert_eq!(state(&d, 61)["transition"]["weight"], 0.);
    assert_eq!(state(&d, 85)["activeClip"], "Attack");
    assert_eq!(state(&d, 85)["transition"]["weight"], 1.);
    assert_eq!(state(&d, 201)["transition"]["toTime"], 0.);
}
