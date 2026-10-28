use ankhimate_core::{
    replay_consumer::{ConsumerBone, ConsumerHealth, ReplayConsumerBridge},
    replay_skin::SkinEvent,
};
use ankhimate_export::{presets, run};
use ankhimate_formats::{ProjectRef, convert};
use serde_json::{Value, json};
use std::{fs, path::Path};
fn view(d: &ankhimate_formats::Loaded) -> ProjectRef<'_> {
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
fn pose(d: &ankhimate_formats::Loaded, skin: &str, bones: &[ConsumerBone]) -> Value {
    let s = &d.skeleton;
    let active = s.skins.iter().find(|(_, v)| v.name == skin).unwrap().0;
    let absent: Vec<_> = s
        .draw_order
        .iter()
        .filter(|id| s.resolve_slot(active, **id).is_none())
        .map(|id| s.slots[*id].name.clone())
        .collect();
    let draws:Vec<_>=s.draw_order.iter().filter_map(|id|{
  let slot=&s.slots[*id];let a=s.resolve_slot(active,*id)?;
  let (texture, local, uvs, triangles, kind)=match a {
 ankhimate_core::attachment::Attachment::Region(a)=>(a.texture.clone(),a.local_corners().to_vec(),vec![[0.,0.],[0.,1.],[1.,1.],[1.,0.]],vec![[0,1,2],[0,2,3]],"region"),
 ankhimate_core::attachment::Attachment::Mesh(a)=>{assert!(a.weights.is_empty()&&a.linked.is_none()&&a.ffd_keyframes.is_empty());(a.texture.clone(),a.setup_vertices.clone(),a.uvs.iter().map(|v|[v.x,v.y]).collect(),a.triangles.clone(),"mesh")},_=>panic!("unqualified")};
  let world=bones.iter().find(|b|b.name==s.bones[slot.bone].name).unwrap().world;
  Some(json!({"slot":slot.name,"attachment":slot.attachment,"texture":texture,"type":kind,"local":local.iter().map(|p|[p.x,p.y]).collect::<Vec<_>>(),"uvs":uvs,"triangles":triangles,"corners":local.iter().map(|p|{let v=world.transform_point(*p);[v.x,-v.y]}).collect::<Vec<_>>()}))
 }).collect();
    json!({"skin":skin,"absent":absent,"draws":draws,"bones":bones.iter().map(|b|json!({"name":b.name,"world":[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty],"local":[b.local.position.x,b.local.position.y,b.local.rotation,b.local.scale.x,b.local.scale.y,b.local.shear.x,b.local.shear.y]})).collect::<Vec<_>>()})
}
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let input = Path::new(&args[1]);
    let out = Path::new(&args[2]);
    fs::create_dir(out).unwrap();
    let mut d = ankhimate_formats::from_json(
        &fs::read_to_string(input.join("character.ankh.json")).unwrap(),
    )
    .unwrap();
    assert!(d.report.is_clean(), "{:?}", d.report);
    for a in d.assets.images.values_mut() {
        a.bytes = fs::read(input.join(format!("{}.png", a.name))).unwrap();
        let im = image::load_from_memory(&a.bytes).unwrap();
        assert_eq!((im.width(), im.height()), (a.width, a.height));
    }
    let selected: Vec<String> =
        serde_json::from_str(&fs::read_to_string(input.join("mesh-slots.json")).unwrap()).unwrap();
    let grid: Option<usize> = fs::read_to_string(input.join("mesh-grid.json"))
        .ok()
        .map(|v| serde_json::from_str(&v).unwrap());
    let names: std::collections::HashMap<_, _> = d
        .skeleton
        .slots
        .iter()
        .map(|(id, s)| (id, s.name.clone()))
        .collect();
    for (_, skin) in d.skeleton.skins.iter_mut() {
        for ((slot, _), a) in skin.entries.iter_mut() {
            if selected.contains(&names[slot]) {
                let ankhimate_core::attachment::Attachment::Region(region) = a else {
                    panic!("expected region")
                };
                let mut mesh = ankhimate_core::attachment::MeshAttachment::from_region(region);
                // An asymmetric center and alternating winding make permutations observable.
                let p = mesh.setup_vertices[0]
                    + (mesh.setup_vertices[3] - mesh.setup_vertices[0]) * 0.37
                    + (mesh.setup_vertices[1] - mesh.setup_vertices[0]) * 0.43;
                mesh.setup_vertices.push(p);
                let mut uv = mesh.uvs[0];
                uv.x = 0.37;
                uv.y = 0.43;
                mesh.uvs.push(uv);
                mesh.triangles = vec![[0, 1, 4], [2, 1, 4], [2, 3, 4], [0, 3, 4]];
                if let Some(g) = grid {
                    assert!((1..=32).contains(&g));
                    let q = region.local_corners();
                    mesh.setup_vertices.clear();
                    mesh.uvs.clear();
                    mesh.triangles.clear();
                    for y in 0..=g {
                        for x in 0..=g {
                            let u = x as f32 / g as f32;
                            let v = y as f32 / g as f32;
                            mesh.setup_vertices
                                .push(q[0] + (q[3] - q[0]) * u + (q[1] - q[0]) * v);
                            let mut uv = q[0];
                            uv.x = u;
                            uv.y = v;
                            mesh.uvs.push(uv);
                        }
                    }
                    for y in 0..g {
                        for x in 0..g {
                            let k = (y * (g + 1) + x) as u32;
                            let w = (g + 1) as u32;
                            mesh.triangles
                                .extend([[k, k + w, k + w + 1], [k, k + w + 1, k + 1]]);
                        }
                    }
                }
                *a = ankhimate_core::attachment::Attachment::Mesh(mesh);
            }
        }
    }
    fs::write(
        out.join("author-after-native-mesh-conversion.json"),
        ankhimate_formats::to_json(&view(&d)).unwrap(),
    )
    .unwrap();
    let before_schema = serde_json::to_value(convert::to_schema(&view(&d))).unwrap();
    let before_images: std::collections::BTreeMap<_, _> = d
        .assets
        .images
        .values()
        .map(|a| (a.name.clone(), a.bytes.clone()))
        .collect();
    ankhimate_formats::save(&out.join("Character.ankh"), &view(&d), &[]).unwrap();
    let (d, _) = ankhimate_formats::load(&out.join("Character.ankh")).unwrap();
    assert!(d.report.is_clean());
    assert_eq!(
        before_schema,
        serde_json::to_value(convert::to_schema(&view(&d))).unwrap(),
        "Save/Reload author schema"
    );
    assert_eq!(
        before_images,
        d.assets
            .images
            .values()
            .map(|a| (a.name.clone(), a.bytes.clone()))
            .collect(),
        "Save/Reload image bytes"
    );
    fs::write(out.join("SAVE-RELOAD.json"),serde_json::to_vec_pretty(&json!({"authorSchemaEqual":true,"imageBytesEqual":true,"images":before_images.len(),"noDeform":true,"unweightedOnly":true})).unwrap()).unwrap();
    let mut preset = presets::default_preset();
    preset.atlas.settings.max_page = 256;
    preset.atlas.settings.trim = selected.len() != 1 && !input.join("untrimmed").exists();
    let plan = run::plan(&convert::to_schema(&view(&d)), &d.assets, &preset).unwrap();
    run::write(&plan, out).unwrap();
    let clips: Vec<_> = d.animations.values().cloned().collect();
    for clip in clips.iter().map(|a| a.name.as_str()) {
        let name = clip;
        let events = vec![SkinEvent {
            tick: 0,
            skin: "default".into(),
        }];
        let mut b = ReplayConsumerBridge::new(&d.skeleton, &clips, clip, 1, Some(&events)).unwrap();
        b.play(&b.context(), clip, false).unwrap();
        let mut frames = vec![];
        for requested in 0..=720 {
            if requested > 0 {
                b.request_tick(&b.context(), requested, |_| {}).unwrap();
            }
            let f = b.current_frame().unwrap();
            let mut v = pose(&d, &f.skin, &f.bones);
            v["tick"] = json!(f.pose_tick);
            v["requested"] = json!(f.requested);
            v["completed"] = json!(f.completed);
            v["backlog"] = json!(f.backlog);
            v["health"] = json!(format!("{:?}", f.health).to_lowercase());
            v["active"] = json!(
                f.records
                    .iter()
                    .map(|r| d.skeleton.constraints[r.constraint].name())
                    .collect::<Vec<_>>()
            );
            v["records"]=json!(f.records.iter().map(|r|json!({"constraint":d.skeleton.constraints[r.constraint].name(),"bone":d.skeleton.bones[r.bone].name,"rotation":r.rotation,"x":r.position.x,"y":r.position.y,"rotationVelocity":r.rotation_velocity,"velocityX":r.position_velocity.x,"velocityY":r.position_velocity.y,"anchorX":r.anchor.x,"anchorY":r.anchor.y})).collect::<Vec<_>>());
            frames.push(v);
            if f.health == ConsumerHealth::Faulted {
                break;
            }
        }
        fs::write(
            out.join(format!("rust-{name}.json")),
            serde_json::to_vec(&frames).unwrap(),
        )
        .unwrap();
        let mut previews = vec![];
        if clip != "fault_at_20" {
            for tick in [
                0, 1, 8, 19, 20, 21, 30, 39, 40, 60, 119, 120, 121, 239, 240, 241, 600,
            ] {
                b.seek_tick(&b.context(), tick).unwrap();
                let f = b.preview_frame().unwrap().unwrap();
                let mut v = pose(&d, &f.skin, &f.bones);
                v["tick"] = json!(tick);
                previews.push(v);
            }
            fs::write(
                out.join(format!("rust-preview-{name}.json")),
                serde_json::to_vec(&previews).unwrap(),
            )
            .unwrap();
        }
    }
    println!("Native static meshes Save/Reload/export and independent Rust references complete");
}
