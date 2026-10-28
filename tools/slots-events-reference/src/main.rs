//! A6 native author/export + independent Rust slot/event-window/Physics composition. Never patches native JSON.
use ankhimate_core::{
    animation::Timeline,
    assets::ImageAsset,
    attachment::Attachment,
    pose::{self, Pose},
    replay_consumer::ReplayConsumerBridge,
};
use ankhimate_export::{presets, run};
use ankhimate_formats::{Loaded, ProjectRef, convert, schema};
use image::{ImageFormat, Rgba, RgbaImage};
use serde_json::json;
use std::{fs, path::PathBuf};
fn view(d: &Loaded) -> ProjectRef<'_> {
    ProjectRef {
        skeleton: &d.skeleton,
        animations: &d.animations,
        animation_order: &[],
        assets: &d.assets,
        name: &d.name,
        fps: d.fps,
        export_presets: &d.export_presets,
        psd_layer_paths: &d.psd_layer_paths,
    }
}
fn main() {
    let out = PathBuf::from(std::env::args().nth(1).expect("NEW_OUTPUT"));
    fs::create_dir(&out).expect("refuse existing output");
    let project: schema::Project =
        serde_json::from_str(include_str!("author-source.json")).unwrap();
    let mut d = convert::from_schema(&project);
    assert!(d.report.dangling.is_empty());
    let body = include_bytes!("body.png").to_vec();
    d.assets.add(ImageAsset::new("body_art", body, 64, 64));
    for (name, width, height) in [("cape", 32, 64), ("sun", 48, 64), ("moon", 48, 80)] {
        let mut art = RgbaImage::new(width, height);
        for (x, y, p) in art.enumerate_pixels_mut() {
            let cx = x as f32 - width as f32 / 2.;
            let cy = y as f32 - height as f32 / 2.;
            *p = match name {
                "cape" => {
                    if x > 1 && x < 30 && y > 2 && y < 62 {
                        Rgba([38, 75 + (y / 2) as u8, 180, 195])
                    } else {
                        Rgba([0, 0, 0, 0])
                    }
                }
                "sun" => {
                    if (cx * cx + (cy + 12.).powi(2)).sqrt() < 17.
                        || (cx.abs() < 4. && cy > -10. && cy < 30.)
                    {
                        Rgba([245, 190, 45, 235])
                    } else {
                        Rgba([0, 0, 0, 0])
                    }
                }
                _ => {
                    if ((cx + 4.).powi(2) + (cy + 16.).powi(2)).sqrt() < 18.
                        && ((cx - 3.).powi(2) + (cy + 18.).powi(2)).sqrt() > 14.
                        || cx.abs() < 3. && cy > -8. && cy < 36.
                    {
                        Rgba([124, 220, 250, 245])
                    } else {
                        Rgba([0, 0, 0, 0])
                    }
                }
            };
        }
        let mut bytes = std::io::Cursor::new(Vec::new());
        art.write_to(&mut bytes, ImageFormat::Png).unwrap();
        d.assets
            .add(ImageAsset::new(name, bytes.into_inner(), width, height));
    }
    let before = convert::to_schema(&view(&d));
    ankhimate_formats::save(&out.join("Signal-Costume-Frog.ankh"), &view(&d), &[]).unwrap();
    let (d, _) = ankhimate_formats::load(&out.join("Signal-Costume-Frog.ankh")).unwrap();
    assert_eq!(before, convert::to_schema(&view(&d)));
    fs::write(
        out.join("author.json"),
        serde_json::to_vec_pretty(&before).unwrap(),
    )
    .unwrap();
    fs::create_dir(out.join("source")).unwrap();
    for (_, image) in d.assets.images.iter() {
        fs::write(
            out.join("source").join(format!("{}.png", image.name)),
            &image.bytes,
        )
        .unwrap();
    }
    let mut preset = presets::default_preset();
    preset.atlas.settings.trim = false;
    preset.atlas.settings.max_page = 96;
    let plan = run::plan(&before, &d.assets, &preset).unwrap();
    run::write(&plan, &out.join("native")).unwrap();
    let native: serde_json::Value =
        serde_json::from_slice(&fs::read(out.join("native/skeleton.json")).unwrap()).unwrap();
    assert!(native["atlas"]["pages"].as_array().unwrap().len() >= 2);
    let regions = native["atlas"]["regions"].as_array().unwrap();
    assert_ne!(
        regions.iter().find(|r| r["name"] == "sun").unwrap()["page"],
        regions.iter().find(|r| r["name"] == "moon").unwrap()["page"]
    );
    let mut d = ankhimate_document::doc::Document::from_loaded(d);
    ankhimate_document::rebind::rebind_meshes(&mut d);
    let full = d.animations.values().next().unwrap();
    let mut bone_clip = full.clone();
    bone_clip.timelines.retain(|t| {
        !matches!(
            t,
            Timeline::SlotColor { .. }
                | Timeline::SlotVisible { .. }
                | Timeline::SlotAttachment { .. }
                | Timeline::DrawOrder { .. }
        )
    });
    bone_clip.events.clear();
    let mut consumer =
        ReplayConsumerBridge::new(&d.skeleton, &[bone_clip], "signal_costume", 1, None).unwrap();
    let context = consumer.context();
    consumer.play(&context, "signal_costume", false).unwrap();
    let mut frames = vec![];
    for tick in 0..=720 {
        if tick > 0 {
            consumer.request_tick(&context, tick, |_| {}).unwrap();
        }
        let f = consumer.current_frame().unwrap();
        let events = if tick == 0 {
            vec![]
        } else {
            window(full, tick)
        };
        assert_eq!(f.completed, tick);
        let mut pose = Pose::new();
        pose::evaluate(&d.skeleton, &[(full, f.clip_time, 1.)], &mut pose);
        for (id, b) in d.skeleton.bones.iter() {
            let accepted = f.bones.iter().find(|v| v.name == b.name).unwrap();
            pose.locals[id] = accepted.local;
            pose.worlds[id] = accepted.world;
        }
        let slots:Vec<_>=d.skeleton.slots.iter().map(|(id,s)|{
            let name=pose.attachment_name(&d.skeleton,id);json!({"name":s.name,"owner":name.map(|_|"default"),"attachment":name,"visible":pose.slot_visible.get(id).copied().unwrap_or(true),"color":pose.slot_colors[id]})
        }).collect();
        let order: Vec<_> = pose
            .draw_order
            .iter()
            .map(|id| &d.skeleton.slots[*id].name)
            .collect();
        let mut draws = vec![];
        for &id in &pose.draw_order {
            let slot = &d.skeleton.slots[id];
            if !pose.slot_visible.get(id).copied().unwrap_or(true) {
                continue;
            }
            let Some(a) = d
                .skeleton
                .resolve_posed(&[d.skeleton.default_skin], &pose, id)
            else {
                continue;
            };
            let host = pose.world(slot.bone);
            let (texture, vertices, uvs, indices, contributions) = match a {
                Attachment::Mesh(m) => {
                    let vertices: Vec<_> = (0..m.setup_vertices.len())
                        .map(|i| {
                            let p = m.skin_vertex_with_deform(i, &[], &pose, &host);
                            json!([p.x, p.y])
                        })
                        .collect();
                    let contributions:Vec<_>=(0..m.setup_vertices.len()).map(|i|{let row=m.weights.get(i).map(Vec::as_slice).unwrap_or(&[]);let terms:Vec<_>=row.iter().map(|w|{let local=m.inverse_bind_matrices[&w.bone].transform_point(m.setup_vertices[i]);let p=pose.world(w.bone).transform_point(local);json!({"bone":d.skeleton.bones[w.bone].name,"weight":w.weight,"local":[local.x,local.y],"world":[p.x,p.y]})}).collect();json!({"fallback":row.is_empty(),"total":row.iter().map(|w|w.weight).sum::<f32>(),"terms":terms})}).collect();
                    (
                        m.texture.clone(),
                        vertices,
                        m.uvs.iter().map(|v| vec![v.x, v.y]).collect::<Vec<_>>(),
                        m.triangles.iter().flatten().copied().collect::<Vec<_>>(),
                        contributions,
                    )
                }
                Attachment::Region(r) => {
                    let vertices = r
                        .local_corners()
                        .map(|v| {
                            let p = host.transform_point(v);
                            json!([p.x, p.y])
                        })
                        .to_vec();
                    let uv = &r.uv_rect;
                    (
                        r.texture.clone(),
                        vertices,
                        vec![
                            vec![uv.x, uv.y],
                            vec![uv.x, uv.y + uv.h],
                            vec![uv.x + uv.w, uv.y + uv.h],
                            vec![uv.x + uv.w, uv.y],
                        ],
                        vec![0, 1, 2, 0, 2, 3],
                        vec![],
                    )
                }
                _ => panic!("outside A6"),
            };
            draws.push(json!({"slot":slot.name,"attachment":pose.attachment_name(&d.skeleton,id),"texture":texture,"world":vertices,"sourceUV":uvs,"indices":indices,"contributions":contributions,"color":pose.slot_colors[id]}));
        }
        frames.push(json!({"events":events,"tick":tick,"clipTime":f.clip_time,"skin":f.skin,"epoch":f.epoch,"slots":slots,"drawOrder":order,"draws":draws,"bones":f.bones.iter().map(|b|json!({"name":b.name,"local":[b.local.position.x,b.local.position.y,b.local.rotation,b.local.scale.x,b.local.scale.y,b.local.shear.x,b.local.shear.y],"world":[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]})).collect::<Vec<_>>(),"records":f.records.iter().map(|r|json!({"constraint":"spring","values":[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y]})).collect::<Vec<_>>()}));
    }
    let mut vectors = vec![];
    for (duration, looping, count) in [
        (1.5, true, 720),
        (0.002, true, 12),
        (0.83, true, 360),
        (1.5, false, 240),
    ] {
        let mut clip = full.clone();
        clip.duration = duration;
        clip.looping = looping;
        clip.events.retain(|e| e.time <= duration);
        if duration < 0.01 {
            clip.events = vec![
                ankhimate_core::animation::EventKey {
                    time: duration / 2.,
                    name: "short".into(),
                    int_value: 0,
                    float_value: 0.,
                    string_value: String::new(),
                    audio: String::new(),
                    volume: 1.,
                    balance: 0.,
                },
                ankhimate_core::animation::EventKey {
                    time: duration,
                    name: "short_end".into(),
                    int_value: 0,
                    float_value: 0.,
                    string_value: String::new(),
                    audio: String::new(),
                    volume: 1.,
                    balance: 0.,
                },
            ];
        }
        vectors.push(json!({"duration":duration,"looping":looping,"keys":clip.events.iter().map(payload).collect::<Vec<_>>(),"ticks":(1..=count).map(|t|json!({"tick":t,"events":window(&clip,t)})).collect::<Vec<_>>()}));
    }
    fs::write(
        out.join("event-vectors.json"),
        serde_json::to_vec(&vectors).unwrap(),
    )
    .unwrap();
    fs::write(out.join("rust.json"),serde_json::to_vec(&json!({"source":"A2 native slots and event windows on canonical lap fragments + accepted Rust Replay bone/Physics matrices + native author geometry; no TS reference","frames":frames})).unwrap()).unwrap();
    println!(
        "A2 author Save/reopen/export; multipage signal_costume; 721 independent Rust accepted event/Physics/geometry frames"
    );
}

// Compose the unmodified native event-window function with accepted 120 Hz lap fragments.
fn payload(e: &ankhimate_core::animation::EventKey) -> serde_json::Value {
    json!({"time":e.time,"name":e.name,"int":e.int_value,"float":e.float_value,"string":e.string_value,"audio":e.audio,"volume":e.volume,"balance":e.balance})
}
fn window(a: &ankhimate_core::animation::Animation, tick: u64) -> Vec<serde_json::Value> {
    let mut out = vec![];
    let duration = a.duration as f64;
    let previous = (tick - 1) as f64 / 120.;
    let next = tick as f64 / 120.;
    let first = if a.looping {
        (previous / duration).floor() as u64
    } else {
        0
    };
    let last = if a.looping {
        (next / duration).floor() as u64
    } else {
        0
    };
    for lap in first..=last {
        let lo = (previous - lap as f64 * duration).clamp(0., duration) as f32;
        let hi = (next - lap as f64 * duration).clamp(0., duration) as f32;
        for e in ankhimate_core::animation::events_in_window(a, lo, hi, false) {
            let index = a.events.iter().position(|v| v == &e).unwrap();
            out.push(json!({"lap":lap,"keyIndex":index,"event":payload(&e)}));
        }
    }
    out
}
