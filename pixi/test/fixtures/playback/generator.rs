//! New, isolated authoring fixture. No historical exports or projects are patched.
use ankhimate_core::{assets::{AssetDb,ImageAsset},attachment::Attachment,pose::{self,Pose}};
use ankhimate_document::Document;
use ankhimate_export::{presets,run};
use ankhimate_render::{Camera,Focus,FocusMode,FrameRequest};
use image::{Rgba,RgbaImage,ImageFormat};
use serde_json::{Value,json};
use std::{path::Path,io::Cursor};
fn sample(doc:&Document,p:&Pose)->Value {
 let bones:Vec<_>=doc.skeleton.bones.iter().map(|(id,b)|json!({"name":b.name,"world":p.worlds[id]})).collect();
 let slots:Vec<_>=p.draw_order.iter().filter_map(|id|{
  let s=&doc.skeleton.slots[*id];
  let Attachment::Region(r)=doc.skeleton.resolve(doc.skeleton.default_skin,*id,s.attachment.as_deref()?)? else{return None};
  let w=p.worlds[s.bone];
  let positions:Vec<_>=r.local_corners().iter().flat_map(|v|{let v=w.transform_point(*v);[v.x,v.y]}).collect();
  Some(json!({"name":s.name,"positions":positions}))
 }).collect();json!({"bones":bones,"slots":slots})
}
fn main(){
 let arg=std::env::args().nth(1).expect("new output directory");let out=Path::new(&arg);
 assert!(!out.exists(),"never overwrite fixtures");std::fs::create_dir_all(out).unwrap();
 let source=json!({"version":1,"name":"Pixi playback qualification","fps":60,
 "bones":[{"name":"root","length":32,"tx":3,"ty":-4}],
 "slots":[{"name":"art","bone":"root","attachment":"banner"}],
 "skins":[{"name":"default","entries":[{"slot":"art","name":"banner","attachment":{"type":"region","texture":"banner","x":24,"y":8,"width":48,"height":32,"uv":[0,0,1,1]}}]}],"default_skin":"default",
 "assets":[{"name":"banner","file":"banner.png","width":24,"height":16}],
 "animations":[
 {"name":"rise","duration":1,"looping":true,"timelines":[
 {"kind":"bone_translate","bone":"root","axis":"x","keys":[{"time":0,"value":0,"curve":"linear"},{"time":1,"value":20,"curve":"linear"}]},
 {"kind":"bone_rotate","bone":"root","keys":[{"time":0,"value":0,"curve":"linear"},{"time":1,"value":-180,"curve":"linear"}]}],
 "events":[{"time":0.75,"name":"late"},{"time":0,"name":"start"},{"time":0.5,"name":"impact","int_value":7,"float_value":0.25,"string_value":"écho \\\" royal"},{"time":1,"name":"end"}]},
 {"name":"recover","duration":1,"looping":false,"timelines":[
 {"kind":"bone_translate","bone":"root","axis":"y","keys":[{"time":0,"value":-12,"curve":"linear"},{"time":1,"value":12,"curve":"linear"}]},
 {"kind":"bone_rotate","bone":"root","keys":[{"time":0,"value":0,"curve":"linear"},{"time":1,"value":180,"curve":"linear"}]}],"events":[{"time":0.25,"name":"incoming"},{"time":1,"name":"rest"}]}]});
 let schema:ankhimate_formats::schema::Project=serde_json::from_value(source).unwrap();
 let mut doc=Document::from_loaded(ankhimate_formats::convert::from_schema(&schema));doc.assets=AssetDb::new();
 let image=RgbaImage::from_fn(24,16,|x,y|Rgba(if x<8{[240,40,20,255]}else if y<8{[20,220,80,128]}else{[30,70,230,0]}));
 let mut bytes=Cursor::new(Vec::new());image.write_to(&mut bytes,ImageFormat::Png).unwrap();doc.assets.add(ImageAsset::new("banner",bytes.into_inner(),24,16));
 let schema=ankhimate_formats::convert::to_schema(&doc.as_project_ref());
 std::fs::write(out.join("authoring.json"),serde_json::to_vec_pretty(&schema).unwrap()).unwrap();
 let mut preset=presets::default_preset();preset.atlas.settings.trim=false;
 let plan=run::plan(&schema,&doc.assets,&preset).unwrap();run::write(&plan,&out.join("native")).unwrap();
 let clip=|name:&str|doc.animations.values().find(|a|a.name==name).unwrap();
 let mut samples=vec![];
 for name in ["rise","recover"]{for (i,t) in [0.,0.25,0.5,0.75,1.].into_iter().enumerate(){
  let mut p=Pose::new();pose::evaluate(&doc.skeleton,&[(clip(name),t,1.)],&mut p);
  let png=ankhimate_render::render_frame(&doc,&FrameRequest{animation:Some(name.into()),time:t,width:256,height:256,background:[0;4],camera:Camera{center:Some([0.,0.]),zoom:Some(2.),..Default::default()},focus:Some(Focus{mode:FocusMode::ArtOnly,..Default::default()}),..Default::default()}).unwrap();
  let file=format!("cpu-{name}-{i}.png");std::fs::write(out.join(&file),png.bytes).unwrap();
  samples.push(json!({"animation":name,"time":t,"pose":sample(&doc,&p),"cpu":file}));
 }}
 let mut fades=vec![];
 for t in [0.,0.25,0.5,0.75,1.]{let mut p=Pose::new();pose::evaluate(&doc.skeleton,&[(clip("rise"),(0.25+t)%1.,1.-t),(clip("recover"),t,t)],&mut p);fades.push(json!({"elapsed":t,"pose":sample(&doc,&p)}));}
 let event_windows:Vec<_>=[0.,0.25,0.5,0.75,1.,1.25,3.25].into_iter().map(|to|json!({"from":0,"to":to,"names":ankhimate_core::animation::events_in_window(clip("rise"),0.,to,true).iter().map(|e|e.name.clone()).collect::<Vec<_>>()})).collect();
 std::fs::write(out.join("reference.json"),serde_json::to_vec_pretty(&json!({"editor":"1d3da31a29d2c9e39f19715d55baae840220714b","width":256,"height":256,"origin":[128,128],"scale":2,"samples":samples,"fades":fades,"event_windows":event_windows})).unwrap()).unwrap();
 println!("New native export, ten independent CPU frames, ten Rust poses, five fade poses and event windows generated.");
}
