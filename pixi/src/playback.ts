import { RigPlayback } from '@ankhimate/runtime/render';
import type { RigPose, RuntimeRigData } from '@ankhimate/runtime';
import { requireThat } from './validate.js';
export type { PlayOptions, AnimationEventListener } from '@ankhimate/runtime/render';
/** Existing Pixi API/error boundary over the same shared RigPlayer controller. */
export class PixiPlayback extends RigPlayback {
  constructor(rig:RuntimeRigData,skin:string,render:(pose:RigPose,skin:string)=>void) {super(rig,skin,render,requireThat);}
}
