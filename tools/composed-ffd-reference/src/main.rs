//! A8 native author/export + independent Rust accepted Physics, FFD, slots and polygon clipping. Never patches native JSON.
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
    let project: schema::Project = serde_json::from_str(match std::env::args().nth(2).as_deref() {
        None | Some("a") => include_str!("author-source.json"),
        Some("b") => include_str!("author-source-clipped.json"),
        _ => panic!("gate must be a or b"),
    })
    .unwrap();
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
    ankhimate_formats::save(&out.join("Morphing-Frog.ankh"), &view(&d), &[]).unwrap();
    let (d, _) = ankhimate_formats::load(&out.join("Morphing-Frog.ankh")).unwrap();
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
            Timeline::Deform { .. }
                | Timeline::SlotColor { .. }
                | Timeline::SlotVisible { .. }
                | Timeline::SlotAttachment { .. }
                | Timeline::DrawOrder { .. }
        )
    });
    bone_clip.events.clear();
    let mut consumer =
        ReplayConsumerBridge::new(&d.skeleton, &[bone_clip], "morphing_frog", 1, None).unwrap();
    let context = consumer.context();
    consumer.play(&context, "morphing_frog", false).unwrap();
    let mut frames = vec![];
    for tick in 0..=720 {
        if tick > 0 {
            consumer.request_tick(&context, tick, |_| {}).unwrap();
        }
        let f = consumer.current_frame().unwrap();

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
        let mut masks = vec![];
        let mut active: Option<(Vec<glam::Vec2>, Option<String>, String)> = None;
        for &id in &pose.draw_order {
            let slot = &d.skeleton.slots[id];
            let a = d
                .skeleton
                .resolve_posed(&[d.skeleton.default_skin], &pose, id);
            if let Some(Attachment::Clipping(c)) = a {
                let world: Vec<_> = c
                    .vertices
                    .iter()
                    .map(|v| pose.world(slot.bone).transform_point(*v))
                    .collect();
                let screen: Vec<_> = world.iter().map(|v| glam::Vec2::new(v.x, -v.y)).collect();
                masks.push(json!({"slot":slot.name,"action":"activate","endSlot":c.end_slot,"world":world.iter().map(|v|vec![v.x,-v.y]).collect::<Vec<_>>(),"worldYUp":world.iter().map(|v|vec![v.x,v.y]).collect::<Vec<_>>(),"pieces":ankhimate_core::clipping::triangulate_polygon(&screen)}));
                active = Some((screen, c.end_slot.clone(), slot.name.clone()));
                continue;
            }
            let mask = active.clone();
            let ending = mask
                .as_ref()
                .is_some_and(|(_, end, _)| end.as_deref() == Some(&slot.name));
            masks.push(json!({"slot":slot.name,"action":if mask.is_some(){"masked"}else{"unmasked"},"mask":mask.as_ref().map(|(_,_,n)|n),"endInclusive":ending}));
            if ending {
                active = None;
            }
            if !pose.slot_visible.get(id).copied().unwrap_or(true) {
                continue;
            }
            let Some(a) = a else {
                continue;
            };
            let host = pose.world(slot.bone);
            let (texture, vertices, uvs, indices, contributions) = match a {
                Attachment::Mesh(m) => {
                    let vertices: Vec<_> = (0..m.setup_vertices.len())
                        .map(|i| {
                            let offsets = pose
                                .deforms
                                .get(&(
                                    id,
                                    pose.attachment_name(&d.skeleton, id).unwrap().to_owned(),
                                ))
                                .map(Vec::as_slice)
                                .unwrap_or(&[]);
                            let range = m.influence_range(i);
                            let p = m.skin_vertex_with_deform(
                                i,
                                if offsets.is_empty() {
                                    &[]
                                } else {
                                    &offsets[range]
                                },
                                &pose,
                                &host,
                            );
                            json!([p.x, p.y])
                        })
                        .collect();
                    let contributions:Vec<_>=(0..m.setup_vertices.len()).map(|i|{let row=m.weights.get(i).map(Vec::as_slice).unwrap_or(&[]);let terms:Vec<_>=row.iter().enumerate().map(|(j,w)|{let local=m.inverse_bind_matrices[&w.bone].transform_point(m.setup_vertices[i] + pose.deforms.get(&(id,pose.attachment_name(&d.skeleton,id).unwrap().to_owned())).map(|v|v[m.influence_range(i).start+j]).unwrap_or(glam::Vec2::ZERO));let p=pose.world(w.bone).transform_point(local);json!({"bone":d.skeleton.bones[w.bone].name,"weight":w.weight,"local":[local.x,local.y],"world":[p.x,p.y]})}).collect();json!({"fallback":row.is_empty(),"total":row.iter().map(|w|w.weight).sum::<f32>(),"terms":terms})}).collect();
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
                _ => panic!("outside A8"),
            };
            // Independent native Rust clipping in render Y-down coordinates, same traversal as CPU.
            let raw_world = vertices.clone();
            let source_uv = uvs.clone();
            let raw_indices = indices.clone();
            let subject: Vec<_> = vertices
                .iter()
                .zip(&uvs)
                .map(|(p, uv)| ankhimate_core::clipping::ClipVertex {
                    position: glam::Vec2::new(
                        p[0].as_f64().unwrap() as f32,
                        -(p[1].as_f64().unwrap() as f32),
                    ),
                    uv: glam::Vec2::new(uv[0], uv[1]),
                })
                .collect();
            let (cut, indices) = if let Some((polygon, _, _)) = &mask {
                ankhimate_core::clipping::clip_triangles(&subject, &indices, polygon)
            } else {
                (subject, indices)
            };
            if indices.is_empty() {
                continue;
            }
            let vertices: Vec<_> = cut
                .iter()
                .map(|v| json!([v.position.x, -v.position.y]))
                .collect();
            let uvs: Vec<_> = cut.iter().map(|v| vec![v.uv.x, v.uv.y]).collect();
            draws.push(json!({"slot":slot.name,"attachment":pose.attachment_name(&d.skeleton,id),"texture":texture,"world":vertices,"sourceUV":uvs,"rawWorld":raw_world,"rawSourceUV":source_uv,"rawIndices":raw_indices,"mask":mask.as_ref().map(|(_,_,n)|n),"indices":indices,"contributions":contributions,"color":pose.slot_colors[id]}));
        }
        frames.push(json!({"tick":tick,"clipTime":f.clip_time,"skin":f.skin,"epoch":f.epoch,"offsets":pose.deforms.iter().find(|((slot,name),_)|d.skeleton.slots[*slot].name=="body"&&name=="body").map(|(_,v)|v.iter().flat_map(|v|[v.x,v.y]).collect::<Vec<_>>()),"slots":slots,"masks":masks,"drawOrder":order,"draws":draws,"bones":f.bones.iter().map(|b|json!({"name":b.name,"local":[b.local.position.x,b.local.position.y,b.local.rotation,b.local.scale.x,b.local.scale.y,b.local.shear.x,b.local.shear.y],"world":[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]})).collect::<Vec<_>>(),"records":f.records.iter().map(|r|json!({"constraint":"spring","values":[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y]})).collect::<Vec<_>>()}));
    }
    fs::write(out.join("rust.json"),serde_json::to_vec(&json!({"source":"A2 Save/reopen/export, accepted native Rust Replay bone/Physics, native Rust core::clipping triangles/UV in render Y-down coordinates; no TS expected geometry","frames":frames})).unwrap()).unwrap();
    println!(
        "A2 author Save/reopen/export; multipage morphing_frog; 721 independent Rust accepted Physics/clipping/UV frames"
    );
}
