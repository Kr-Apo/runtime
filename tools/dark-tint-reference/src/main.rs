//! Independent Rust oracle. Requires the editor sibling checkout at M005.3a.
//! Refuses an existing destination; never updates reviewed snapshots implicitly.
use ankhimate_core::assets::{AssetDb, ImageAsset};
use ankhimate_document::Document;
use ankhimate_export::{presets, run};
use ankhimate_formats::schema::Project;
use ankhimate_render::{Camera, Focus, FocusMode, FrameRequest};
use image::{ImageFormat, Rgba, RgbaImage};
use serde_json::{Value, json};
use std::{io::Cursor, path::PathBuf};

fn region(texture: &str) -> Value {
    json!({"type":"region","texture":texture,"width":64,"height":64,"uv":[0,0,1,1]})
}

fn main() {
    let destination = PathBuf::from(std::env::args().nth(1).expect("output directory required"));
    let scale: f32 = std::env::args()
        .nth(2)
        .unwrap_or_else(|| "1".into())
        .parse()
        .unwrap();
    let offset = if scale == 1.0 { 0.0 } else { 0.25 };
    assert!(
        !destination.exists(),
        "refusing to overwrite an existing fixture"
    );
    let mut bones = vec![json!({"name":"root","length":1})];
    let mut slots = vec![];
    let mut entries = vec![];
    let specs = [
        ("zero", -240, 128, "flat", [0.2, 0.4, 0.6, 0.0], "normal"),
        ("half", -144, 128, "flat", [0.2, 0.4, 0.6, 0.5], "normal"),
        ("full", -48, 128, "flat", [0.2, 0.4, 0.6, 1.0], "normal"),
        ("extreme", 48, 128, "flat", [1.0, 0.0, 1.0, 1.0], "normal"),
        (
            "fraction",
            144,
            128,
            "flat",
            [0.12345679, 0.2345679, 0.3456789, 0.375],
            "normal",
        ),
        ("mesh", 240, 128, "flat", [0.2, 0.4, 0.6, 0.5], "normal"),
        ("animated", -240, 32, "flat", [0.2, 0.4, 0.6, 1.0], "normal"),
        ("switch", -144, 32, "flat", [0.2, 0.4, 0.6, 0.5], "normal"),
        ("under", 0, 32, "flat", [1.0, 0.0, 0.0, 0.5], "normal"),
        ("over", 0, 32, "red", [0.0, 1.0, 0.0, 0.5], "normal"),
        ("edge", 144, 32, "edge", [0.2, 0.4, 0.6, 1.0], "normal"),
        (
            "transparent",
            240,
            32,
            "transparent",
            [1.0, 1.0, 1.0, 1.0],
            "normal",
        ),
        ("add", -240, -96, "flat", [0.2, 0.4, 0.6, 0.5], "additive"),
        (
            "multiply",
            -144,
            -96,
            "flat",
            [0.2, 0.4, 0.6, 0.5],
            "multiply",
        ),
        ("screen", -48, -96, "flat", [0.2, 0.4, 0.6, 0.5], "screen"),
    ];
    for (name, x, y, texture, dark, blend) in specs {
        bones.push(json!({"name":name,"parent":"root","length":1,"tx":x,"ty":y}));
        slots.push(json!({"name":name,"bone":name,"attachment":"art","color":[0.5,0.25,0.75,0.5],"dark_color":dark,"blend_mode":blend}));
        let art = if name == "mesh" {
            json!({"type":"mesh","texture":texture,"vertices":[-32,32,-32,-32,32,-32,32,32],"uvs":[0,0,0,1,1,1,1,0],"triangles":[0,1,2,0,2,3]})
        } else {
            region(texture)
        };
        entries.push(json!({"slot":name,"name":"art","attachment":art}));
        if name == "switch" {
            entries.push(json!({"slot":name,"name":"red","attachment":region("red")}));
        }
    }
    let timelines = vec![
        json!({"kind":"bone_translate","bone":"root","axis":"x","keys":[{"time":0,"value":0,"curve":"linear"},{"time":1,"value":4,"curve":"linear"}]}),
        json!({"kind":"slot_color","slot":"animated","keys":[{"time":0,"value":[1,1,1,1],"curve":"linear"},{"time":1,"value":[0.4,0.6,0.8,0.25],"curve":"linear"}]}),
        json!({"kind":"slot_attachment","slot":"switch","keys":[{"time":0,"value":"art"},{"time":0.5,"value":"red"}]}),
        json!({"kind":"draw_order","keys":[{"time":0,"offsets":[]},{"time":0.5,"offsets":[["under",1]]}]}),
    ];
    let assets: Vec<_> = ["flat", "red", "edge", "transparent"]
        .into_iter()
        .map(|name| json!({"name":name,"file":format!("{name}.png"),"width":64,"height":64}))
        .collect();
    let project: Project = serde_json::from_value(json!({"version":1,"name":"dark-tint-reference","fps":60,"assets":assets,"bones":bones,"slots":slots,
        "skins":[{"name":"default","entries":entries}],"default_skin":"default",
        "animations":[
            {"name":"pulse","duration":1,"looping":true,"timelines":timelines,"events":[{"time":0.25,"name":"step","string_value":"shadow"}]},
            {"name":"alternate","duration":1,"looping":true,"timelines":[{"kind":"bone_translate","bone":"root","axis":"x","keys":[{"time":0,"value":0,"curve":"linear"},{"time":1,"value":-4,"curve":"linear"}]}],"events":[{"time":0.75,"name":"step","string_value":"alternate"}]}
        ]})).unwrap();
    let mut doc = Document::from_loaded(ankhimate_formats::convert::from_schema(&project));
    doc.assets = AssetDb::new();
    for name in ["flat", "red", "edge", "transparent"] {
        let mut image = RgbaImage::from_pixel(64, 64, Rgba([64, 128, 192, 128]));
        if name == "red" {
            image = RgbaImage::from_pixel(64, 64, Rgba([255, 0, 0, 255]));
        }
        if name == "transparent" {
            image = RgbaImage::from_pixel(64, 64, Rgba([200, 100, 50, 0]));
        }
        if name == "edge" {
            for (x, _, pixel) in image.enumerate_pixels_mut() {
                // A broad alpha ramp and colored transparent border exercise PMA filtering.
                let alpha = ((x as f32 - 8.0).clamp(0.0, 32.0) / 32.0 * 255.0).round() as u8;
                *pixel = Rgba([64, 128, 192, alpha]);
            }
        }
        let mut bytes = Cursor::new(Vec::new());
        image.write_to(&mut bytes, ImageFormat::Png).unwrap();
        doc.assets
            .add(ImageAsset::new(name, bytes.into_inner(), 64, 64));
    }
    let mut preset = presets::default_preset();
    preset.atlas.settings.trim = false;
    preset.atlas.settings.max_page = 80;
    let schema = ankhimate_formats::convert::to_schema(&doc.as_project_ref());
    let plan = run::plan(&schema, &doc.assets, &preset).unwrap();
    run::write(&plan, &destination).unwrap();
    let exported: Value = serde_json::from_str(&plan.files[0].contents).unwrap();
    assert_eq!(exported["format_version"], 2);
    assert_eq!(exported["atlas"]["pages"].as_array().unwrap().len(), 4);
    std::fs::write(
        destination.join("authoring.json"),
        serde_json::to_vec_pretty(&schema).unwrap(),
    )
    .unwrap();
    let mut samples = vec![];
    for clip in ["pulse", "alternate"] {
        for (index, time) in [0.0, 0.25, 0.5, 0.75].into_iter().enumerate() {
            for (label, background) in [("clear", [0; 4]), ("opaque", [32, 48, 64, 255])] {
                let request = FrameRequest {
                    animation: Some(clip.into()),
                    time,
                    width: 640,
                    height: 384,
                    background,
                    camera: Camera {
                        center: Some([-offset / scale, offset / scale]),
                        zoom: Some(scale),
                        ..Default::default()
                    },
                    focus: Some(Focus {
                        mode: FocusMode::ArtOnly,
                        ..Default::default()
                    }),
                };
                let frame = ankhimate_render::render_frame(&doc, &request).unwrap();
                let file = format!("cpu-{clip}-{label}-{index}.png");
                std::fs::write(destination.join(&file), frame.bytes).unwrap();
                samples.push(
                    json!({"clip":clip,"time":time,"index":index,"background":label,"file":file}),
                );
            }
        }
    }
    std::fs::write(destination.join("reference.json"),serde_json::to_vec_pretty(&json!({
        "editorCommit":"367238cfa432fb597bbe3c40a64f1c75217a4312","width":640,"height":384,"scale":scale,"origin":[320.0+offset,192.0+offset],"samples":samples,
        "normalSlots":specs.iter().filter(|s|s.5=="normal").map(|s|json!({"name":s.0,"center":[s.1,s.2],"texture":s.3})).collect::<Vec<_>>()
    })).unwrap()).unwrap();
    println!(
        "Native unpatched export, four atlas pages and sixteen independent CPU frames: {}",
        destination.display()
    );
}
