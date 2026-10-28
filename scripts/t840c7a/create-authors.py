from pathlib import Path
import sys,json,subprocess,copy,shutil
b=Path(__file__).resolve().parents[2];o=Path(sys.argv[1]).resolve();o.mkdir();art=o/'original-art';subprocess.run(['python',str(b/'scripts/t840c5a/create-authors.py'),str(art)],check=True)
for name,src,selected in [('simple','ranger',['head']),('mixed','courier',['torso','head','scarf','cape','antenna_tip'])]:
 d=o/name;shutil.copytree(art/src,d);j=json.loads((d/'character.ankh.json').read_text());j['name']='C7A '+name+' static mesh author'
 if name=='simple':
  keep=['root','torso','head'];j['bones']=[x for x in j['bones']if x['name']in keep];j['bones'][1]['parent']='root';j['bones'][2]['parent']='torso';j['bones'][2]['ty']=65
  j['slots']=[x for x in j['slots']if x['name']in ['torso','head']];j['draw_order']=['torso','head'];j['skins'][0]['entries']=[x for x in j['skins'][0]['entries']if x['slot']in j['draw_order']];j['constraints']=[x for x in j['constraints']if x['target']=='head'];j['constraint_order']=[x['name']for x in j['constraints']];j['skins'][0]['constraints']=j['constraint_order']
  for a in j['animations']:a['timelines']=[x for x in a['timelines']if x['bone']=='torso']
 # Verify non-central attachment origin is baked by the native from_region conversion.
 for e in j['skins'][0]['entries']:
  if e['slot']in selected:e['attachment'].update(offset_x=3.5,offset_y=-2.25,rotation=7,scale_x=.94,scale_y=1.07)
 clip=copy.deepcopy(j['animations'][0]);clip['name']='fault_at_20';clip['timelines']=[x for x in clip['timelines']if not(x['bone']=='torso'and x['kind']=='bone_scale'and x.get('axis')=='x')];clip['timelines'].append(dict(kind='bone_scale',bone='torso',axis='x',keys=[dict(time=0,value=1,curve='stepped'),dict(time=20/120,value=0,curve='stepped')]));j['animations'].append(clip)
 (d/'character.ankh.json').write_text(json.dumps(j,indent=2)+'\n');(d/'mesh-slots.json').write_text(json.dumps(selected))
 print(name,'author ready',flush=True)
