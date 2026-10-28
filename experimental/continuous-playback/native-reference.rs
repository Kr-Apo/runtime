use ankhimate_core::{
    attachment::Attachment,
    pose::Pose,
    replay_consumer::{ConsumerFrame, ReplayConsumerBridge},
    replay_physics::{ReplayFrame, ReplayRecord},
    transforms::Affine2,
};
use ankhimate_export::{presets, run};
use ankhimate_formats::{Loaded, ProjectRef, convert};
use serde_json::{Value, json};
use std::{fs, io::Write, path::Path};
fn n(v: f32) -> Value {
    if v.is_finite() {
        json!(v)
    } else {
        json!({"$nonfinite":v.to_string()})
    }
}
fn vec(v: &[f32]) -> Value {
    json!(v.iter().map(|x| n(*x)).collect::<Vec<_>>())
}
fn matrix(m: Affine2) -> Value {
    vec(&[m.a, m.b, m.c, m.d, m.tx, m.ty])
}

fn skin_at(events: &[ankhimate_core::replay_skin::SkinEvent], tick: u64) -> &str {
    &events
        .iter()
        .rev()
        .find(|e| e.tick <= tick)
        .expect("calendar origin")
        .skin
}
fn selection(d: &Loaded, wire: &Value, skin: &str) -> Value {
    let s = &d.skeleton;
    let selected = s
        .skins
        .iter()
        .find(|(_, v)| v.name == skin)
        .expect("selected skin")
        .0;
    let (_, inactive) = s.inactive_skin_members(&[selected]);
    let active: Vec<_> = s
        .constraint_order
        .iter()
        .filter(|id| !inactive.contains(id))
        .map(|id| s.constraints[*id].name())
        .collect();
    let attachments:Vec<_>=s.draw_order.iter().map(|id|{
        let slot=&s.slots[*id];
        let name=slot.attachment.as_deref();
        let attachment=s.resolve_slot(selected,*id);
        let Some(a)=attachment else{return json!({"slot":slot.name,"name":name,"owner":null,"type":null,"texture":null,"page":null,"topology":null});};
        let owner=if name.is_some_and(|name|s.skins[selected].get(*id,name).is_some()){skin}else{&s.skins[s.default_skin].name};
        let (kind,texture,topology)=match a {
            Attachment::Region(a)=>("region",a.texture.as_str(),Value::Null),
            Attachment::Mesh(m)=>{
                let influences:Vec<Vec<_>>=m.weights.iter().map(|row|row.iter().map(|w|s.bones[w.bone].name.clone()).collect()).collect();
                ("mesh",m.texture.as_str(),json!({"vertexCount":m.setup_vertices.len(),"indices":m.triangles.iter().flatten().copied().collect::<Vec<_>>(),"weighted":!m.weights.is_empty(),"influences":influences}))
            },
            _=>panic!("Q1 only static native region/mesh"),
        };
        let region=wire["atlas"]["regions"].as_array().expect("atlas").iter().find(|r|r["name"].as_str()==Some(texture)).expect("texture region");
        json!({"slot":slot.name,"name":name,"owner":owner,"type":kind,"texture":texture,"page":region["page"],"topology":topology})
    }).collect();
    json!({"skin":skin,"active":active,"attachments":attachments})
}
fn numeric(
    d: &Loaded,
    wire: &Value,
    tick: u64,
    skin: &str,
    pose: &Pose,
    records: &[ReplayRecord],
) -> Value {
    let selected = d
        .skeleton
        .skins
        .iter()
        .find(|(_, s)| s.name == skin)
        .expect("native skin")
        .0;
    let mut meshes = Vec::new();
    for id in &d.skeleton.draw_order {
        let slot = &d.skeleton.slots[*id];
        let Some(Attachment::Mesh(mesh)) = d.skeleton.resolve_slot(selected, *id) else {
            continue;
        };
        let mut vertices = Vec::new();
        for (i, base) in mesh.setup_vertices.iter().enumerate() {
            let position = mesh.skin_vertex_with_deform(i, &[], pose, &pose.world(slot.bone));
            let influences = mesh
                .weights
                .get(i)
                .into_iter()
                .flatten()
                .map(|w| {
                    let bind = mesh.inverse_bind_matrices[&w.bone];
                    let p = pose.world(w.bone).mul(&bind).transform_point(*base);
                    json!({"bone":d.skeleton.bones[w.bone].name,"position":vec(&[p.x,p.y])})
                })
                .collect::<Vec<_>>();
            vertices
                .push(json!({"position":vec(&[position.x,position.y]),"influences":influences}));
        }
        meshes.push(json!({"slot":slot.name,"vertices":vertices}));
    }
    json!({"tick":tick,"selection":selection(d,wire,skin),"bones":d.skeleton.update_order.iter().map(|id|{
        let b=&d.skeleton.bones[*id];let t=pose.locals[*id];let w=pose.world(*id);let tip=w.transform_point(glam::Vec2::new(b.length,0.));
        json!({"name":b.name,"local":vec(&[t.position.x,t.position.y,t.rotation,t.scale.x,t.scale.y,t.shear.x,t.shear.y]),"matrix":matrix(Affine2::compose(&t)),"world":matrix(w),"tip":vec(&[tip.x,tip.y])})
    }).collect::<Vec<_>>(),"records":records.iter().map(|r|json!({"constraint":d.skeleton.constraints[r.constraint].name(),"bone":d.skeleton.bones[r.bone].name,"values":vec(&[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y])})).collect::<Vec<_>>(),"meshes":meshes})
}
fn current(d: &Loaded, wire: &Value, f: &ConsumerFrame) -> Value {
    let mut pose = Pose::new();
    for b in &f.bones {
        let id = *d
            .skeleton
            .update_order
            .iter()
            .find(|id| d.skeleton.bones[**id].name == b.name)
            .unwrap();
        pose.locals.insert(id, b.local);
        pose.worlds.insert(id, b.world);
    }
    numeric(d, wire, f.pose_tick, &f.skin, &pose, &f.records)
}
fn meta(f: &ConsumerFrame) -> Value {
    json!({"epoch":f.epoch.to_string(),"requested":f.requested.to_string(),"completed":f.completed.to_string(),"backlog":f.backlog.to_string(),"poseTick":f.pose_tick,"poseTime":[f.pose_time.numerator.to_string(),f.pose_time.denominator.to_string()],"clipTime":n(f.clip_time),"state":format!("{:?}",f.state).to_lowercase().replace("seekpreview","seek_preview"),"health":format!("{:?}",f.health).to_lowercase(),"skin":f.skin,"targetReached":f.target_reached})
}
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
fn write_new(path: &Path, v: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let mut f = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)?;
    f.write_all(v)?;
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a: Vec<_> = std::env::args().collect();
    if a.len() != 6 {
        return Err("usage: project native case output regenerated".into());
    }
    let (mut d, _) = ankhimate_formats::load(Path::new(&a[1]))?;
    if !d.report.is_clean() {
        return Err("unclean author project".into());
    }
    let wire: Value = serde_json::from_slice(&fs::read(&a[2])?)?;
    let spec: Value = serde_json::from_slice(&fs::read(&a[3])?)?;
    let events: Vec<_> = spec["events"]
        .as_array()
        .ok_or("events")?
        .iter()
        .map(|e| {
            Ok(ankhimate_core::replay_skin::SkinEvent {
                tick: e["tick"].as_u64().ok_or("tick")?,
                skin: e["skin"].as_str().ok_or("skin")?.into(),
            })
        })
        .collect::<Result<Vec<_>, Box<dyn std::error::Error>>>()?;
    // Same public E1 setup bind/regeneration path as the unchanged Q1 reference.
    let mut setup = Pose::new();
    ankhimate_core::pose::evaluate(&d.skeleton, &[], &mut setup);
    let worlds: std::collections::HashMap<_, _> = d
        .skeleton
        .slots
        .iter()
        .map(|(id, s)| (id, setup.world(s.bone)))
        .collect();
    for skin in d.skeleton.skins.values_mut() {
        for ((slot, _), a) in &mut skin.entries {
            if let Attachment::Mesh(m) = a {
                m.bind_to_pose(&setup, worlds[slot]);
            }
        }
    }
    let mut preset = presets::default_preset();
    preset.atlas.settings.max_page = spec["exportSettings"]["maxPage"]
        .as_u64()
        .ok_or("maxPage")? as u32;
    preset.atlas.settings.trim = spec["exportSettings"]["trim"].as_bool().ok_or("trim")?;
    let plan = run::plan(&convert::to_schema(&view(&d)), &d.assets, &preset)?;
    let bytes = plan
        .files
        .iter()
        .find(|f| f.path == "skeleton.json")
        .ok_or("native")?
        .contents
        .as_bytes();
    if bytes != fs::read(&a[2])? {
        return Err("native regenerated bytes differ".into());
    }
    write_new(Path::new(&a[5]), bytes)?;
    let clips: Vec<_> = d.animations.values().cloned().collect();
    let clip = spec["clip"].as_str().ok_or("clip")?;
    let checkpoints: std::collections::BTreeSet<_> = spec["checkpoints"]
        .as_array()
        .ok_or("checkpoints")?
        .iter()
        .map(|t| t.as_u64().ok_or("point"))
        .collect::<Result<_, _>>()?;
    let horizon = spec["horizon"].as_u64().ok_or("horizon")?;
    let mut c = ReplayConsumerBridge::new(&d.skeleton, &clips, clip, 1, Some(&events))?;
    let mut frames = vec![
        json!({"meta":meta(&c.current_frame()?),"numeric":current(&d,&wire,&c.current_frame()?)}),
    ];
    c.play(&c.context(), clip, false)?;
    let mut max_abs = 0.0_f32;
    for tick in 1..=horizon {
        c.request_tick(&c.context(), tick, &mut |_: &ReplayFrame| {})?;
        let f = c.current_frame()?;
        if f.completed != tick
            || f.epoch != 1
            || f.health != ankhimate_core::replay_consumer::ConsumerHealth::Healthy
            || f.skin != skin_at(&events, tick)
        {
            return Err(format!("first invalid frame at{tick}").into());
        }
        for b in &f.bones {
            let t = b.local;
            let w = b.world;
            let values = [
                t.position.x,
                t.position.y,
                t.rotation,
                t.scale.x,
                t.scale.y,
                t.shear.x,
                t.shear.y,
                w.a,
                w.b,
                w.c,
                w.d,
                w.tx,
                w.ty,
            ];
            if !values.iter().all(|v| v.is_finite()) {
                return Err(format!("first nonfinite bone at{tick}").into());
            }
            for v in values {
                max_abs = max_abs.max(v.abs());
            }
        }
        for r in &f.records {
            if ![
                r.rotation,
                r.position.x,
                r.position.y,
                r.rotation_velocity,
                r.position_velocity.x,
                r.position_velocity.y,
                r.anchor.x,
                r.anchor.y,
            ]
            .iter()
            .all(|v| v.is_finite())
            {
                return Err(format!("first nonfinite record at{tick}").into());
            }
        }
        if checkpoints.contains(&tick) {
            frames.push(json!({"meta":meta(&f),"numeric":current(&d,&wire,&f)}));
        }
    }
    c.dispose(&c.context())?;
    write_new(
        Path::new(&a[4]),
        &serde_json::to_vec(
            &json!({"mode":"I2 application experiment, NOT Q1 certificate","horizon":horizon,"ticksChecked":horizon,"finiteEveryCommittedTick":true,"maxAbsoluteBoneValue":n(max_abs),"nativeRegenerationExact":true,"frames":frames}),
        )?,
    )?;
    Ok(())
}
