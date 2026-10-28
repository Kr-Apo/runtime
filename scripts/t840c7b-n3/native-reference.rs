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
fn numeric(d: &Loaded, tick: u64, pose: &Pose, records: &[ReplayRecord]) -> Value {
    let mut meshes = Vec::new();
    for id in &d.skeleton.draw_order {
        let slot = &d.skeleton.slots[*id];
        let Some(Attachment::Mesh(mesh)) = d.skeleton.resolve_slot(d.skeleton.default_skin, *id)
        else {
            continue;
        };
        let mut vertices = Vec::new();
        for (i, base) in mesh.setup_vertices.iter().enumerate() {
            let p = mesh.skin_vertex_with_deform(i, &[], pose, &pose.world(slot.bone));
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
            vertices.push(json!({"position":vec(&[p.x,p.y]),"influences":influences}));
        }
        meshes.push(json!({"slot":slot.name,"vertices":vertices}));
    }
    json!({"tick":tick,"bones":d.skeleton.update_order.iter().map(|id|{let b=&d.skeleton.bones[*id];let t=pose.locals[*id];let w=pose.world(*id);let tip=w.transform_point(glam::Vec2::new(b.length,0.));json!({"name":b.name,"local":vec(&[t.position.x,t.position.y,t.rotation,t.scale.x,t.scale.y,t.shear.x,t.shear.y]),"matrix":matrix(Affine2::compose(&t)),"world":matrix(w),"tip":vec(&[tip.x,tip.y])})}).collect::<Vec<_>>(),"records":records.iter().map(|r|json!({"constraint":d.skeleton.constraints[r.constraint].name(),"bone":d.skeleton.bones[r.bone].name,"values":vec(&[r.rotation,r.position.x,r.position.y,r.rotation_velocity,r.position_velocity.x,r.position_velocity.y,r.anchor.x,r.anchor.y])})).collect::<Vec<_>>(),"meshes":meshes})
}
fn current(d: &Loaded, f: &ConsumerFrame) -> Value {
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
    numeric(d, f.pose_tick, &pose, &f.records)
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
    if a.len() != 7 {
        return Err("usage: reference project.ankh skeleton.json request.json requestHash evidence.json regenerated.json".into());
    }
    let q: Value = serde_json::from_slice(&fs::read(&a[3])?)?;
    let (mut d, _) = ankhimate_formats::load(Path::new(&a[1]))?;
    if !d.report.is_clean() {
        return Err("unclean project load report".into());
    }
    let mut setup = Pose::new();
    ankhimate_core::pose::evaluate(&d.skeleton, &[], &mut setup);
    let worlds: std::collections::HashMap<_, _> = d
        .skeleton
        .slots
        .iter()
        .map(|(id, s)| (id, setup.world(s.bone)))
        .collect();
    for skin in d.skeleton.skins.values_mut() {
        for ((slot, _), att) in &mut skin.entries {
            if let Attachment::Mesh(m) = att {
                m.bind_to_pose(&setup, worlds[slot]);
            }
        }
    }
    let mut preset = presets::default_preset();
    preset.atlas.settings.max_page = q["exportSettings"]["maxPage"]
        .as_u64()
        .ok_or("missing maxPage")? as u32;
    preset.atlas.settings.trim = q["exportSettings"]["trim"]
        .as_bool()
        .ok_or("missing trim")?;
    let plan = run::plan(&convert::to_schema(&view(&d)), &d.assets, &preset)?;
    let bytes = plan
        .files
        .iter()
        .find(|f| f.path == "skeleton.json")
        .ok_or("missing generated skeleton")?
        .contents
        .as_bytes();
    write_new(Path::new(&a[6]), bytes)?;
    if bytes != fs::read(&a[2])? {
        write_new(
            Path::new(&a[5]),
            &serde_json::to_vec(
                &json!({"requestHash":a[4],"invalidInput":"supplied JSON is not the exact E1 regenerated native export for these settings"}),
            )?,
        )?;
        return Ok(());
    }
    let clips: Vec<_> = d.animations.values().cloned().collect();
    let clip = q["clip"].as_str().ok_or("clip")?;
    let mut variants = Vec::new();
    for spec in q["histories"].as_array().ok_or("histories")? {
        let id = spec["id"].as_str().ok_or("id")?;
        let mut c = ReplayConsumerBridge::new(&d.skeleton, &clips, clip, 1, None)?;
        let f = c.current_frame()?;
        let mut frames = vec![current(&d, &f)];
        let mut resets = Vec::new();
        let mut endpoints = vec![meta(&f)];
        let mut commits = vec![current(&d, &f)];
        let mut resetting = false;
        let mut preview = Value::Null;
        let mut termination = Value::Null;
        for cmd in spec["commands"].as_array().ok_or("commands")? {
            let op = cmd["op"].as_str().ok_or("op")?;
            if op == "reset" {
                c.reset(&c.context(), cmd["epoch"].as_str().ok_or("epoch")?.parse()?)?;
                resetting = true;
                let f = c.current_frame()?;
                resets.push(current(&d, &f));
                endpoints.push(meta(&f));
                commits.push(current(&d, &f));
                continue;
            }
            let target = if resetting { &mut resets } else { &mut frames };
            let mut audit = |f: &ReplayFrame| {
                if id != "step" {
                    target.push(numeric(&d, f.tick, &f.pose, &f.records));
                }
            };
            let outcome: Result<(), Box<dyn std::error::Error>> = (|| {
                match op {
                    "play" => c.play(
                        &c.context(),
                        clip,
                        cmd["restart"].as_bool().ok_or("restart")?,
                    )?,
                    "request" => {
                        c.request_tick(
                            &c.context(),
                            cmd["tick"].as_u64().ok_or("tick")?,
                            &mut audit,
                        )?;
                    }
                    "pump" => {
                        c.pump(
                            &c.context(),
                            cmd["budget"].as_u64().ok_or("budget")? as u32,
                            &mut audit,
                        )?;
                    }
                    "seek" => {
                        c.seek_tick(&c.context(), cmd["tick"].as_u64().ok_or("tick")?)?;
                        let p = c.preview_frame()?.ok_or("missing preview")?;
                        let mut pose = Pose::new();
                        for b in p.bones {
                            let id = *d
                                .skeleton
                                .update_order
                                .iter()
                                .find(|id| d.skeleton.bones[**id].name == b.name)
                                .unwrap();
                            pose.locals.insert(id, b.local);
                            pose.worlds.insert(id, b.world);
                        }
                        preview = numeric(&d, p.tick, &pose, &[]);
                    }
                    "replay" => {
                        c.replay_from_origin(&c.context(), cmd["tick"].as_u64().ok_or("tick")?)?
                    }
                    "pause" => c.pause(&c.context())?,
                    "resume" => c.resume(&c.context())?,
                    _ => return Err("unknown command".into()),
                }
                Ok(())
            })();
            if let Err(e) = outcome {
                termination = json!({"kind":"error","message":e.to_string()});
                break;
            }
            let f = c.current_frame()?;
            if id == "step"
                && op == "request"
                && frames.last().unwrap()["tick"] != json!(f.pose_tick)
            {
                frames.push(current(&d, &f));
            }
            endpoints.push(meta(&f));
            if id != "step" {
                commits.push(current(&d, &f));
            }
            if f.health == ankhimate_core::replay_consumer::ConsumerHealth::Faulted {
                termination =
                    json!({"kind":"faulted","requested":f.requested,"completed":f.completed});
                break;
            }
        }
        c.dispose(&c.context())?;
        let mut v =
            json!({"id":id,"commands":spec["commands"],"frames":frames,"endpoints":endpoints});
        if id != "step" {
            v["commits"] = json!(commits);
        }
        if id == "reset" {
            v["resetFrames"] = json!(resets);
        }
        if !preview.is_null() {
            v["preview"] = preview;
        }
        if !termination.is_null() {
            v["termination"] = termination;
        }
        variants.push(v);
    }
    write_new(
        Path::new(&a[5]),
        &serde_json::to_vec(
            &json!({"requestHash":a[4],"producer":"native E1 public ReplayConsumer + native MeshAttachment; exact export regenerated","variants":variants}),
        )?,
    )?;
    Ok(())
}
