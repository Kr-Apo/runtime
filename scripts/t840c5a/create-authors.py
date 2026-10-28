from pathlib import Path
from PIL import Image,ImageDraw
import json,copy,hashlib,math
import sys
R=Path(__file__).resolve().parents[2];O=Path(sys.argv[1]).resolve();O.mkdir();base=json.loads('{"version": 1, "name": "", "fps": 60, "assets": [], "bones": [{"name": "root", "parent": "", "length": 1.0, "tx": 0.0, "ty": 0.0, "rotation": 0.0, "sx": 1.0, "sy": 1.0, "shear_x": 0.0, "shear_y": 0.0, "inherit_rotation": true, "inherit_scale": true, "inherit_reflect": true, "color": [0.0, 0.8, 0.8, 0.85]}], "slots": [], "draw_order": [], "skins": [{"name": "default", "entries": [{"slot": "body", "name": "body", "attachment": {"type": "region", "texture": "body", "offset_x": 0, "offset_y": 0, "rotation": 0, "scale_x": 1, "scale_y": 1, "width": 74, "height": 94, "uv": [0, 0, 1, 1], "pivot_x": 0.5, "pivot_y": 0.5}}, {"slot": "head", "name": "head", "attachment": {"type": "region", "texture": "head", "offset_x": 0, "offset_y": 0, "rotation": 0, "scale_x": 1, "scale_y": 1, "width": 68, "height": 55, "uv": [0, 0, 1, 1], "pivot_x": 0.5, "pivot_y": 0.5}}, {"slot": "pennant", "name": "pennant", "attachment": {"type": "region", "texture": "pennant", "offset_x": 34, "offset_y": 0, "rotation": 0, "scale_x": 1, "scale_y": 1, "width": 80, "height": 28, "uv": [0, 0, 1, 1], "pivot_x": 0.5, "pivot_y": 0.5}}], "bones": [], "constraints": ["secondary"]}], "default_skin": "default", "constraints": [{"name": "secondary", "type": "physics", "target": "secondary", "bones": [], "bend_direction": 1.0, "mix": 1.0, "softness": 0.0, "stretch": false, "stretch_limit": 1.1, "stiffness": 0.0, "physics": [0.8, 40, 0.6, 1], "forces": [0, 0, 0, 0], "channels": [true, true]}], "constraint_order": ["secondary"], "animations": []}')
S=4
for key,complexity in [('ranger',False),('courier',True)]:
 out=O/key;out.mkdir(parents=True);j={k:copy.deepcopy(v)for k,v in base.items()};j.update(name='Moss Ranger'if not complexity else 'Clockwork Courier',assets=[],bones=[],slots=[],draw_order=[],constraints=[],constraint_order=[],animations=[]);skin=j['skins'][0];skin.update(entries=[],bones=[],constraints=[])
 def bone(n,p,x,y,rot=0,sx=1,sy=1):
  b=copy.deepcopy(base['bones'][0]);b.update(name=n,parent=p,tx=x,ty=y,rotation=rot,sx=sx,sy=sy,length=28);j['bones'].append(b)
 def art(n,typ,w,h,b,pivot=.9,rot=0):
  im=Image.new('RGBA',(w*S,h*S));d=ImageDraw.Draw(im);outline='#182d3a';c='#418978'if not complexity else '#538aaa';gold='#edbc5b';light='#d4ebe0'
  def box(xy,fill,r=8):d.rounded_rectangle(tuple(int(x*S)for x in xy),radius=r*S,fill=fill,outline=outline,width=2*S)
  def ellipse(xy,fill,edge=outline):d.ellipse(tuple(int(x*S)for x in xy),fill=fill,outline=edge,width=2*S)
  def poly(xy,fill):d.polygon([(int(x*S),int(y*S))for x,y in xy],fill=fill);d.line([(int(x*S),int(y*S))for x,y in xy]+[(int(xy[0][0]*S),int(xy[0][1]*S))],fill=outline,width=2*S)
  if typ=='head':
   if not complexity:
    poly([(5,24),(8,2),(28,18),(50,18),(w-8,2),(w-5,24)],c)
   box((3,13,w-3,h-4),c,22);box((12,28,w-12,h-12),'#e6bb85',15)
   for x in [w*.34,w*.67]:ellipse((x-6,34,x+6,49),'#fff9db');ellipse((x-2,39,x+3,47),outline)
   d.arc((int(w*.35*S),int(46*S),int(w*.65*S),int(61*S)),0,180,fill=outline,width=2*S)
   if complexity:box((8,17,w-8,30),gold,5);ellipse((w/2-7,3,w/2+7,18),gold)
  elif typ=='torso':
   box((4,3,w-4,h-4),c,20);box((w*.25,12,w*.75,h-14),'#31525e',10);box((10,h*.64,w-10,h*.80),'#ad7655',4);ellipse((w*.43,h*.65,w*.58,h*.79),gold)
   for y in [24,38,52]:ellipse((w/2-3,y,w/2+3,y+6),gold)
  elif typ in ['upper','fore','thigh','shin']:
   box((3,3,w-3,h-3),c,12);box((6,5,w-6,13),gold,3)
   if typ=='fore':box((5,h-25,w-5,h-4),'#e6bb85',9)
   elif typ=='shin':box((2,h-22,w-2,h-2),'#31414b',5);box((5,h-18,w-5,h-11),gold,2)
   else:box((w*.3,16,w*.7,h-11),'#6ea897',5)
  elif typ=='pelvis':box((2,2,w-2,h-2),'#385261',10);box((5,5,w-5,16),'#ad7655',3)
  elif typ=='scarf':poly([(3,2),(w-3,2),(w-8,h-4),(w*.5,h-16),(8,h-2)],'#e4a54e');d.line((6*S,14*S,(w-6)*S,14*S),fill=light,width=3*S)
  elif typ=='cape':poly([(w*.25,3),(w*.75,3),(w-2,h-4),(w*.5,h-12),(2,h-3)],'#7f5e96');d.line((int(w*.5*S),15*S,int(w*.5*S),(h-20)*S),fill='#ac89b6',width=5*S)
  elif typ=='disk':ellipse((2,2,w-2,h-2),gold);ellipse((w*.24,h*.24,w*.76,h*.76),c)
  elif typ=='strap':box((3,1,w-3,h-1),'#aa7958',4)
  elif typ=='pack':box((3,2,w-3,h-2),'#a47753',13);box((10,20,w-10,h-8),'#795e4c',6);box((w*.4,4,w*.6,h-4),gold,2)
  else:box((3,2,w-3,h-2),c,10)
  im=im.resize((w,h),Image.Resampling.LANCZOS);im.save(out/(n+'.png'));j['assets'].append(dict(name=n,file=n+'.png',width=w,height=h));j['slots'].append(dict(name=n,bone=b,attachment=n,color=[1,1,1,1],blend_mode='normal'));j['draw_order'].append(n);a=copy.deepcopy(base['skins'][0]['entries'][0]['attachment']);a.update(texture=n,width=w,height=h,pivot_x=.5,pivot_y=pivot,rotation=rot);skin['entries'].append(dict(slot=n,name=n,attachment=a))
 bone('root','',0,0);bone('pelvis','root',0,0);bone('torso','pelvis',0,36);bone('neck','torso',0,47);bone('head','neck',0,16)
 for side,x in [('left',-1),('right',1)]:
  bone(side+'_upper','torso',x*43,32,rot=x*-7);bone(side+'_fore',side+'_upper',0,-51,rot=x*5)
  bone(side+'_thigh','pelvis',x*22,-3);bone(side+'_shin',side+'_thigh',0,-53)
 bone('scarf','neck',-15,0,-12)
 if complexity:
  for n,p,x,y,rot in [('spine','torso',0,20,0),('hat','head',0,52,0),('antenna','hat',20,15,-15),('antenna_tip','antenna',0,25,5),('cape','torso',0,40,0),('cape_tip','cape',0,-65,0),('pack','torso',-35,20,0),('charm','pack',-18,-36,0),('charm_tip','charm',0,-26,0),('left_hand','left_fore',0,-40,0),('right_hand','right_fore',0,-40,0),('badge','spine',0,-10,0)]:bone(n,p,x,y,rot)
 # Back-to-front authored setup order.
 if complexity:art('cape','cape',110,103,'cape',.98);art('cape_tip','scarf',78,42,'cape_tip',.95);art('pack','pack',52,72,'pack',.8)
 for side in ['left','right']:
  art(side+'_thigh','thigh',35,66,side+'_thigh');art(side+'_shin','shin',38,68,side+'_shin')
 art('pelvis','pelvis',77,35,'pelvis',.6);art('torso','torso',96,98,'torso',.49)
 for side in ['left','right']:art(side+'_upper','upper',32,64,side+'_upper');art(side+'_fore','fore',33,57,side+'_fore')
 art('head','head',78,76,'head',.25);art('scarf','scarf',32,67,'scarf',.95)
 if complexity:
  for n,t,w,h,pi in [('hat','cap',90,25,.45),('antenna','strap',10,34,.08),('antenna_tip','disk',21,21,.5),('charm','strap',12,34,.96),('charm_tip','disk',24,24,.75),('badge','disk',25,25,.5)]:art(n,t,w,h,n,pi)
 def physics(target,k):
  c=copy.deepcopy(base['constraints'][0]);c.update(name='spring_'+target,target=target,physics=[.65,38+k*5,.8,1],forces=[0,0,0,0],channels=[True,True]);j['constraints'].append(c);j['constraint_order'].append(c['name']);skin['constraints'].append(c['name'])
 for i,n in enumerate(['head','scarf']if not complexity else ['head','scarf','antenna','antenna_tip','cape','cape_tip','charm','charm_tip']):physics(n,i)
 def track(b,kind,vals,duration,axis=None):
  t=dict(kind='bone_'+kind,bone=b,keys=[dict(time=duration*i/(len(vals)-1),value=v,curve='linear')for i,v in enumerate(vals)])
  if axis:t['axis']=axis
  return t
 for clip,duration in [('march',2.0),('salute',3.0 if complexity else 1.5)]:
  ts=[track('torso','translate',[0,8,0,-8,0],duration,'x'),track('pelvis','translate',[0,5,0,5,0],duration,'y'),track('torso','rotate',[0,6,0,-6,0],duration),track('torso','scale',[1,1.06,1,.94,1],duration,'x'),track('torso','scale',[1,.96,1,1.04,1],duration,'y')]
  for side,sgn in [('left',1),('right',-1)]:
   ts.extend([track(side+'_thigh','rotate',[0,sgn*14,0,-sgn*14,0],duration),track(side+'_shin','rotate',[0,-sgn*8,0,sgn*8,0],duration),track(side+'_upper','rotate',[0,-sgn*14,0,sgn*14,0]if clip=='march'else[0,sgn*75,sgn*90,sgn*60,0],duration),track(side+'_fore','rotate',[0,sgn*10,0,-sgn*10,0],duration)])
  j['animations'].append(dict(name=clip,duration=duration,looping=True,timelines=ts))
 (out/'character.ankh.json').write_text(json.dumps(j,indent=2)+'\n',encoding='utf8');(out/'ART-PROVENANCE.md').write_text('Original deterministic paper-puppet artwork authored with Pillow vector primitives, supersampled4x. No existing character/project or private reference image used. Source generator retained. Native author schema loaded through unchanged B6 format APIs, then native Save/Reload and export. No runtime JSON editing.\n',encoding='utf8')
 print(key,len(j['bones']),len(j['slots']),len(j['constraints']),flush=True)
