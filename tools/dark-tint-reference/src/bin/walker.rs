//! Real character oracle: existing walker source, tint authored in the model,
//! native M005.3a export with no JSON edits, independent Rust CPU poses.
use ankhimate_core::{
    attachment::Attachment,
    pose::{Pose, evaluate},
};
use ankhimate_document::Document;
use ankhimate_render::{Camera, Focus, FocusMode, FrameRequest};
use serde_json::json;
use std::path::PathBuf;

fn main() {
    let destination = PathBuf::from(
        std::env::args()
            .nth(1)
            .expect("new output directory required"),
    );
    assert!(
        !destination.exists(),
        "refusing an existing fixture directory"
    );
    let source =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../editor/samples/walker.ankh");
    let mut doc = Document::from_loaded(ankhimate_formats::load(&source).unwrap().0);
    for slot in doc.skeleton.slots.values_mut() {
        slot.dark_color = Some([0.2, 0.1, 0.3, 0.5]);
    }
    let project = ankhimate_formats::convert::to_schema(&doc.as_project_ref());
    let plan = ankhimate_export::run::plan(
        &project,
        &doc.assets,
        &ankhimate_export::presets::default_preset(),
    )
    .unwrap();
    ankhimate_export::run::write(&plan, &destination).unwrap();
    std::fs::write(
        destination.join("authoring.json"),
        serde_json::to_vec_pretty(&project).unwrap(),
    )
    .unwrap();
    for clip in ["walk", "leg_ik"] {
        let animation = doc.animations.values().find(|a| a.name == clip).unwrap();
        let stem = if clip == "leg_ik" {
            "cpu-leg_ik"
        } else {
            "cpu"
        };
        let mut samples = vec![];
        for (index, time) in [0.0, 0.25, 0.5, 0.75].into_iter().enumerate() {
            let frame = ankhimate_render::render_frame(
                &doc,
                &FrameRequest {
                    animation: Some(clip.into()),
                    time,
                    width: 900,
                    height: 600,
                    background: [40, 50, 61, 255],
                    camera: Camera {
                        center: Some([0.0, 0.0]),
                        zoom: Some(1.7),
                        ..Default::default()
                    },
                    focus: Some(Focus {
                        mode: FocusMode::ArtOnly,
                        ..Default::default()
                    }),
                },
            )
            .unwrap();
            std::fs::write(destination.join(format!("{stem}-{index}.png")), frame.bytes).unwrap();
            let mut pose = Pose::new();
            evaluate(&doc.skeleton, &[(animation, time, 1.0)], &mut pose);
            let bones: Vec<_> = doc
                .skeleton
                .bones
                .iter()
                .map(|(id, bone)| json!({"name":bone.name,"world":pose.worlds[id]}))
                .collect();
            let mut slots = vec![];
            for (order, id) in pose.draw_order.iter().enumerate() {
                let slot = &doc.skeleton.slots[*id];
                let name = pose
                    .slot_attachments
                    .get(*id)
                    .cloned()
                    .unwrap_or_else(|| slot.attachment.clone());
                let Some(name) = name else { continue };
                let Some(Attachment::Region(region)) =
                    doc.skeleton.resolve(doc.skeleton.default_skin, *id, &name)
                else {
                    continue;
                };
                let world = pose.worlds[slot.bone];
                let positions: Vec<_> = region
                    .local_corners()
                    .iter()
                    .flat_map(|p| {
                        let p = world.transform_point(*p);
                        [p.x, p.y]
                    })
                    .collect();
                slots.push(json!({"name":slot.name,"attachment":name,"order":order,"texture":region.texture,"positions":positions,"indices":[0,1,2,0,2,3],"color":pose.slot_colors.get(*id).copied().unwrap_or(slot.color),"dark_color":slot.dark_color}));
            }
            samples.push(json!({"time":time,"bones":bones,"slots":slots}));
        }
        std::fs::write(destination.join(format!("{stem}-reference.json")),serde_json::to_vec_pretty(&json!({"editorCommit":"367238cfa432fb597bbe3c40a64f1c75217a4312","animation":clip,"width":900,"height":600,"scale":1.7,"origin":[450,300],"background":[40,50,61,255],"samples":samples})).unwrap()).unwrap();
    }
    println!(
        "Real walker dark export and eight independent CPU frames: {}",
        destination.display()
    );
}
