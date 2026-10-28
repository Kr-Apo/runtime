//! Read actual native-v2 clips back into native timelines, then evaluate using Rust.
//! No TypeScript samples or renderer geometry are used as expected inputs.
use ankhimate_core::animation::{Axis, EventKey, Interp, Key, Timeline};
use ankhimate_document::Document;
use serde_json::Value;
fn num(v: &Value) -> f32 {
    v.as_f64().expect("native finite number") as f32
}
fn interp(keys: &[Value], i: usize) -> Interp {
    if i == 0 {
        return Interp::Linear;
    }
    let c = &keys[i - 1]["curve"];
    if c == "stepped" {
        Interp::Stepped
    } else if c == "linear" || c.is_null() {
        Interp::Linear
    } else {
        let h = c["handles"].as_array().unwrap();
        Interp::Bezier {
            out_handle: glam::vec2(num(&h[0]), num(&h[1])),
            in_handle: glam::vec2(num(&h[2]), num(&h[3])),
        }
    }
}
fn keys<T>(v: &Value, value: impl Fn(&Value) -> T) -> Vec<Key<T>> {
    let list = v.as_array().unwrap();
    list.iter()
        .enumerate()
        .map(|(i, k)| Key {
            time: num(&k["time"]),
            value: value(k),
            interp: interp(list, i),
        })
        .collect()
}
pub fn read(d: &mut Document, n: &Value) {
    assert_eq!(n["format_version"], 2);
    let bone = |name: &str| {
        d.skeleton
            .bones
            .iter()
            .find(|(_, b)| b.name == name)
            .unwrap()
            .0
    };
    let slot = |name: &str| {
        d.skeleton
            .slots
            .iter()
            .find(|(_, s)| s.name == name)
            .unwrap()
            .0
    };
    for a in d.animations.values_mut() {
        let raw = &n["animations"][&a.name];
        a.duration = num(&raw["duration"]);
        a.looping = raw["looping"].as_bool().unwrap();
        let mut timelines = vec![];
        for t in raw["bones"].as_array().unwrap() {
            let b = bone(t["name"].as_str().unwrap());
            for (channel, v) in t.as_object().unwrap() {
                if channel == "name" {
                    continue;
                }
                let keys = keys(v, |k| num(&k["value"]));
                let axis = if channel.ends_with("_x") {
                    Axis::X
                } else {
                    Axis::Y
                };
                timelines.push(match channel.as_str() {
                    "rotate" => Timeline::BoneRotate { bone: b, keys },
                    "translate_x" | "translate_y" => Timeline::BoneTranslate {
                        bone: b,
                        axis,
                        keys,
                    },
                    "scale_x" | "scale_y" => Timeline::BoneScale {
                        bone: b,
                        axis,
                        keys,
                    },
                    "shear_x" | "shear_y" => Timeline::BoneShear {
                        bone: b,
                        axis,
                        keys,
                    },
                    _ => panic!("unknown bone channel"),
                });
            }
        }
        for t in raw["slots"].as_array().unwrap() {
            let s = slot(t["name"].as_str().unwrap());
            let k = &t["keys"];
            timelines.push(match t["channel"].as_str().unwrap() {
                "color" => Timeline::SlotColor {
                    slot: s,
                    keys: keys(k, |v| std::array::from_fn(|i| num(&v["color"][i]))),
                },
                "visible" => Timeline::SlotVisible {
                    slot: s,
                    keys: keys(k, |v| v["value"].as_bool().unwrap()),
                },
                "attachment" => Timeline::SlotAttachment {
                    slot: s,
                    keys: keys(k, |v| v["name"].as_str().map(String::from)),
                },
                _ => panic!("unknown slot channel"),
            });
        }
        for t in raw["deform"].as_array().unwrap() {
            timelines.push(Timeline::Deform {
                slot: slot(t["slot"].as_str().unwrap()),
                attachment: t["attachment"].as_str().unwrap().into(),
                keys: keys(&t["keys"], |v| {
                    v["offsets"]
                        .as_array()
                        .unwrap()
                        .chunks_exact(2)
                        .map(|xy| glam::vec2(num(&xy[0]), num(&xy[1])))
                        .collect()
                }),
            });
        }
        if !raw["drawOrder"].as_array().unwrap().is_empty() {
            timelines.push(Timeline::DrawOrder {
                keys: keys(&raw["drawOrder"], |v| {
                    v["offsets"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|v| {
                            (
                                slot(v["slot"].as_str().unwrap()),
                                v["offset"].as_i64().unwrap() as i32,
                            )
                        })
                        .collect()
                }),
            });
        }
        assert_eq!(timelines.len(), a.timelines.len());
        a.timelines = timelines;
        a.events = raw["events"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| EventKey {
                time: num(&e["time"]),
                name: e["name"].as_str().unwrap().into(),
                int_value: e["int"].as_i64().unwrap() as i32,
                float_value: num(&e["float"]),
                string_value: e["string"].as_str().unwrap().into(),
                audio: e["audio"].as_str().unwrap().into(),
                volume: num(&e["volume"]),
                balance: num(&e["balance"]),
            })
            .collect();
    }
}
