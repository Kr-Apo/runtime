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

fn prepare_fixture(
    input: &Path,
    out: &Path,
    combined: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    fs::create_dir(out)?;
    let (mut d, _) = ankhimate_formats::load(input)?;
    if !d.report.is_clean() {
        return Err("source load report".into());
    }
    if combined {
        let slot = d
            .skeleton
            .slots
            .iter()
            .find(|(_, s)| s.name == "head")
            .ok_or("head slot")?
            .0;
        let host = d.skeleton.slots[slot].bone;
        let partner = d
            .skeleton
            .bones
            .iter()
            .find(|(_, b)| b.name == "torso")
            .ok_or("torso bone")?
            .0;
        let third = d
            .skeleton
            .bones
            .iter()
            .find(|(_, b)| b.name == "neck")
            .ok_or("neck bone")?
            .0;
        let name = d.skeleton.slots[slot]
            .attachment
            .clone()
            .ok_or("attachment name")?;
        let skins: Vec<_> = d
            .skeleton
            .skins
            .iter()
            .filter(|(_, s)| s.name == "festival" || s.name == "night")
            .map(|(id, _)| id)
            .collect();
        let mut setup = Pose::new();
        ankhimate_core::pose::evaluate(&d.skeleton, &[], &mut setup);
        for id in skins {
            let Some(Attachment::Region(region)) = d.skeleton.skins[id].get(slot, &name).cloned()
            else {
                return Err("expected author region".into());
            };
            let mut mesh = ankhimate_core::attachment::MeshAttachment::from_region(&region);
            if d.skeleton.skins[id].name == "night" {
                let center = mesh.setup_vertices.iter().copied().sum::<glam::Vec2>() / 4.;
                mesh.setup_vertices.push(center);
                let uv = mesh.uvs.iter().copied().sum::<glam::Vec2>() / 4.;
                mesh.uvs.push(uv);
                mesh.triangles = vec![[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
            }
            mesh.weights = (0..mesh.setup_vertices.len())
                .map(|i| {
                    let w = [0.1, 0.35, 0.8, 0.95, 0.5][i];
                    if i == 4 {
                        vec![
                            ankhimate_core::attachment::VertexWeight {
                                bone: host,
                                weight: 0.4,
                            },
                            ankhimate_core::attachment::VertexWeight {
                                bone: partner,
                                weight: 0.35,
                            },
                            ankhimate_core::attachment::VertexWeight {
                                bone: third,
                                weight: 0.25,
                            },
                        ]
                    } else {
                        vec![
                            ankhimate_core::attachment::VertexWeight {
                                bone: host,
                                weight: w,
                            },
                            ankhimate_core::attachment::VertexWeight {
                                bone: partner,
                                weight: 1. - w,
                            },
                        ]
                    }
                })
                .collect();
            mesh.bind_to_pose(&setup, setup.world(host));
            if mesh.inverse_bind_matrices.len() < 2 {
                return Err("invalid author bind".into());
            }
            d.skeleton.skins[id].set(slot, name.clone(), Attachment::Mesh(mesh));
        }
        d.name = "Q1 Combined Courier".into();
    }
    ankhimate_formats::save(&out.join("Character.ankh"), &view(&d), &[])?;
    let (d, _) = ankhimate_formats::load(&out.join("Character.ankh"))?;
    if !d.report.is_clean() {
        return Err("saved copy load report".into());
    }
    let mut preset = presets::default_preset();
    preset.atlas.settings.max_page = 256;
    preset.atlas.settings.trim = false;
    let plan = run::plan(&convert::to_schema(&view(&d)), &d.assets, &preset)?;
    run::write(&plan, out)?;
    write_new(
        &out.join("AUTHOR-PROVENANCE.json"),
        &serde_json::to_vec_pretty(
            &json!({"workflow":"native formats::load -> MeshAttachment::from_region/bind_to_pose (combined only) -> formats::save/load -> standard E1 plan/write","combined":combined,"source":input.to_string_lossy(),"savedProject":"Character.ankh","maxPage":256,"trim":false,"noRuntimeJSONPatch":true,"noRenderer":true}),
        )?,
    )?;
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let a: Vec<_> = std::env::args().collect();
    if a.get(1).map(String::as_str) == Some("prepare") {
        return prepare_fixture(
            Path::new(&a[2]),
            Path::new(&a[3]),
            a.get(4).map(String::as_str) == Some("combined"),
        );
    }
    if a.len() != 7 {
        return Err("usage: reference project.ankh skeleton.json request.json requestHash evidence.json regenerated.json".into());
    }
    let q: Value = serde_json::from_slice(&fs::read(&a[3])?)?;
    let wire: Value = serde_json::from_slice(&fs::read(&a[2])?)?;
    let events: Vec<_> = q["initialization"]["skinSchedule"]
        .as_array()
        .ok_or("calendar")?
        .iter()
        .map(|e| {
            Ok(ankhimate_core::replay_skin::SkinEvent {
                tick: e["tick"].as_u64().ok_or("event tick")?,
                skin: e["skin"].as_str().ok_or("event skin")?.into(),
            })
        })
        .collect::<Result<Vec<_>, Box<dyn std::error::Error>>>()?;
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
        let mut c = ReplayConsumerBridge::new(&d.skeleton, &clips, clip, 1, Some(&events))?;
        let f = c.current_frame()?;
        let mut frames = vec![current(&d, &wire, &f)];
        let mut resets = Vec::new();
        let mut endpoints = vec![meta(&f)];
        let mut commits = vec![current(&d, &wire, &f)];
        let mut resetting = false;
        let mut preview = Value::Null;
        let mut termination = Value::Null;
        for cmd in spec["commands"].as_array().ok_or("commands")? {
            let op = cmd["op"].as_str().ok_or("op")?;
            if op == "reset" {
                c.reset(&c.context(), cmd["epoch"].as_str().ok_or("epoch")?.parse()?)?;
                resetting = true;
                let f = c.current_frame()?;
                resets.push(current(&d, &wire, &f));
                endpoints.push(meta(&f));
                commits.push(current(&d, &wire, &f));
                continue;
            }
            let target = if resetting { &mut resets } else { &mut frames };
            let mut audit = |f: &ReplayFrame| {
                if id != "step" {
                    target.push(numeric(
                        &d,
                        &wire,
                        f.tick,
                        skin_at(&events, f.tick),
                        &f.pose,
                        &f.records,
                    ));
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
                        preview = numeric(&d, &wire, p.tick, &p.skin, &pose, &[]);
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
                frames.push(current(&d, &wire, &f));
            }
            endpoints.push(meta(&f));
            if id != "step" {
                commits.push(current(&d, &wire, &f));
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
