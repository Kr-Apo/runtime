// Executable specification only, NOT a product playback/physics adapter.
// Rational seconds avoid importing either language's frame-delta rounding.
export function dueFromNanoseconds(ns){
  if(typeof ns!=='bigint'||ns<0n)throw RangeError('Expected nonnegative canonical nanoseconds');
  return (ns*120n+60n)/1_000_000_000n;
}
export class ClockModel {
  tick=0;target=0;lastNumerator=0;lastDenominator=1;
  request(numerator,denominator,onTick){
    if(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator)||numerator<0||denominator<=0||!Number.isSafeInteger(numerator*120))throw RangeError('Invalid bounded rational target');
    const delta=BigInt(numerator)*BigInt(this.lastDenominator)-BigInt(this.lastNumerator)*BigInt(denominator);
    if(delta<0n)throw RangeError('Use explicit reset/replay for backward seek');
    if(delta===0n)return 0; // Zero dt cannot drain existing backlog.
    this.lastNumerator=numerator;this.lastDenominator=denominator;
    this.target=Number(BigInt(numerator)*120n/BigInt(denominator));
    return this.pump(onTick);
  }
  pump(onTick){
    let count=0;
    while(this.tick<this.target&&count<8){onTick(this.tick+1);this.tick++;count++;}
    return count;
  }
}
