from pathlib import Path
import json,subprocess,copy,shutil
import sys
B=Path(__file__).resolve().parents[2];O=Path(sys.argv[1]).resolve();O.mkdir();recipe=(B/'scripts/t840c5a/create-authors.py').read_text(encoding='utf8');art=O/'art-generation';art.mkdir();authors=O/'authors';authors.mkdir()
palettes=[('default',{}),('festival',{'#418978':'#b55243','#538aaa':'#975ba6','#edbc5b':'#f3d875','#31525e':'#632f53','#7f5e96':'#b94e61'}),('night',{'#418978':'#31588e','#538aaa':'#303f70','#edbc5b':'#89d8e8','#31525e':'#1c2948','#7f5e96':'#273257','#e4a54e':'#78abbf'})]
for index,(style,colors)in enumerate(palettes):
 s=recipe
 for a,b in colors.items():s=s.replace(a,b)
 if index:s=s.replace("def art(n,typ,w,h,b,pivot=.9,rot=0):",f"def art(n,typ,w,h,b,pivot=.9,rot=0):\n  w+={index*2};h+={index*3}")
 p=art/(style+'.py');p.write_text(s,encoding='utf8');subprocess.run(['python',str(p),str(art/style)],check=True)
for key,source,count in [('ranger','ranger',2),('courier','courier',3)]:
 out=authors/key;out.mkdir();j=json.loads((art/'default'/source/'character.ankh.json').read_text(encoding='utf8'));j['name']='Festival Ranger'if count==2 else'Court Courier';j['assets']=[];j['skins']=[]
 for style,_ in palettes[:count]:
  a=json.loads((art/style/source/'character.ankh.json').read_text(encoding='utf8'));skin=copy.deepcopy(a['skins'][0]);skin['name']=style
  for asset in a['assets']:
   old=asset['name'];asset['name']=old+'_'+style;asset['file']=asset['name']+'.png';j['assets'].append(asset);shutil.copy2(art/style/source/(old+'.png'),out/asset['file'])
  for entry in skin['entries']:entry['attachment']['texture']+='_'+style
  if key=='ranger':skin['constraints']=['spring_head']if style=='default'else['spring_scarf']
  else:
   skin['constraints']={'default':['spring_head','spring_scarf'],'festival':['spring_head','spring_cape','spring_cape_tip'],'night':['spring_scarf','spring_antenna','spring_antenna_tip','spring_charm','spring_charm_tip']}[style]
   if style!='festival':skin['entries']=[e for e in skin['entries']if e['slot']!='badge']
   if style=='festival':skin['entries']=[e for e in skin['entries']if e['slot']!='left_thigh']
   if style=='night':skin['entries']=[e for e in skin['entries']if e['slot']!='scarf']
  j['skins'].append(skin)
 events=[(0,'default'),(20,'festival'),(40,'night'if count==3 else'default'),(60,'default'),(119,'festival'),(120,'night'if count==3 else'default'),(121,'default'),(239,'festival'),(240,'night'if count==3 else'default'),(241,'festival'),(360,'default'),(600,'night'if count==3 else'festival')]
 calendars={'primary':[{'tick':t,'skin':s}for t,s in events],'delayed':[{'tick':t+(7 if t else 0),'skin':s}for t,s in events]}
 (out/'character.ankh.json').write_text(json.dumps(j,indent=2)+'\n',encoding='utf8');(out/'skin-calendars.json').write_text(json.dumps(calendars,indent=2)+'\n',encoding='utf8')
 (out/'ART-PROVENANCE.md').write_text('New native multi-skin configuration derived from the original C5A paper-puppet design. Artwork redrawn deterministically from the retained Pillow primitive recipe with distinct palettes and dimensions. No user project or private reference used. Native author schema -> unchanged B6 Save/Reload/export. Skin schedules are explicit B5B1 consumer inputs, not patched runtime JSON or attachment timelines.\n',encoding='utf8')
 fault=authors/(key+'-fault');shutil.copytree(out,fault);clip=copy.deepcopy(j['animations'][0]);clip['name']='fault_at_20';clip['timelines']=[t for t in clip['timelines']if not(t['bone']=='torso'and t['kind']=='bone_scale'and t.get('axis')=='x')];clip['timelines'].append({'kind':'bone_scale','bone':'torso','axis':'x','keys':[{'time':0,'value':1,'curve':'stepped'},{'time':20/120,'value':0,'curve':'stepped'}]});j['animations'].append(clip);(fault/'character.ankh.json').write_text(json.dumps(j,indent=2)+'\n',encoding='utf8')
 print(key,'skins',count,'assets',len(j['assets']),flush=True)
