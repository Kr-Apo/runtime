//! Test oracles only: authoring -> real native export, and independently transformed Rust CPU frames.
use ankhimate_core::{
    assets::{AssetDb, ImageAsset},
    pose::{self, Pose},
};
use ankhimate_document::Document;
use ankhimate_export::{presets, run};
use ankhimate_render::{Camera, Focus, FocusMode, FrameRequest};
use image::{ImageFormat, Rgba, RgbaImage};
use serde_json::{Value, json};
use std::{io::Cursor, path::PathBuf};

fn region(texture: &str, size: f32, x: f32) -> Value {
    json!({"type":"region","texture":texture,"width":size,"height":size,"offset_x":x,"uv":[0,0,1,1]})
}
fn entry(slot: &str, name: &str, attachment: Value) -> Value {
    json!({"slot":slot,"name":name,"attachment":attachment})
}
fn make_case(name: &str) -> Value {
    let end = if name == "end-unresolved" {
        Some("missing")
    } else if name == "end-empty" || name == "successive" {
        None
    } else {
        Some("shape")
    };
    let mut slots = vec![
        json!({"name":"mask","bone":"root","attachment":"mask"}),
        json!({"name":"art","bone":"root","attachment":"shape"}),
        json!({"name":"end","bone":"root","attachment":end}),
        json!({"name":"after","bone":"root","attachment":"shape"}),
    ];
    let polygon = if name == "concave" {
        vec![-32, -32, 32, -32, 32, 0, 0, 0, 0, 32, -32, 32]
    } else {
        vec![-32, -32, 0, -32, 0, 32, -32, 32]
    };
    let mut entries = vec![
        entry(
            "mask",
            "mask",
            json!({"type":"clipping","vertices":polygon,"end_slot":"end"}),
        ),
        entry("art", "shape", region("flat", 64.0, 0.0)),
        entry("end", "shape", region("green", 16.0, 8.0)),
        entry("after", "shape", region("red", 24.0, 48.0)),
    ];
    let mut tracks = vec![
        json!({"kind":"bone_translate","bone":"root","axis":"x","keys":[{"time":0,"value":0,"curve":"linear"},{"time":1,"value":8,"curve":"linear"}]}),
    ];
    if name == "draw-order" {
        tracks.push(json!({"kind":"draw_order","keys":[{"time":0,"offsets":[]},{"time":0.5,"offsets":[["after",-1]]},{"time":0.75,"offsets":[]}]}));
    }
    if name == "end-invisible" {
        tracks.push(json!({"kind":"slot_visible","slot":"end","keys":[{"time":0,"value":false}]}));
    }
    if name == "end-path" {
        entries[2]["attachment"] =
            json!({"type":"path","vertices":[0,0,1,0,1,1],"closed":false,"constant_speed":true});
    }
    if name == "end-animated" {
        tracks.push(json!({"kind":"slot_attachment","slot":"end","keys":[{"time":0,"value":"shape"},{"time":0.25,"value":null},{"time":0.5,"value":"missing"},{"time":0.75,"value":"shape"}]}));
    }
    if name == "toggle" {
        tracks.push(json!({"kind":"slot_attachment","slot":"mask","keys":[{"time":0,"value":"mask"},{"time":0.5,"value":null},{"time":0.75,"value":"mask"}]}));
    }
    if name == "mesh-multi-dark" {
        entries[1]["attachment"] = json!({"type":"mesh","texture":"flat","vertices":[-32,32,-32,-32,32,-32,32,32],"uvs":[0,0,0,1,1,1,1,0],"triangles":[0,1,2,0,2,3]});
        slots[1]["color"] = json!([0.75, 0.8, 0.9, 0.65]);
        slots[1]["dark_color"] = json!([0.2, 0.1, 0.3, 1.0]);
    }
    if name == "successive" {
        slots.extend([
            json!({"name":"mask2","bone":"root","attachment":"mask"}),
            json!({"name":"art2","bone":"root","attachment":"shape"}),
            json!({"name":"end2","bone":"root","attachment":null}),
            json!({"name":"after2","bone":"root","attachment":"shape"}),
        ]);
        entries.extend([
            entry(
                "mask2",
                "mask",
                json!({"type":"clipping","vertices":[64,-32,96,-32,96,32,64,32],"end_slot":"end2"}),
            ),
            entry("art2", "shape", region("flat", 64.0, 96.0)),
            entry("after2", "shape", region("red", 24.0, 144.0)),
        ]);
    }
    json!({"version":1,"name":name,"fps":60,"bones":[{"name":"root","length":1}],"slots":slots,"skins":[{"name":"default","entries":entries}],"default_skin":"default","animations":[{"name":"clip","duration":1,"looping":true,"timelines":tracks}]})
}
fn assets() -> AssetDb {
    let mut db = AssetDb::new();
    for (name, color) in [
        ("flat", [64, 128, 192, 128]),
        ("red", [255, 32, 16, 255]),
        ("green", [32, 255, 64, 255]),
    ] {
        let mut bytes = Cursor::new(Vec::new());
        RgbaImage::from_pixel(16, 16, Rgba(color))
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        db.add(ImageAsset::new(name, bytes.into_inner(), 16, 16));
    }
    db
}
fn doc(value: Value, db: &AssetDb) -> Document {
    let schema = serde_json::from_value(value).unwrap();
    let mut doc = Document::from_loaded(ankhimate_formats::convert::from_schema(&schema));
    doc.assets = db.clone();
    ankhimate_document::rebind::rebind_meshes(&mut doc);
    doc
}
fn transform(x: f64, y: f64, sx: f64, sy: f64, r: f64) -> Value {
    json!({"x":x,"y":y,"sx":sx,"sy":sy,"rotation":r,"scrollFactorX":1,"scrollFactorY":1})
}
fn config(mode: &str, index: usize, name: &str) -> Value {
    let mut c = json!({"root":transform(192.0,128.0,1.0,1.0,0.0),"camera":{"scrollX":0,"scrollY":0,"zoom":1,"rotation":0}});
    match mode {
        "audit" => {
            c["root"] = if name.contains("identity") || name == "audit-empty" {
                transform(0.0, 0.0, 1.0, 1.0, 0.0)
            } else if name.contains("transformed") {
                transform(140.0, 148.0, 3.0, 3.0, 0.0)
            } else {
                transform(128.0, 128.0, 2.0, 2.0, 0.0)
            };
        }
        "translated" => c["root"] = transform(190.0, 120.0, 1.4, 0.9, 0.0),
        "rotated" => c["root"] = transform(192.0, 128.0, 1.3, 0.8, 0.35),
        "nested" => {
            c["root"] = transform(12.0, -8.0, 0.9, 1.1, -0.2);
            c["parent"] = transform(180.0, 140.0, 1.2, 0.8, 0.3);
        }
        "camera" => c["camera"] = json!({"scrollX":12,"scrollY":-8,"zoom":1.1,"rotation":-0.12}),
        "parallax" => {
            c["root"]["scrollFactorX"] = json!(0.6);
            c["root"]["scrollFactorY"] = json!(0.8);
            c["camera"] = json!({"scrollX":20,"scrollY":-12,"zoom":1.1,"rotation":0.1});
        }
        "dynamic" => {
            let i = index as f64;
            c["root"] = transform(
                180.0 + 8.0 * i,
                128.0 - 4.0 * i,
                1.0 + 0.1 * i,
                0.85 + 0.05 * i,
                0.1 * i,
            );
            c["camera"] = json!({"scrollX":2.0*i,"scrollY":-i,"zoom":1.0+0.02*i,"rotation":0.03*i});
        }
        _ => {}
    }
    c
}
fn wrapped(mut source: Value, c: &Value, width: u32, height: u32) -> Value {
    // Independent Rust authoring wrapper bones express the declared Container /
    // camera transforms in Y-up space. CPU rasterization and clipping stay Rust.
    let n = |v: &Value, k: &str| v[k].as_f64().unwrap();
    let root = &c["root"];
    let cam = &c["camera"];
    let mut wrappers = vec![
        json!({"name":"__camera","tx":width as f64/2.0,"ty":-(height as f64)/2.0,"rotation":-n(cam,"rotation").to_degrees(),"sx":n(cam,"zoom"),"sy":n(cam,"zoom")}),
    ];
    let parent = &c["parent"];
    let fx = n(root, "scrollFactorX")
        * parent
            .get("scrollFactorX")
            .and_then(Value::as_f64)
            .unwrap_or(1.0);
    let fy = n(root, "scrollFactorY")
        * parent
            .get("scrollFactorY")
            .and_then(Value::as_f64)
            .unwrap_or(1.0);
    wrappers.push(json!({"name":"__scroll","parent":"__camera","tx":-(width as f64/2.0)-n(cam,"scrollX")*fx,"ty":height as f64/2.0+n(cam,"scrollY")*fy}));
    let mut parent_name = "__scroll";
    if parent.is_object() {
        wrappers.push(json!({"name":"__parent","parent":parent_name,"tx":n(parent,"x"),"ty":-n(parent,"y"),"rotation":-n(parent,"rotation").to_degrees(),"sx":n(parent,"sx"),"sy":n(parent,"sy")}));
        parent_name = "__parent";
    }
    wrappers.push(json!({"name":"__container","parent":parent_name,"tx":n(root,"x"),"ty":-n(root,"y"),"rotation":-n(root,"rotation").to_degrees(),"sx":n(root,"sx"),"sy":n(root,"sy")}));
    for bone in source["bones"].as_array_mut().unwrap().iter_mut() {
        if bone
            .get("parent")
            .and_then(Value::as_str)
            .unwrap_or("")
            .is_empty()
        {
            bone["parent"] = json!("__container");
        }
    }
    for wrapper in &mut wrappers {
        wrapper["length"] = json!(1);
    }
    wrappers.extend(source["bones"].as_array().unwrap().iter().cloned());
    source["bones"] = json!(wrappers);
    source
}
fn main() {
    let mut args = std::env::args().skip(1);
    let sources = PathBuf::from(args.next().expect("audit source directory"));
    let dest = PathBuf::from(args.next().expect("new output directory"));
    assert!(!dest.exists(), "refusing existing output");
    std::fs::create_dir_all(&dest).unwrap();
    let mut specs = vec![];
    for (label, original) in [
        ("audit-identity", "clip_identity"),
        ("audit-empty", "clip_identity_hidden_end"),
        ("audit-transformed", "clip_transformed"),
        ("audit-rect", "clip_rect"),
        ("audit-concave", "clip_concave"),
    ] {
        specs.push((
            label.to_owned(),
            serde_json::from_slice::<Value>(
                &std::fs::read(sources.join(format!("{original}.json"))).unwrap(),
            )
            .unwrap(),
            true,
        ));
    }
    for name in [
        "end-visible",
        "end-empty",
        "end-unresolved",
        "end-invisible",
        "end-path",
        "end-animated",
        "successive",
        "mesh-multi-dark",
        "toggle",
        "draw-order",
        "concave",
    ] {
        specs.push((name.into(), make_case(name), false));
    }
    let mut summary = vec![];
    for (name, value, audit) in specs {
        let out = dest.join(&name);
        std::fs::create_dir(&out).unwrap();
        let mut db = assets();
        // Keep the historical audit atlas exactly as authored: only flat + red.
        if audit {
            db = AssetDb::new();
            for (tex, color) in [("flat", [64, 128, 192, 128]), ("red", [255, 32, 16, 255])] {
                let mut b = Cursor::new(Vec::new());
                RgbaImage::from_pixel(16, 16, Rgba(color))
                    .write_to(&mut b, ImageFormat::Png)
                    .unwrap();
                db.add(ImageAsset::new(tex, b.into_inner(), 16, 16));
            }
        }
        let d = doc(value, &db);
        let schema = ankhimate_formats::convert::to_schema(&d.as_project_ref());
        let authoring = serde_json::to_value(&schema).unwrap();
        std::fs::write(
            out.join("authoring.json"),
            serde_json::to_vec_pretty(&schema).unwrap(),
        )
        .unwrap();
        let mut preset = presets::default_preset();
        preset.atlas.settings.trim = false;
        if name == "mesh-multi-dark" {
            preset.atlas.settings.max_page = 20;
        }
        let plan = run::plan(&schema, &db, &preset).unwrap();
        run::write(&plan, &out.join("native")).unwrap();
        let width = if audit { 256 } else { 384 };
        let height = 256;
        let mut samples = vec![];
        for mode in if audit {
            vec!["audit"]
        } else {
            vec![
                "identity",
                "translated",
                "rotated",
                "nested",
                "camera",
                "parallax",
                "dynamic",
            ]
        } {
            for (index, time) in [0.0, 0.25, 0.5, 0.75].into_iter().enumerate() {
                let c = config(mode, index, &name);
                let rd = doc(wrapped(authoring.clone(), &c, width, height), &db);
                let clip = rd.animations.values().next().unwrap();
                let mut p = Pose::new();
                pose::evaluate(&rd.skeleton, &[(clip, time, 1.0)], &mut p);
                let mut bones = vec![];
                for (id, b) in rd
                    .skeleton
                    .bones
                    .iter()
                    .filter(|(_, b)| !b.name.starts_with("__"))
                {
                    let w = p.world(id);
                    bones.push(
                        json!({"name":b.name,"a":w.a,"b":w.b,"c":w.c,"d":w.d,"tx":w.tx,"ty":w.ty}),
                    );
                }
                let root_id = rd
                    .skeleton
                    .bones
                    .iter()
                    .find(|(_, b)| b.name == "root")
                    .unwrap()
                    .0;
                let w = p.world(root_id);
                let probes:Vec<_>=[("inside",-16.0,16.0),("masked",16.0,16.0),("after",48.0,0.0)].into_iter().map(|(label,x,y)|json!({"label":label,"x":w.a*x+w.c*y+w.tx,"y":-(w.b*x+w.d*y+w.ty)})).collect();
                let frame = ankhimate_render::render_frame(
                    &rd,
                    &FrameRequest {
                        animation: Some("clip".into()),
                        time,
                        width,
                        height,
                        background: [0; 4],
                        camera: Camera {
                            center: Some([width as f32 / 2.0, -(height as f32) / 2.0]),
                            zoom: Some(1.0),
                            ..Default::default()
                        },
                        focus: Some(Focus {
                            mode: FocusMode::ArtOnly,
                            ..Default::default()
                        }),
                    },
                )
                .unwrap();
                let file = format!("cpu-{mode}-{index}.png");
                std::fs::write(out.join(&file), frame.bytes).unwrap();
                samples.push(json!({"mode":mode,"index":index,"time":time,"config":c,"file":file,"bones":bones,"probes":probes}));
            }
        }
        std::fs::write(out.join("reference.json"),serde_json::to_vec_pretty(&json!({"editorCommit":"17d85aec3da14e82d3e7f1d5b65cea1844c8619c","width":width,"height":height,"samples":samples})).unwrap()).unwrap();
        summary.push(json!({"name":name,"audit":audit,"samples":samples.len(),"concave":name.contains("concave")}));
        println!(
            "{name}: native export and {} Rust CPU references",
            samples.len()
        );
    }
    std::fs::write(
        dest.join("cases.json"),
        serde_json::to_vec_pretty(&summary).unwrap(),
    )
    .unwrap();
}
