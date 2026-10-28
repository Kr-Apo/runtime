use ankhimate_core::{
    attachment::Attachment,
    pose::{self, Pose},
};
use ankhimate_document::Document;
pub fn independent(
    d: &Document,
    p: &Pose,
    slot: ankhimate_core::ids::SlotId,
    source: &str,
    off: &[glam::Vec2],
) -> (Vec<[f64; 2]>, Vec<serde_json::Value>) {
    let Some(Attachment::Mesh(g)) = d.skeleton.skins[d.skeleton.default_skin].get(slot, source)
    else {
        panic!()
    };

    let host = p.world(d.skeleton.slots[slot].bone);
    let mut contributions = vec![];
    let point = |m: ankhimate_core::transforms::Affine2, x: f64, y: f64| {
        [
            f64::from(m.a) * x + f64::from(m.c) * y + f64::from(m.tx),
            f64::from(m.b) * x + f64::from(m.d) * y + f64::from(m.ty),
        ]
    };
    // Independently invert the known Setup bone matrix and compose the source
    // host. Stored renderer binds are checked, never used as oracle inputs.
    let mut setup = Pose::new();
    pose::evaluate(&d.skeleton, &[], &mut setup);
    let source_host = setup.world(d.skeleton.slots[slot].bone);
    let values=g.setup_vertices.iter().enumerate().map(|(i,base)|{
        let row=g.weights.get(i).map(Vec::as_slice).unwrap_or(&[]);
        let mut xy=[0.;2];let mut total=0.;let mut terms=vec![];
        for(j,w)in row.iter().enumerate(){
            let m=setup.world(w.bone);let [a,b,c,z,tx,ty]=[m.a,m.b,m.c,m.d,m.tx,m.ty].map(f64::from);
            let det=a*z-b*c;assert!(det.abs()>1e-12);
            let inverse=[z/det,-b/det,-c/det,a/det,(c*ty-z*tx)/det,(b*tx-a*ty)/det];
            let h=source_host;let [ha,hb,hc,hd,hx,hy]=[h.a,h.b,h.c,h.d,h.tx,h.ty].map(f64::from);
            let bind=[inverse[0]*ha+inverse[2]*hb,inverse[1]*ha+inverse[3]*hb,inverse[0]*hc+inverse[2]*hd,inverse[1]*hc+inverse[3]*hd,inverse[0]*hx+inverse[2]*hy+inverse[4],inverse[1]*hx+inverse[3]*hy+inverse[5]];
            let stored=g.inverse_bind_matrices[&w.bone];let stored_values=[stored.a,stored.b,stored.c,stored.d,stored.tx,stored.ty];
            for (expected,stored) in bind.iter().zip(stored_values){assert!((expected-f64::from(stored)).abs()<0.0001);}
            let delta=off.get(g.influence_range(i).start+j).copied().unwrap_or_default();
            let bound=[bind[0]*f64::from(base.x)+bind[2]*f64::from(base.y)+bind[4],bind[1]*f64::from(base.x)+bind[3]*f64::from(base.y)+bind[5]];
            let vector=[bind[0]*f64::from(delta.x)+bind[2]*f64::from(delta.y),bind[1]*f64::from(delta.x)+bind[3]*f64::from(delta.y)];
            let local=[bound[0]+vector[0],bound[1]+vector[1]];let world=point(p.world(w.bone),local[0],local[1]);
            for k in 0..2{xy[k]+=world[k]*f64::from(w.weight);}total+=f64::from(w.weight);
            terms.push(serde_json::json!({"bone":d.skeleton.bones[w.bone].name,"weight":w.weight,"independentBind":bind,"storedBind":stored_values,"base_bind":bound,"offset":delta.to_array(),"linear_offset":vector,"local":local,"acceptedWorld":p.world(w.bone),"world":world}));
        }
        if total>0.{for v in &mut xy{*v/=total;}}else{
            let delta=if g.weights.is_empty(){off.get(i).copied().unwrap_or_default()}else{glam::Vec2::ZERO};
            xy=point(host,f64::from(base.x+delta.x),f64::from(base.y+delta.y));
        }
        contributions.push(serde_json::json!({"vertex":i,"terms":terms,"total":total,"world":xy}));xy
    }).collect();
    (values, contributions)
}
