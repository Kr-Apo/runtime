//! Test-only native export and independent Rust CPU oracle; no JSON postprocessing.
use ankhimate_core::{
    assets::{AssetDb, ImageAsset},
    attachment::Attachment,
    pose::{self, Pose},
};
use ankhimate_document::Document;
use ankhimate_export::{presets, run};
use ankhimate_render::{Camera, Focus, FocusMode, FrameRequest};
use image::{ImageFormat, Rgba, RgbaImage};
use serde_json::{Value, json};
use std::{io::Cursor, path::PathBuf};

fn main() {
    let mut args = std::env::args().skip(1);
    let source = PathBuf::from(args.next().expect("M005.4a skins authoring.json"));
    let destination = PathBuf::from(args.next().expect("new output directory"));
    assert!(!destination.exists(), "refusing existing output");
    let original: Value = serde_json::from_slice(&std::fs::read(source).unwrap()).unwrap();
    for kind in ["audit", "region", "mesh"] {
        for multi in [false, true] {
            for dark in [false, true] {
                if kind == "audit" && (multi || dark) {
                    continue;
                }
                let name = format!(
                    "{kind}-{}-{}",
                    if multi { "multi" } else { "same" },
                    if dark { "dark" } else { "light" }
                );
                let output = destination.join(&name);
                std::fs::create_dir_all(&output).unwrap();
                let mut authoring = original.clone();
                if kind != "audit" {
                    authoring["name"] = json!(name);
                }
                if dark {
                    authoring["slots"][0]["color"] = json!([0.75, 0.8, 0.9, 0.65]);
                    authoring["slots"][0]["dark_color"] = json!([0.2, 0.1, 0.3, 1.0]);
                }
                for (i, skin) in authoring["skins"]
                    .as_array_mut()
                    .unwrap()
                    .iter_mut()
                    .enumerate()
                {
                    let texture = if i == 0 { "flat" } else { "red" };
                    let size = if i == 0 { 48.0 } else { 32.0 };
                    let attachment = if kind == "mesh" {
                        let h = size / 2.0;
                        json!({"type":"mesh","texture":texture,"vertices":[-h,h,-h,-h,h,-h,h,h],"uvs":[0,0,0,1,1,1,1,0],"triangles":[0,1,2,0,2,3]})
                    } else {
                        skin["entries"][0]["attachment"].clone()
                    };
                    if kind == "audit" {
                        continue;
                    }
                    let mut spare = attachment.clone();
                    spare["texture"] = json!(if i == 0 { "red" } else { "flat" });
                    skin["entries"] = json!([
                        {"slot":"art","name":"shape","attachment":attachment},
                        {"slot":"art","name":"spare","attachment":spare}
                    ]);
                }
                if kind != "audit" {
                    authoring["animations"][0]["timelines"].as_array_mut().unwrap().push(json!({
                    "kind":"slot_attachment","slot":"art","keys":[
                        {"time":0,"value":"shape"},{"time":0.5,"value":"spare"},{"time":0.75,"value":"shape"}
                    ]
                }));
                }
                let project = serde_json::from_value(authoring).unwrap();
                let mut doc =
                    Document::from_loaded(ankhimate_formats::convert::from_schema(&project));
                doc.assets = AssetDb::new();
                // Deliberately different source dimensions exercise atlas-page selection,
                // not just a color change within two equally sized frames.
                for (tex, width, height, color) in [
                    ("flat", 16, 16, [64, 128, 192, 128]),
                    (
                        "red",
                        if kind == "audit" { 16 } else { 12 },
                        if kind == "audit" { 16 } else { 20 },
                        [255, 32, 16, 255],
                    ),
                ] {
                    let pixels = RgbaImage::from_pixel(width, height, Rgba(color));
                    let mut bytes = Cursor::new(Vec::new());
                    pixels.write_to(&mut bytes, ImageFormat::Png).unwrap();
                    doc.assets
                        .add(ImageAsset::new(tex, bytes.into_inner(), width, height));
                }
                ankhimate_document::rebind::rebind_meshes(&mut doc);
                let schema = ankhimate_formats::convert::to_schema(&doc.as_project_ref());
                std::fs::write(
                    output.join("authoring.json"),
                    serde_json::to_vec_pretty(&schema).unwrap(),
                )
                .unwrap();
                let mut preset = presets::default_preset();
                preset.atlas.settings.trim = false;
                preset.atlas.settings.max_page = if multi { 22 } else { 128 };
                let plan = run::plan(&schema, &doc.assets, &preset).unwrap();
                run::write(&plan, &output.join("native")).unwrap();
                let native: Value = serde_json::from_str(&plan.files[0].contents).unwrap();
                assert_eq!(
                    native["atlas"]["pages"].as_array().unwrap().len(),
                    if multi { 2 } else { 1 }
                );
                let mut samples = vec![];
                for skin_name in ["default", "alternate"] {
                    let sid = doc
                        .skeleton
                        .skins
                        .iter()
                        .find(|(_, skin)| skin.name == skin_name)
                        .unwrap()
                        .0;
                    for (index, time) in [0.0, 0.25, 0.5, 0.75].into_iter().enumerate() {
                        let clip = doc.animations.values().next().unwrap();
                        let mut pose = Pose::new();
                        pose::evaluate_skinned(
                            &doc.skeleton,
                            &[(clip, time, 1.0)],
                            &[sid],
                            &mut pose,
                        );
                        let bones: Vec<_> = doc.skeleton.bones.iter().map(|(id, bone)| {
                            let w = pose.world(id);
                            json!({"name":bone.name,"world":{"a":w.a,"b":w.b,"c":w.c,"d":w.d,"tx":w.tx,"ty":w.ty}})
                        }).collect();
                        let (slot_id, slot) = doc
                            .skeleton
                            .slots
                            .iter()
                            .find(|(_, s)| s.name == "art")
                            .unwrap();
                        let attachment_name = pose
                            .attachment_name(&doc.skeleton, slot_id)
                            .unwrap()
                            .to_owned();
                        let attachment =
                            doc.skeleton.resolve_posed(&[sid], &pose, slot_id).unwrap();
                        let world = pose.world(slot.bone);
                        let (positions, texture, uvs, indices) = match attachment {
                            Attachment::Region(region) => (
                                region
                                    .local_corners()
                                    .map(|p| world.transform_point(p))
                                    .into_iter()
                                    .flat_map(|p| [p.x, p.y])
                                    .collect::<Vec<_>>(),
                                region.texture.clone(),
                                vec![0, 0, 0, 1, 1, 1, 1, 0],
                                vec![0, 1, 2, 0, 2, 3],
                            ),
                            Attachment::Mesh(mesh) => (
                                (0..mesh.setup_vertices.len())
                                    .map(|i| mesh.skin_vertex_with_deform(i, &[], &pose, &world))
                                    .flat_map(|p| [p.x, p.y])
                                    .collect(),
                                mesh.texture.clone(),
                                vec![0, 0, 0, 1, 1, 1, 1, 0],
                                mesh.triangles.iter().flat_map(|t| *t).collect(),
                            ),
                            _ => unreachable!(),
                        };
                        // render_frame intentionally uses the document's default skin.
                        // Select that same authored skin in this oracle-only document;
                        // neither the native export nor its JSON is changed.
                        let saved_default = doc.skeleton.default_skin;
                        doc.skeleton.default_skin = sid;
                        let frame = ankhimate_render::render_frame(
                            &doc,
                            &FrameRequest {
                                animation: Some("clip".into()),
                                time,
                                width: 256,
                                height: 256,
                                background: [0; 4],
                                camera: Camera {
                                    center: Some([0.0, 0.0]),
                                    zoom: Some(2.0),
                                    ..Default::default()
                                },
                                focus: Some(Focus {
                                    mode: FocusMode::ArtOnly,
                                    ..Default::default()
                                }),
                            },
                        )
                        .unwrap();
                        doc.skeleton.default_skin = saved_default;
                        let file = format!("cpu-{skin_name}-{index}.png");
                        std::fs::write(output.join(&file), frame.bytes).unwrap();
                        samples.push(json!({"skin":skin_name,"index":index,"time":time,"file":file,"bones":bones,"attachment":attachment_name,"texture":texture,"positions":positions,"uvs":uvs,"indices":indices}));
                    }
                }
                std::fs::write(output.join("reference.json"), serde_json::to_vec_pretty(&json!({
                    "editorCommit":"17d85aec3da14e82d3e7f1d5b65cea1844c8619c","width":256,"height":256,"origin":[128,128],"scale":2,"samples":samples
                })).unwrap()).unwrap();
                println!("{name}: native atlas + 8 independent Rust poses / CPU PNGs");
            }
        }
    }
}
