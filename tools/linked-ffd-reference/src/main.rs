//! A11 genuine A10 author API Save/reopen/export; independent f64 bind/FFD reference.
use ankhimate_core::{
    animation::{Interp, Key, Timeline},
    attachment::Attachment,
    replay_consumer::ReplayConsumerBridge,
};
use ankhimate_document::Document;
use serde_json::json;
use std::{fs, path::PathBuf};
mod fixture {
    include!("support/linked_frog.rs");
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
fn main() {
    let out = PathBuf::from(std::env::args().nth(1).expect("NEW_OUTPUT"));
    fs::create_dir(&out).expect("refuse existing output");
    let mut d = fixture::fixture();
    fixture::flag(&mut d, true);
    let body = d
        .skeleton
        .slots
        .iter()
        .find(|(_, s)| s.name == "body")
        .unwrap()
        .0;
    let skin = d.skeleton.default_skin;
    let rest = d.skeleton.skins[skin]
        .get(body, "linked_plain")
        .unwrap()
        .clone();
    d.skeleton.skins[skin]
        .entries
        .insert((body, "linked_rest".into()), rest);
    let decoy = d.skeleton.skins[skin].get(body, "body").unwrap().clone();
    d.skeleton.skins[skin]
        .entries
        .insert((body, "same_size_decoy".into()), decoy);
    let a = d.animations.values_mut().next().unwrap();
    let source = a
        .timelines
        .iter()
        .find(|t| matches!(t,Timeline::Deform{attachment,..}if attachment=="body"))
        .unwrap()
        .clone();
    for (name, factor) in [
        ("linked_plain", -0.35),
        ("linked_royal", 3.5),
        ("same_size_decoy", -1.75),
    ] {
        let mut t = source.clone();
        if let Timeline::Deform {
            attachment, keys, ..
        } = &mut t
        {
            *attachment = name.into();
            for k in keys {
                for v in &mut k.value {
                    *v *= factor;
                }
            }
        }
        a.timelines.push(t);
    }
    for t in &mut a.timelines {
        if let Timeline::SlotAttachment { slot, keys } = t
            && *slot == body
        {
            *keys = [
                (0., Some("body")),
                (0.25, Some("linked_royal")),
                (0.5, Some("linked_plain")),
                (0.75, Some("linked_rest")),
                (0.8, None),
                (0.9, Some("linked_plain")),
                (1.0, Some("linked_royal")),
                (1.1, Some("body")),
                (1.3, Some("linked_rest")),
                (1.4, Some("linked_plain")),
                (1.5, Some("body")),
            ]
            .into_iter()
            .map(|(time, name)| Key {
                time,
                value: name.map(str::to_owned),
                interp: Interp::Stepped,
            })
            .collect();
        }
    }
    let before = ankhimate_formats::convert::to_schema(&view(&d));
    ankhimate_formats::save(&out.join("Linked-FFD.ankh"), &view(&d), &[]).unwrap();
    let (loaded, _) = ankhimate_formats::load(&out.join("Linked-FFD.ankh")).unwrap();
    let mut d = Document::from_loaded(loaded);
    ankhimate_document::rebind::rebind_meshes(&mut d);
    assert_eq!(before, ankhimate_formats::convert::to_schema(&view(&d)));
    fs::write(
        out.join("author.json"),
        serde_json::to_vec_pretty(&before).unwrap(),
    )
    .unwrap();
    fs::create_dir(out.join("source")).unwrap();
    for image in d.assets.images.values() {
        fs::write(
            out.join("source").join(format!("{}.png", image.name)),
            &image.bytes,
        )
        .unwrap();
    }
    let mut preset = ankhimate_export::presets::default_preset();
    preset.atlas.settings.trim = false;
    preset.atlas.settings.max_page = 96;
    let plan = ankhimate_export::run::plan(&before, &d.assets, &preset).unwrap();
    ankhimate_export::run::write(&plan, &out.join("native")).unwrap();
    let full = d.animations.values().next().unwrap();
    let mut bone_clip = full.clone();
    bone_clip.timelines.retain(|t| {
        !matches!(
            t,
            Timeline::Deform { .. }
                | Timeline::SlotColor { .. }
                | Timeline::SlotVisible { .. }
                | Timeline::SlotAttachment { .. }
                | Timeline::DrawOrder { .. }
        )
    });
    bone_clip.events.clear();
    let mut replay =
        ReplayConsumerBridge::new(&d.skeleton, &[bone_clip], "linked_frog", 1, None).unwrap();
    let context = replay.context();
    replay.play(&context, "linked_frog", false).unwrap();
    let mut frames = vec![];
    let mut maximum = 0_f64;
    let mut offset_error = 0_f32;
    for tick in 0..=720 {
        if tick > 0 {
            replay.request_tick(&context, tick, |_| {}).unwrap();
        }
        let f = replay.current_frame().unwrap();
        assert_eq!(f.completed, tick);
        let mut p = fixture::pose(&d, f.clip_time);
        for (id, b) in &d.skeleton.bones {
            let v = f.bones.iter().find(|v| v.name == b.name).unwrap();
            p.locals[id] = v.local;
            p.worlds[id] = v.world;
        }
        let slots:Vec<_>=d.skeleton.slots.iter().map(|(id,s)|{let name=p.attachment_name(&d.skeleton,id);json!({"name":s.name,"owner":name.map(|_|"default"),"attachment":name,"visible":p.slot_visible.get(id).copied().unwrap_or(true),"color":p.slot_colors[id]})}).collect();
        let order: Vec<_> = p
            .draw_order
            .iter()
            .map(|id| d.skeleton.slots[*id].name.clone())
            .collect();
        let mut draws = vec![];
        let mut owners = vec![];
        for &slot in &p.draw_order {
            if p.slot_visible.get(slot) == Some(&false) {
                continue;
            }
            let Some(name) = p.attachment_name(&d.skeleton, slot) else {
                continue;
            };
            let Some(a) = d.skeleton.resolve_posed(&[skin], &p, slot) else {
                continue;
            };
            let host = p.world(d.skeleton.slots[slot].bone);
            let (texture, points, uv, indices, terms) = match a {
                Attachment::Mesh(m) => {
                    let (source, owner) = match name {
                        "linked_royal" => ("body", "body"),
                        "linked_plain" => ("body", "linked_plain"),
                        "linked_rest" => ("body", "linked_rest"),
                        "linked_cape" => ("cape", "linked_cape"),
                        _ => (name, name),
                    };
                    let (points, terms) =
                        fixture::independent(&d, &p, slot, source, owner, f.clip_time);
                    let resolved = d
                        .skeleton
                        .resolve_mesh_pose(&[skin], &p, slot, name)
                        .unwrap();
                    assert_eq!(resolved.geometry_owner.attachment, source);
                    assert_eq!(resolved.deform_owner.attachment, owner);
                    let expected = fixture::offsets(full, slot, owner, f.clip_time);
                    let offsets = resolved.offsets.unwrap_or_default();
                    assert_eq!(offsets.len(), expected.len());
                    for (a, b) in offsets.iter().zip(&expected) {
                        offset_error = offset_error.max((*a - *b).abs().max_element());
                        assert!((*a - *b).abs().max_element() < 0.001);
                    }
                    for (a, b) in resolved.vertices(&p).unwrap().iter().zip(&points) {
                        let e = (f64::from(a.x) - b[0])
                            .abs()
                            .max((f64::from(a.y) - b[1]).abs());
                        maximum = maximum.max(e);
                        assert!(e <= 0.01);
                    }
                    owners.push(json!({"skin":"default","slot":d.skeleton.slots[slot].name,"displayed":name,"geometrySource":source,"deformOwner":owner,"texture":m.texture,"offsets":expected.iter().map(|v|v.to_array()).collect::<Vec<_>>()}));
                    let g = resolved.geometry;
                    (
                        m.texture.clone(),
                        points,
                        g.uvs.iter().map(|v| v.to_array()).collect::<Vec<_>>(),
                        g.triangles.iter().flatten().copied().collect::<Vec<_>>(),
                        terms,
                    )
                }
                Attachment::Region(r) => {
                    let points = r
                        .local_corners()
                        .map(|v| host.transform_point(v))
                        .map(|v| [f64::from(v.x), f64::from(v.y)])
                        .to_vec();
                    let u = &r.uv_rect;
                    (
                        r.texture.clone(),
                        points,
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
                _ => panic!("outside A11"),
            };
            draws.push(json!({"slot":d.skeleton.slots[slot].name,"attachment":name,"texture":texture,"world":points,"positions":points.iter().flat_map(|p|[p[0],-p[1]]).collect::<Vec<_>>(),"sourceUV":uv,"indices":indices,"contributions":terms,"color":p.slot_colors[slot]}));
        }
        frames.push(json!({"tick":tick,"clipTime":f.clip_time,"preview":false,"skin":f.skin,"epoch":f.epoch,"slots":slots,"drawOrder":order,"owners":owners,"ffdSources":full.timelines.iter().filter_map(|t|match t{Timeline::Deform{slot,attachment,..}=>Some(json!({"skin":"default","slot":d.skeleton.slots[*slot].name,"attachment":attachment,"offsets":fixture::offsets(full,*slot,attachment,f.clip_time).iter().map(|v|v.to_array()).collect::<Vec<_>>()})),_=>None}).collect::<Vec<_>>(),"draws":draws,"bones":f.bones.iter().map(|b|json!({"name":b.name,"local":[b.local.position.x,b.local.position.y,b.local.rotation,b.local.scale.x,b.local.scale.y,b.local.shear.x,b.local.shear.y],"world":[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]})).collect::<Vec<_>>(),"records":f.records.iter().map(|r|json!({"constraint":"spring","values":[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y]})).collect::<Vec<_>>()}));
    }
    fs::write(out.join("oracle.json"),serde_json::to_vec(&json!({"source":"A11 extends genuine A10 author through native APIs, Save/reopen/export. A10 independent f64 Setup bind inversion + vector FFD and independent Bezier bisection. Accepted native continuous Physics, explicit owner table; no TypeScript outputs as expected.","maximum":maximum,"offsetError":offset_error,"frames":frames})).unwrap()).unwrap();
    println!("A11 B2 721 native accepted states maxWorld={maximum} offsetError={offset_error}");
}
