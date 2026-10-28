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
  let ankhimate_core::attachment::Attachment::Region(a)=a else{panic!("only regions")};
  let world=bones.iter().find(|b|b.name==s.bones[slot.bone].name).unwrap().world;
  Some(json!({"slot":slot.name,"attachment":slot.attachment,"texture":a.texture,"corners":a.local_corners().map(|p|{let v=world.transform_point(p);[v.x,-v.y]})}))
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
    ankhimate_formats::save(&out.join("Character.ankh"), &view(&d), &[]).unwrap();
    let (d, _) = ankhimate_formats::load(&out.join("Character.ankh")).unwrap();
    assert!(d.report.is_clean());
    let mut preset = presets::default_preset();
    preset.atlas.settings.max_page = 256;
    let plan = run::plan(&convert::to_schema(&view(&d)), &d.assets, &preset).unwrap();
    run::write(&plan, out).unwrap();
    let calendars: Value =
        serde_json::from_str(&fs::read_to_string(input.join("skin-calendars.json")).unwrap())
            .unwrap();
    fs::write(
        out.join("skin-calendars.json"),
        serde_json::to_vec_pretty(&calendars).unwrap(),
    )
    .unwrap();
    let clips: Vec<_> = d.animations.values().cloned().collect();
    let clip = if clips.iter().any(|a| a.name == "fault_at_20") {
        "fault_at_20"
    } else {
        "march"
    };
    for (name, events) in calendars.as_object().unwrap() {
        let events: Vec<_> = events
            .as_array()
            .unwrap()
            .iter()
            .map(|e| SkinEvent {
                tick: e["tick"].as_u64().unwrap(),
                skin: e["skin"].as_str().unwrap().into(),
            })
            .collect();
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
        if clip == "march" {
            for tick in [0, 19, 20, 21, 39, 40, 60, 119, 120, 121, 239, 240, 241, 600] {
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
    println!(
        "Native multi-skin Save/Reload/export and real B6 ReplayConsumer references complete: {clip}"
    );
}
