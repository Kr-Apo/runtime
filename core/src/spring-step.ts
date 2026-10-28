/** Numerical operation shared by Legacy and ReplayV1; no clock or remainder. */
export interface SpringState {
  rotation:number; rotationVelocity:number; x:number; y:number; velocityX:number; velocityY:number;
}
export function springStep(sim:SpringState,pushX:number,pushY:number,impulseX:number,impulseY:number,
  mass:number,spring:number,decay:number):void {
  const step=1/120;
  sim.velocityX += (pushX / mass + impulseX * spring - sim.x * spring) * step;
  sim.velocityY += (pushY / mass + impulseY * spring - sim.y * spring) * step;
  sim.velocityX *= decay; sim.velocityY *= decay;
  sim.x += sim.velocityX * step; sim.y += sim.velocityY * step;
  sim.rotationVelocity += (pushX / mass + impulseX * spring - sim.rotation * spring) * step;
  sim.rotationVelocity *= decay; sim.rotation += sim.rotationVelocity * step;
}
