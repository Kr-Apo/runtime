from pathlib import Path
import os,subprocess,sys,json,hashlib
base=Path(__file__).resolve().parents[2];out=Path(sys.argv[1]).resolve();out.mkdir();env=os.environ.copy()
for name in ['ranger','courier','ranger-fault','courier-fault']:
 source=base/'examples/replay-visual-skins/authors'/name
 if name.endswith('-fault'):
  # The native fault source is retained separately in the delivered evidence.
  if len(sys.argv)<3:raise SystemExit('Supply delivered authors root as second argument for native fault variants')
  source=Path(sys.argv[2]).resolve()/name
 with(out/(name+'.log')).open('xb')as f:subprocess.run(['cargo','+1.95','run','--offline','--locked','--manifest-path',str(base/'scripts/t840c6a/native/Cargo.toml'),'--',str(source),str(out/name)],env=env,stdout=f,stderr=subprocess.STDOUT,check=True)
 manifest={p.relative_to(out).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(out.rglob('*'))if p.is_file()}
(out/'SHA256.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
