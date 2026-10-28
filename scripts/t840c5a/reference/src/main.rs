use ankhimate_core::replay_consumer::ReplayConsumerBridge;
use ankhimate_export::{presets, run};
use ankhimate_formats::{ProjectRef, convert};
use serde_json::json;
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
        let image = image::load_from_memory(&a.bytes).unwrap();
        assert_eq!((image.width(), image.height()), (a.width, a.height));
    }
    ankhimate_formats::save(&out.join("Character.ankh"), &view(&d), &[]).unwrap();
    let (d, _) = ankhimate_formats::load(&out.join("Character.ankh")).unwrap();
    assert!(d.report.is_clean());
    let mut preset = presets::default_preset();
    preset.atlas.settings.max_page = 256;
    let plan = run::plan(&convert::to_schema(&view(&d)), &d.assets, &preset).unwrap();
    run::write(&plan, out).unwrap();
    let all: Vec<_> = d.animations.values().cloned().collect();
    for clip in ["march", "salute"] {
        let mut b = ReplayConsumerBridge::new(&d.skeleton, &all, clip, 1, None).unwrap();
        b.play(&b.context(), clip, false).unwrap();
        let mut frames = vec![];
        for tick in 0..=720 {
            if tick > 0 {
                b.request_tick(&b.context(), tick, |_| {}).unwrap();
            }
            let f = b.current_frame().unwrap();
            frames.push(json!({"tick":tick,"skin":f.skin,"bones":f.bones.iter().map(|b|json!({"name":b.name,"world":[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty],"local":[b.local.position.x,b.local.position.y,b.local.rotation,b.local.scale.x,b.local.scale.y,b.local.shear.x,b.local.shear.y]})).collect::<Vec<_>>(),"draws":d.skeleton.draw_order.iter().map(|id|{let slot=&d.skeleton.slots[*id];let a=d.skeleton.skins[d.skeleton.default_skin].get(*id,slot.attachment.as_ref().unwrap()).unwrap();let ankhimate_core::attachment::Attachment::Region(a)=a else{panic!("region required")};let world=f.bones.iter().find(|b|b.name==d.skeleton.bones[slot.bone].name).unwrap().world;json!({"slot":slot.name,"corners":a.local_corners().map(|p|{let v=world.transform_point(p);[v.x,-v.y]})})}).collect::<Vec<_>>(),"records":f.records.iter().map(|r|json!({"rotation":r.rotation,"x":r.position.x,"y":r.position.y,"rotationVelocity":r.rotation_velocity,"velocityX":r.position_velocity.x,"velocityY":r.position_velocity.y,"anchorX":r.anchor.x,"anchorY":r.anchor.y})).collect::<Vec<_>>()}));
        }
        fs::write(
            out.join(format!("rust-{clip}.json")),
            serde_json::to_vec(&frames).unwrap(),
        )
        .unwrap();
        let mut previews = vec![];
        for tick in [30, 90, 240, 600] {
            b.seek_tick(&b.context(), tick).unwrap();
            let f = b.preview_frame().unwrap().unwrap();
            previews.push(json!({"tick":tick,"skin":f.skin,"bones":f.bones.iter().map(|b|json!({"name":b.name,"world":[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty],"local":[b.local.position.x,b.local.position.y,b.local.rotation,b.local.scale.x,b.local.scale.y,b.local.shear.x,b.local.shear.y]})).collect::<Vec<_>>(),"draws":d.skeleton.draw_order.iter().map(|id|{let slot=&d.skeleton.slots[*id];let a=d.skeleton.skins[d.skeleton.default_skin].get(*id,slot.attachment.as_ref().unwrap()).unwrap();let ankhimate_core::attachment::Attachment::Region(a)=a else{panic!("region required")};let world=f.bones.iter().find(|b|b.name==d.skeleton.bones[slot.bone].name).unwrap().world;json!({"slot":slot.name,"corners":a.local_corners().map(|p|{let v=world.transform_point(p);[v.x,-v.y]})})}).collect::<Vec<_>>()}));
        }
        fs::write(
            out.join(format!("rust-preview-{clip}.json")),
            serde_json::to_vec(&previews).unwrap(),
        )
        .unwrap();
    }
    println!(
        "2 x721 exact ReplayConsumer reference frames, native save/reload and export complete"
    );
}
