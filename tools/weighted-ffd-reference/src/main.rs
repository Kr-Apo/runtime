//! A3 author/export + independent Rust composition. Never patches native JSON.
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
    let bones = vec![
        json!({"name":"root","length":10,"tx":10,"ty":5,"rotation":10,"sx":0.9,"sy":1.05}),
        json!({"name":"b0","parent":"root","length":12,"tx":-12,"ty":-8,"rotation":-12,"sx":1.1,"sy":0.9}),
        json!({"name":"b1","parent":"b0","length":13,"tx":10,"ty":2,"rotation":18,"sx":0.95,"sy":1.1}),
        json!({"name":"b2","parent":"b1","length":14,"tx":12,"ty":-3,"rotation":-7}),
        json!({"name":"b3","parent":"b2","length":9,"tx":11,"ty":2,"rotation":15}),
        json!({"name":"b4","parent":"b3","length":8,"tx":9,"ty":1,"rotation":-9}),
    ];
    let zeros = vec![0f32; 20];
    let mut impact = vec![];
    for i in 0..10 {
        impact.push(if i < 2 {
            3.0 + i as f32
        } else {
            -(i as f32 % 3.0) * 2.0 - 2.0
        });
        impact.push(if i < 2 {
            -7.0
        } else {
            12.0 + (i as f32 % 3.0) * 1.5
        });
    }
    let small: Vec<_> = impact.iter().map(|v| v * 0.25).collect();
    let project:schema::Project=serde_json::from_value(json!({"version":1,"name":"A3 Impact Frog","fps":60,"bones":bones,"slots":[{"name":"body","bone":"root","attachment":"body","color":[1,1,1,1],"blend_mode":"normal"}],"draw_order":["body"],"default_skin":"default","skins":[{"name":"default","entries":[{"slot":"body","name":"body","attachment":{"type":"mesh","texture":"frog","vertices":[-36,32,-36,-40,36,-40,36,32],"uvs":[0,0,0,1,1,1,1,0],"triangles":[0,1,2,0,2,3],"weights":[[["b0",0.7],["b1",0.3]],[["b0",0.2],["b1",0.4],["b2",0.6]],[["b0",0.4],["b1",0.2],["b2",0],["b3",0.3],["b4",0.1]],[]]}}]}],"constraints":[{"name":"spring","type":"physics","target":"b2","bones":[],"mix":0.7,"physics":[0.5,30,6,1],"forces":[0.3,0,0,-7],"channels":[true,true]}],"constraint_order":["spring"],"animations":[{"name":"impact","duration":1.5,"looping":true,"timelines":[{"kind":"bone_rotate","bone":"root","keys":[{"time":0,"value":0,"curve":"linear"},{"time":0.5,"value":8,"curve":"linear"},{"time":0.8,"value":-4,"curve":"linear"},{"time":1.5,"value":0,"curve":"linear"}]},{"kind":"bone_translate","bone":"root","axis":"x","keys":[{"time":0,"value":0,"curve":"linear"},{"time":0.5,"value":6,"curve":"linear"},{"time":1.5,"value":0,"curve":"linear"}]},{"kind":"deform","slot":"body","attachment":"body","keys":[{"time":0,"offsets":zeros,"curve":"linear"},{"time":0.4,"offsets":small,"curve":"bezier","handles":[0.2,0,0.8,0.6]},{"time":0.5,"offsets":impact,"curve":"bezier","handles":[0.2,-0.1,0.8,1.1]},{"time":0.8,"offsets":small,"curve":"stepped"},{"time":1.1,"offsets":zeros,"curve":"linear"}]}]}]})).unwrap();
    let mut d = convert::from_schema(&project);
    assert!(d.report.dangling.is_empty());
    let mut art = RgbaImage::new(64, 64);
    for (y, row) in art.rows_mut().enumerate() {
        for (x, p) in row.enumerate() {
            let fx = (x as f32 - 31.5) / 29.0;
            let fy = (y as f32 - 33.0) / 28.0;
            let edge = 1.0 - fx * fx - fy * fy;
            let alpha = (edge * 500.0).clamp(0.0, 255.0) as u8;
            let eye = (x as i32 - 21).pow(2) + (y as i32 - 19).pow(2) < 36
                || (x as i32 - 42).pow(2) + (y as i32 - 19).pow(2) < 36;
            let pupil = (x as i32 - 22).pow(2) + (y as i32 - 19).pow(2) < 7
                || (x as i32 - 43).pow(2) + (y as i32 - 19).pow(2) < 7;
            *p = if pupil {
                Rgba([12, 32, 30, 255])
            } else if eye {
                Rgba([250, 221, 117, 255])
            } else if (8..13).contains(&y) {
                Rgba([240, 182, 44, alpha])
            } else if y == 40 && (20..45).contains(&x) {
                Rgba([12, 49, 44, 255])
            } else {
                Rgba([24 + (x as u8 / 3), 140 + (y as u8 / 2), 108, alpha])
            };
        }
    }
    let mut bytes = std::io::Cursor::new(Vec::new());
    art.write_to(&mut bytes, ImageFormat::Png).unwrap();
    d.assets
        .add(ImageAsset::new("frog", bytes.into_inner(), 64, 64));
    let before = convert::to_schema(&view(&d));
    ankhimate_formats::save(&out.join("Impact-Frog.ankh"), &view(&d), &[]).unwrap();
    let (d, _) = ankhimate_formats::load(&out.join("Impact-Frog.ankh")).unwrap();
    assert_eq!(before, convert::to_schema(&view(&d)));
    fs::write(
        out.join("author.json"),
        serde_json::to_vec_pretty(&before).unwrap(),
    )
    .unwrap();
    fs::write(
        out.join("frog.png"),
        &d.assets.images[d.assets.by_name("frog").unwrap()].bytes,
    )
    .unwrap();
    let mut preset = presets::default_preset();
    preset.atlas.settings.trim = false;
    preset.atlas.settings.max_page = 256;
    let plan = run::plan(&before, &d.assets, &preset).unwrap();
    run::write(&plan, &out.join("native")).unwrap();
    // Loading reconstructs authored data; document integrity reconstructs skipped binds.
    let mut d = ankhimate_document::doc::Document::from_loaded(d);
    ankhimate_document::rebind::rebind_meshes(&mut d);
    let full = d.animations.values().next().unwrap();
    let mut bone_clip = full.clone();
    bone_clip
        .timelines
        .retain(|t| !matches!(t, Timeline::Deform { .. }));
    let mut consumer =
        ReplayConsumerBridge::new(&d.skeleton, &[bone_clip], "impact", 1, None).unwrap();
    let context = consumer.context();
    consumer.play(&context, "impact", false).unwrap();
    let slot = d.skeleton.slots.keys().next().unwrap();
    let Attachment::Mesh(mesh) = d
        .skeleton
        .resolve_slot(d.skeleton.default_skin, slot)
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(
        mesh.weights.iter().map(Vec::len).collect::<Vec<_>>(),
        [2, 3, 5, 0]
    );
    let mut frames = vec![];
    for tick in 0..=720 {
        if tick > 0 {
            consumer.request_tick(&context, tick, |_| {}).unwrap();
        }
        let f = consumer.current_frame().unwrap();
        assert_eq!(f.completed, tick);
        let mut combined = Pose::new();
        pose::evaluate(&d.skeleton, &[(full, f.clip_time, 1.0)], &mut combined);
        for (id, b) in d.skeleton.bones.iter() {
            let accepted = f.bones.iter().find(|v| v.name == b.name).unwrap();
            combined.locals[id] = accepted.local;
            combined.worlds[id] = accepted.world;
        }
        let offsets = &combined.deforms[&(slot, "body".into())];
        let host = combined.world(d.skeleton.slots[slot].bone);
        let vertices: Vec<_> = (0..mesh.setup_vertices.len())
            .map(|i| {
                let p = mesh.skin_vertex_with_deform(
                    i,
                    &offsets[mesh.influence_range(i)],
                    &combined,
                    &host,
                );
                json!([p.x, p.y])
            })
            .collect();
        assert!(!mesh.inverse_bind_matrices.is_empty());
        let contributions: Vec<_> = (0..mesh.setup_vertices.len()).map(|i| {
            let range = mesh.influence_range(i);
            let terms: Vec<_> = mesh.weights[i].iter().enumerate().map(|(j,w)| {
                let inv = mesh.inverse_bind_matrices[&w.bone];
                let local = inv.transform_point(mesh.setup_vertices[i] + offsets[range.start+j]);
                let p = combined.world(w.bone).transform_point(local);
                json!({"bone":d.skeleton.bones[w.bone].name,"local":[local.x,local.y],"weight":w.weight,"world":[p.x,p.y],"weighted":[p.x*w.weight,p.y*w.weight]})
            }).collect();
            json!({"vertex":i,"total":mesh.weights[i].iter().map(|w|w.weight).sum::<f32>(),"fallback":mesh.weights[i].is_empty(),"terms":terms})
        }).collect();
        let flat: Vec<_> = offsets.iter().flat_map(|v| [v.x, v.y]).collect();
        frames.push(json!({"tick":tick,"clipTime":f.clip_time,"skin":f.skin,"epoch":f.epoch,"bones":f.bones.iter().map(|b|json!({"name":b.name,"local":[b.local.position.x,b.local.position.y,b.local.rotation,b.local.scale.x,b.local.scale.y,b.local.shear.x,b.local.shear.y],"world":[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]})).collect::<Vec<_>>(),"records":f.records.iter().map(|r|json!({"constraint":"spring","values":[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y]})).collect::<Vec<_>>(),"offsets":flat,"vertices":vertices,"contributions":contributions}));
    }
    fs::write(out.join("rust.json"),serde_json::to_vec(&json!({"source":"Independent Rust author FFD + Rust Replay bone/Physics composition, not TS or native-JSON skinning","frames":frames})).unwrap()).unwrap();
    println!(
        "Saved/reopened A2 author fixture, full native v2 export, 721 independent combined Rust frames"
    );
}
