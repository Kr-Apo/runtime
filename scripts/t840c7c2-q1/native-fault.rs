//! Isolated diagnostic: real native B6 observer panic at a skin transition.
//! Not a favorable qualification producer and never imported by the runtime.
use ankhimate_core::{
    replay_consumer::{ConsumerFrame, ReplayConsumerBridge},
    replay_skin::SkinEvent,
};
use serde_json::{Value, json};
use std::{fs, path::Path};
fn snapshot(d: &ankhimate_formats::Loaded, f: &ConsumerFrame) -> Value {
    let s = &d.skeleton;
    let selected = s.skins.iter().find(|(_, s)| s.name == f.skin).unwrap().0;
    json!({"completed":f.completed,"requested":f.requested,"skin":f.skin,"health":format!("{:?}",f.health),
      "bones":f.bones.iter().map(|b|json!({"name":b.name,"local":[b.local.position.x,b.local.position.y,b.local.rotation,b.local.scale.x,b.local.scale.y,b.local.shear.x,b.local.shear.y],"world":[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]})).collect::<Vec<_>>(),
      "records":f.records.iter().map(|r|json!({"constraint":s.constraints[r.constraint].name(),"values":[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y]})).collect::<Vec<_>>(),
      "attachments":s.draw_order.iter().map(|id|json!({"slot":s.slots[*id].name,"type":match s.resolve_slot(selected,*id){Some(ankhimate_core::attachment::Attachment::Region(_))=>"region",Some(ankhimate_core::attachment::Attachment::Mesh(_))=>"mesh",None=>"absent",_=>"unsupported"}})).collect::<Vec<_>>()})
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a: Vec<_> = std::env::args().collect();
    let (d, _) = ankhimate_formats::load(Path::new(&a[1]))?;
    assert!(d.report.is_clean());
    let request: Value = serde_json::from_slice(&fs::read(&a[2])?)?;
    let events: Vec<_> = request["initialization"]["skinSchedule"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| SkinEvent {
            tick: e["tick"].as_u64().unwrap(),
            skin: e["skin"].as_str().unwrap().into(),
        })
        .collect();
    let clips: Vec<_> = d.animations.values().cloned().collect();
    let clip = request["clip"].as_str().unwrap();
    let mut c = ReplayConsumerBridge::new(&d.skeleton, &clips, clip, 1, Some(&events))?;
    c.play(&c.context(), clip, false)?;
    for tick in 1..20 {
        c.request_tick(&c.context(), tick, |_| {})?;
    }
    let before = snapshot(&d, &c.current_frame()?);
    let context = c.context();
    let hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        c.request_tick(&context, 20, |_| {
            panic!("Q1 deliberate precommit observer panic")
        })
    }));
    std::panic::set_hook(hook);
    assert!(outcome.is_err());
    let after = snapshot(&d, &c.current_frame()?);
    assert_eq!(before["completed"], 19);
    assert_eq!(after["completed"], 19);
    assert_eq!(after["health"], "Faulted");
    for key in ["skin", "bones", "records", "attachments"] {
        assert_eq!(before[key], after[key]);
    }
    let continuation_refused = c.request_tick(&c.context(), 21, |_| {}).is_err();
    assert!(continuation_refused);
    c.dispose(&c.context())?;
    let mut f = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&a[3])?;
    use std::io::Write;
    f.write_all(serde_json::to_string_pretty(&json!({"passed":true,"scenario":"real native observer panic at20, calendar default->festival","before":before,"after":after,"continuationRefused":continuation_refused,"notAFavorableQualification":true}))?.as_bytes())?;
    Ok(())
}
