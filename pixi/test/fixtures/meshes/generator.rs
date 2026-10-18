//! Isolated authoring fixtures, exported by the real Rust pipeline. Never patch runtime JSON.
use ankhimate_core::{assets::{AssetDb,ImageAsset},attachment::Attachment,pose::{self,Pose}};
use ankhimate_document::Document;
use ankhimate_export::{presets,run};
use ankhimate_render::{Camera,Focus,FocusMode,FrameRequest};
use image::{Rgba,RgbaImage,ImageFormat};
use serde_json::{Value,json};
use std::{path::Path,io::Cursor};
fn mesh(tex:&str)->Value{json!({"type":"mesh","texture":tex,"vertices":[-24,24,-30,-16,8,-26,30,-4,12,28],"uvs":[0,0,0,1,0.6,1,1,0.6,0.8,0],"triangles":[0,1,2,0,2,4,2,3,4]})}
fn entry(slot:&str,name:&str,a:Value)->Value{json!({"slot":slot,"name":name,"attachment":a})}
fn track(kind:&str,bone:&str,axis:&str,end:f32)->Value{json!({"kind":kind,"bone":bone,"axis":axis,"keys":[{"time":0,"value":if kind=="bone_scale"{1.0}else{0.0},"curve":"linear"},{"time":1,"value":end,"curve":"linear"}]})}
fn ffd(n:usize,sign:f32,curve:&str)->Value{
 let offsets:Vec<_>=(0..n).map(|i|sign*if i%2==0{(i%7) as f32*1.5+2.}else{(i%5) as f32*-1.2-1.}).collect();
 let mut middle=json!({"time":0.5,"offsets":offsets,"curve":curve});if curve=="bezier"{middle["handles"]=json!([0.2,1.2,0.8,-0.1]);}
 json!({"kind":"deform","slot":"art","attachment":"shape","keys":[{"time":0,"offsets":vec![0.;n],"curve":"linear"},middle,{"time":1,"offsets":vec![0.;n],"curve":"linear"}]})
}
fn author(name:&str)->Value{
 let weighted=name=="weighted_complex"||name=="partial_ffd";
 let mut a=mesh("banner");if weighted{let mut w=vec![json!([["host",0.25],["tip",0.75]]);5];if name=="partial_ffd"{w[1]=json!([]);}a["weights"]=json!(w);}
 let mut entries=vec![entry("art","shape",a)];let mut slots=vec![json!({"name":"art","bone":"host","attachment":"shape","color":[1,1,1,0.8]})];
 if name=="trim_multi"{entries.push(entry("back","shape",mesh("second")));slots.insert(0,json!({"name":"back","bone":"other","attachment":"shape"}));}
 if name=="topology"{entries.push(entry("art","triangle",json!({"type":"mesh","texture":"second","vertices":[-25,20,-8,-22,28,3],"uvs":[0,0,0.25,1,1,0.3],"triangles":[0,1,2]})));}
 let n=if name=="partial_ffd"{16}else if weighted{20}else{10};
 let mut timelines=vec![track("bone_rotate","host","x",35.),track("bone_rotate","tip","x",-28.),track("bone_scale","host","y",1.25),track("bone_shear","other","x",14.)];
 let mut relax=vec![track("bone_rotate","host","x",-25.)];
 if name!="asymmetric"&&name!="topology"{timelines.push(ffd(n,1.,if name=="partial_ffd"{"stepped"}else{"bezier"}));relax.push(ffd(n,-0.7,"linear"));}
 if name=="trim_multi"{timelines.push(json!({"kind":"draw_order","keys":[{"time":0,"offsets":[]},{"time":0.5,"offsets":[["back",1],["art",-1]]},{"time":1,"offsets":[]}]}));}
 if name=="topology"{timelines.push(json!({"kind":"slot_attachment","slot":"art","keys":[{"time":0,"value":"shape"},{"time":0.5,"value":"triangle"},{"time":1,"value":"shape"}]}));}
 json!({"version":1,"name":name,"fps":60,
 "bones":[{"name":"root","length":8,"tx":3,"ty":-4,"rotation":9,"sx":if name=="weighted_complex"{-1.1}else{1.1},"sy":0.85,"shear_x":7,"shear_y":-4},
 {"name":"host","parent":"root","length":20,"tx":4,"ty":5,"rotation":17,"sx":1.1,"sy":0.9},
 {"name":"other","parent":"root","length":16,"tx":-8,"ty":-3,"rotation":-12},
 {"name":"tip","parent":"other","length":12,"tx":14,"ty":5,"rotation":22,"shear_x":-6}],
 "slots":slots,"skins":[{"name":"default","entries":entries}],"default_skin":"default",
 "assets":[{"name":"banner","file":"banner.png","width":64,"height":64},{"name":"second","file":"second.png","width":64,"height":64}],
 "animations":[{"name":"clip","duration":1,"looping":true,"timelines":timelines},{"name":"relax","duration":1,"looping":true,"timelines":relax}]})
}
fn sample(doc:&Document,p:&Pose)->Value{
 let bones:Vec<_>=doc.skeleton.bones.iter().map(|(id,b)|json!({"name":b.name,"world":p.worlds[id]})).collect();let mut slots=vec![];
 for id in &p.draw_order{let s=&doc.skeleton.slots[*id];let Some(Attachment::Mesh(m))=doc.skeleton.resolve_posed(&[doc.skeleton.default_skin],p,*id)else{continue};
  let name=p.attachment_name(&doc.skeleton,*id).unwrap();let d=p.deforms.get(&(*id,name.into()));let mut positions=vec![];
  for i in 0..m.setup_vertices.len(){let offsets=match d{Some(d) if !m.weights.is_empty()=>d.get(m.influence_range(i)).unwrap_or_default().to_vec(),Some(d)=>vec![d.get(i).copied().unwrap_or_default()],None=>vec![]};let v=m.skin_vertex_with_deform(i,&offsets,p,&p.world(s.bone));positions.extend([v.x,v.y]);}
  slots.push(json!({"name":s.name,"attachment":name,"positions":positions,"indices":m.triangles.iter().flat_map(|t|*t).collect::<Vec<_>>()}));
 }
 let deforms:Vec<_>=p.deforms.iter().map(|((id,n),d)|json!({"slot":doc.skeleton.slots[*id].name,"attachment":n,"offsets":d.iter().flat_map(|v|[v.x,v.y]).collect::<Vec<_>>()})).collect();json!({"bones":bones,"slots":slots,"deforms":deforms})
}
fn main(){
 let arg=std::env::args().nth(1).expect("new output directory");let out=Path::new(&arg);assert!(!out.exists(),"refuse overwrite");std::fs::create_dir_all(out).unwrap();
 for name in ["asymmetric","weighted_complex","partial_ffd","trim_multi","topology"]{
  let dest=out.join(name);std::fs::create_dir(&dest).unwrap();let schema:ankhimate_formats::schema::Project=serde_json::from_value(author(name)).unwrap();let mut doc=Document::from_loaded(ankhimate_formats::convert::from_schema(&schema));doc.assets=AssetDb::new();
  for (texture,color) in [("banner",[230,45,20,255]),("second",[20,80,220,180])]{
   let image=RgbaImage::from_fn(64,64,|x,y|Rgba(if name=="trim_multi"&&(x<10||x>=54||y<12||y>=52){[0,0,0,0]}else if x>=32{[30,210,70,color[3]]}else{color}));let mut bytes=Cursor::new(Vec::new());image.write_to(&mut bytes,ImageFormat::Png).unwrap();doc.assets.add(ImageAsset::new(texture,bytes.into_inner(),64,64));
  }
  ankhimate_document::rebind::rebind_meshes(&mut doc);let schema=ankhimate_formats::convert::to_schema(&doc.as_project_ref());std::fs::write(dest.join("authoring.json"),serde_json::to_vec_pretty(&schema).unwrap()).unwrap();
  let mut preset=presets::default_preset();preset.atlas.settings.trim=name=="trim_multi";preset.atlas.settings.max_page=80;
  let plan=run::plan(&schema,&doc.assets,&preset).unwrap();run::write(&plan,&dest.join("native")).unwrap();
  let clip=|name:&str|doc.animations.values().find(|a|a.name==name).unwrap();let mut samples=vec![];
  for animation in ["clip","relax"]{for (i,t) in [0.,0.25,0.5,0.75,1.].into_iter().enumerate(){
   let mut p=Pose::new();pose::evaluate(&doc.skeleton,&[(clip(animation),t,1.)],&mut p);let file=format!("cpu-{animation}-{i}.png");
   let png=ankhimate_render::render_frame(&doc,&FrameRequest{animation:Some(animation.into()),time:t,width:256,height:256,background:[0;4],camera:Camera{center:Some([0.,0.]),zoom:Some(2.),..Default::default()},focus:Some(Focus{mode:FocusMode::ArtOnly,..Default::default()}),..Default::default()}).unwrap();std::fs::write(dest.join(&file),png.bytes).unwrap();samples.push(json!({"animation":animation,"time":t,"skin":"default","pose":sample(&doc,&p),"cpu":file}));
  }}
  let mut fades=vec![];for t in [0.,0.25,0.5,0.75,1.]{let mut p=Pose::new();pose::evaluate(&doc.skeleton,&[(clip("clip"),(0.25+t)%1.,1.-t),(clip("relax"),t%1.,t)],&mut p);fades.push(json!({"elapsed":t,"pose":sample(&doc,&p)}));}
  std::fs::write(dest.join("reference.json"),serde_json::to_vec_pretty(&json!({"name":name,"editor":"1d3da31a29d2c9e39f19715d55baae840220714b","width":256,"height":256,"origin":[128,128],"scale":2,"samples":samples,"fades":fades})).unwrap()).unwrap();println!("{name}: real native export, ten CPU images and fifteen Rust poses");
 }
}
