/** Requests only: source capture, interpolation and Physics belong to the consumer. */
export function installMixControls({actors,draw,show,stop}) {
 const panel=document.createElement('div');panel.innerHTML='<label>Duration ticks <input id="mix-duration" type="number" min="1" max="7200" value="48"></label> <label>Incoming tick <input id="mix-incoming" type="number" min="0" value="0"></label><br><button id="mix-attack">Idle → Attack</button><button id="mix-hit">Interrupt → Hit</button><button id="mix-death">Interrupt → Death</button><button id="mix-idle">Return Idle after completion</button><button id="mix-reset">Reset</button><button id="mix-replay">Replay accepted history</button><p id="mix-error" role="status"></p>';
 document.querySelector('canvas').before(panel);const message=panel.querySelector('#mix-error');
 if(new URL(location.href).searchParams.has('manual')){const play=document.querySelector('#run');play.disabled=true;play.title='Manual diagnostic mode uses explicit ticks; use the ordinary page for realtime playback.';}
 const request=(to,interrupt)=>{try{
  const req={to,durationTicks:BigInt(panel.querySelector('#mix-duration').value),incomingTick:BigInt(panel.querySelector('#mix-incoming').value)};
  for(const a of actors()){if(!interrupt&&a.observe().state==='stopped')a.play();if(interrupt)a.requestInterrupt(req);else a.requestTransition(req);}
  message.textContent='Pending request; accepted locals, slots and Physics have not changed.';show();
 }catch(e){message.textContent=String(e);}};
 for(const[id,to,interrupt]of [['mix-attack','Attack',false],['mix-hit','Hit',true],['mix-death','Death',true],['mix-idle','Idle',false]])panel.querySelector('#'+id).onclick=()=>request(to,interrupt);
 panel.querySelector('#mix-reset').onclick=()=>{try{stop();for(const a of actors()){a.reset();a.present();}draw();show();message.textContent='Explicit reset: Idle at tick0, journal and Physics reset.';}catch(e){message.textContent=String(e);}};
 panel.querySelector('#mix-replay').onclick=async()=>{
  const buttons=[...document.querySelectorAll('button,input,select')].map(e=>[e,e.disabled]);
  try{stop();for(const[e]of buttons)e.disabled=true;const current=actors();for(const a of current)a.beginAcceptedReplay();
   while(current.some(a=>a.observe().backlog)){for(const a of current){if(a.observe().backlog)a.pump(8);if(a.observe().health!=='healthy')throw Error('Replay fault; explicit Reset required');a.present();}draw();show();await new Promise(requestAnimationFrame);}
   for(const a of current)a.present();draw();show();message.textContent='Accepted journal replay complete and paused. Resume continues from this accepted tick.';
  }catch(e){message.textContent=String(e);}finally{for(const[e,disabled]of buttons)e.disabled=disabled;}
 };
}
