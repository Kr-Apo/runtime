"""Offline Windows candidate assembly. Does not build or modify product sources."""
from pathlib import Path
import argparse, hashlib, json, re, shutil, subprocess, zipfile, tempfile

REPO=Path(__file__).resolve().parent.parent
SOURCE=REPO/'release/alpha'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,value): p.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def git(*args): return subprocess.check_output(['git','-C',str(REPO),*args],text=True).strip()
def copy(src,dst): dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
def module(src,dst):
    text=src.read_text(encoding='utf-8')
    dst.parent.mkdir(parents=True,exist_ok=True)
    dst.write_text(re.sub(r'^//# sourceMappingURL=.*\n?', '', text, flags=re.M),encoding='utf-8',newline='\n')
    return {'sourceSha256':sha(src),'sha256':sha(dst),'transform':'sourceMappingURL comments removed; no runtime code changes'}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--editor-binary',type=Path,required=True)
    p.add_argument('--editor-provenance',type=Path,required=True)
    p.add_argument('--editor-licenses',type=Path,required=True)
    p.add_argument('--sample',type=Path,required=True)
    p.add_argument('--sample-provenance',type=Path,help='Generated inventory for an explicitly reviewed revision of Jade Sentinel')
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--candidate',default='Ankhimate-Editor-PixiJS-Alpha-RC1')
    a=p.parse_args();out=a.output.resolve();archive=out.with_suffix('.zip')
    if out.exists() or archive.exists(): raise SystemExit('Refusing to overwrite candidate directory or archive')
    proof=read(a.editor_provenance)
    if sha(a.editor_binary)!=proof['binarySha256']: raise SystemExit('Editor binary does not match audited build provenance')
    if proof['editorCommit']!='1d3da31a29d2c9e39f19715d55baae840220714b': raise SystemExit('Unexpected editor checkpoint')
    if not proof['staticCRT'] or not proof['sourceRemapped']: raise SystemExit('Unaudited editor binary')
    if proof['cargoLockSha256']!='5c6fbf5527b04848465cfc073740cd423f3790e2c0c228154c94ec7fabff60c6': raise SystemExit('Re-audit changed editor dependencies before reusing the accepted license inventory')
    sample_proof=read(a.sample_provenance) if a.sample_provenance else None
    if sample_proof:
        if sample_proof.get('version')!=1 or sample_proof.get('name')!='Jade Sentinel':raise SystemExit('Unexpected sample provenance contract')
        if not sample_proof.get('nativeExportMatchesRustAPI'):raise SystemExit('Unqualified revised native export')
        expected=sample_proof['files'];actual={p.relative_to(a.sample).as_posix() for p in a.sample.rglob('*') if p.is_file() and p.resolve()!=a.sample_provenance.resolve()}
        if set(expected)!=actual:raise SystemExit('Sample file inventory changed')
        for f,h in expected.items():
            path=(a.sample/f).resolve()
            if not path.is_relative_to(a.sample.resolve()) or sha(path)!=h:raise SystemExit('Revised sample provenance mismatch: '+f)
    else:
        for f,h in {'skeleton.json':'5627c3a56da29ae3630a7dbe1f05d7bcb9c02705320933856f71e43aa5974eac','atlas.png':'2134caf64fee2b356f94393b6ffcb9c68c47002a944ae3e963eddca39505539d'}.items():
            if sha(a.sample/'export-natif'/f)!=h: raise SystemExit('Jade export is not the accepted native artifact')
    out.mkdir(parents=True)
    copy(a.editor_binary,out/'Editor/Ankhimate.exe');copy(a.editor_provenance,out/'Editor/BUILD-PROVENANCE.json')
    shutil.copytree(a.editor_licenses,out/'Licenses/Editor')
    # Replace the old cross-package navigation only; preserve all actual notices.
    (out/'Licenses/Editor/README.md').write_text('''# Editor notices

Ankhimate is MIT OR Apache-2.0. The accompanying rust/dependencies.json is a
conservative normal/build dependency inventory, not a claim every crate is linked.
rust/upstream-sources.json records the accepted provenance for license files
omitted from crate packages. Lucide, egui fonts and Rust toolchain notices remain
included. This binary uses the same locked dependency set as that inventory.
Browser runtime notices are in the sibling Browser folder. No Phaser code or
Phaser game is shipped in this candidate.
''',encoding='utf-8')
    copy(REPO/'LICENSE-MIT',out/'Licenses/LICENSE-MIT');copy(REPO/'LICENSE-APACHE',out/'Licenses/LICENSE-APACHE')
    compiled={}
    for package in ['core','pixi']:
        for src in sorted((REPO/package/'dist').iterdir()):
            if src.name.endswith(('.js','.d.ts')):
                dst=out/'Runtime'/package/src.name
                compiled[dst.relative_to(out).as_posix()]=module(src,dst)
    compiled['Runtime/vendor/pixi.mjs']=module(REPO/'node_modules/pixi.js/dist/pixi.mjs',out/'Runtime/vendor/pixi.mjs')
    compiled['Runtime/vendor/fflate.mjs']=module(REPO/'node_modules/fflate/esm/browser.js',out/'Runtime/vendor/fflate.mjs')
    # Conservative installed dependency closure; no package download or installation.
    dependencies={}
    def collect(name):
        if name in dependencies:return
        directory=REPO/'node_modules'/name;meta=read(directory/'package.json')
        record={'name':name,'version':meta['version'],'license':meta.get('license'),'notices':[]};dependencies[name]=record
        for src in sorted(directory.rglob('*')):
            if not src.is_file():continue
            rel=src.relative_to(directory)
            if 'node_modules' in rel.parts or len(rel.parts)>3:continue
            if src.name.lower().startswith(('license','licence','copying','copyright','notice')):
                dst=out/'Licenses/Browser'/name/rel;copy(src,dst)
                record['notices'].append({'file':dst.relative_to(out).as_posix(),'sha256':sha(dst)})
        if not record['notices'] and name=='@pixi/colord' and meta['version']=='2.9.6':
            src=REPO/'release/licenses/colord-MIT.txt'
            if sha(src)!='7613d4594ee8b6163926af3435dae61c9e3d5a27cd137bd76a543ba40002d8fc':raise RuntimeError('Colord notice changed')
            dst=out/'Licenses/Browser/@pixi/colord/LICENSE.md';copy(src,dst)
            record['notices'].append({'file':dst.relative_to(out).as_posix(),'sha256':sha(dst),'source':'https://raw.githubusercontent.com/omgovich/colord/5344fbf77b736f81cd33c21050021bc09bc9dd1d/LICENSE.md','provenance':'gitHead from official npm registry metadata for @pixi/colord 2.9.6; package declares MIT but omits the text'})
        if not record['notices']:raise RuntimeError(f'License notice missing: {name}')
        for child in meta.get('dependencies',{}):collect(child)
    collect('pixi.js');collect('fflate')
    write(out/'Licenses/Browser/dependencies.json',list(dependencies.values()))
    sample=out/'Examples/Jade-Sentinel';sample.mkdir(parents=True)
    copy(a.sample/'projet/Sentinelle.ankh',sample/'Sentinelle.ankh')
    shutil.copytree(a.sample/'projet/Sentinelle.assets',sample/'Sentinelle.assets')
    shutil.copytree(a.sample/'sources-images',sample/'Sources')
    shutil.copytree(a.sample/'export-natif',sample/'Export')
    if sample_proof:
        published_proof={**sample_proof,'files':{f.removeprefix('projet/').replace('sources-images/','Sources/',1).replace('export-natif/','Export/',1):h for f,h in sample_proof['files'].items()}}
        write(sample/'sample-provenance.json',published_proof)
    if len(list((sample/'Sources').glob('*.png')))!=5:raise RuntimeError('Expected five Jade source images')
    for src in (SOURCE/'demo').iterdir():copy(src,sample/src.name)
    # Keep the exact accepted asset grant; translate its scope, not its permissions.
    grant='''Jade Sentinel qualification assets — MIT license

The original procedural images, author project and dedicated sample scripts were
created for T-604b.5.3. The accepted author grant permits use, modification and
redistribution under MIT. No private reference or third-party artwork is included.

'''
    mit=(REPO/'LICENSE-MIT').read_text(encoding='utf-8')
    grant+=mit[mit.index('Permission is hereby granted'):]
    (sample/'ASSET-LICENSE.txt').write_text(grant,encoding='utf-8')
    shutil.copytree(SOURCE/'Docs',out/'Docs')
    for name in ['README.md','llms.txt']:copy(SOURCE/name,out/name)
    (out/'THIRD_PARTY_NOTICES.md').write_text('''# Third-party notices

Ankhimate editor, core, adapter and release integration use MIT OR Apache-2.0;
see [MIT](Licenses/LICENSE-MIT) and [Apache](Licenses/LICENSE-APACHE).
The unchanged locked editor dependency, embedded-font and Rust toolchain notices
are in [Editor notices](Licenses/Editor/README.md), including their provenance.
The std-only launcher uses the included Rust toolchain notices as well.

PixiJS and its installed dependency closure are conservatively inventoried in
[Browser dependencies](Licenses/Browser/dependencies.json). The copied license
texts preserve upstream notices (including BSD/ISC where applicable); the inventory
is not a claim that each declaration/type package contributes executable code.
No Node, npm, Rust compiler or developer dependency is distributed as a binary.
The PixiJS browser bundle and fflate module are copied from the pinned installation.

Jade Sentinel's five original procedural images and author project have an
accepted MIT redistribution grant; see the [sample provenance](Examples/Jade-Sentinel/README.md)
and [asset license](Examples/Jade-Sentinel/ASSET-LICENSE.txt). No private Crab
reference or generated Crab assets are included. Dependency licenses are not
replaced by the sample grant. This candidate is unsigned and not published.
''',encoding='utf-8')
    with tempfile.TemporaryDirectory(prefix='ankhimate-launcher-') as scratch:
        binary=Path(scratch)/'Start-Demo.exe'
        subprocess.run(['rustup','run','1.95','rustc',str(SOURCE/'launcher.rs'),'--edition=2024','-O','-C','target-feature=+crt-static','-C','strip=symbols','-C','debuginfo=0','-C','link-arg=/PDBALTPATH:Start-Demo.pdb','--remap-path-prefix='+str(REPO)+'=runtime','--remap-path-prefix='+str(Path.home())+'=build-user','-o',str(binary)],check=True)
        copy(binary,out/'Start-Demo.exe')
    packages={name:read(REPO/name/'package.json') for name in ['core','pixi']}
    manifest={'manifestVersion':1,'candidate':a.candidate,'platform':'windows-x64','backend':'PixiJS WebGL2','runtimeFormatVersion':2,'signed':False,'cleanWindowsQualified':False,
      'runtimeCheckpoint':git('rev-parse','HEAD'),'runtimeSourceTree':git('rev-parse','HEAD^{tree}'),'runtimeSourceDirty':bool(git('status','--porcelain')),'runtimeFunctionalCheckpoint':'a69aebe4dc1dfc94b527965ab88a9009e9ec763d',
      'editor':{'entryPoint':'Editor/Ankhimate.exe','version':proof['version'],'commit':proof['editorCommit'],'sha256':sha(out/'Editor/Ankhimate.exe')},
      'components':{**{meta['name']:{'version':meta['version'],'entryPoint':f'Runtime/{name}/index.js'} for name,meta in packages.items()},
        **{name:{'version':dependencies[name]['version'],'entryPoint':path} for name,path in [('pixi.js','Runtime/vendor/pixi.mjs'),('fflate','Runtime/vendor/fflate.mjs')]}},
      'launcher':'Start-Demo.exe','example':{'name':'Jade Sentinel','project':'Examples/Jade-Sentinel/Sentinelle.ankh','export':'Examples/Jade-Sentinel/Export/skeleton.json','demo':'Examples/Jade-Sentinel/demo.html'},
      'documentation':sorted(p.relative_to(out).as_posix() for p in (out/'Docs').glob('*.md')),'aiIndex':'llms.txt','compiledFiles':compiled,
      'files':[{'path':p.relative_to(out).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(out.rglob('*')) if p.is_file()]}
    write(out/'distribution-manifest.json',manifest)
    (out/'SHA256SUMS.txt').write_text(''.join(f'{sha(p)}  {p.relative_to(out).as_posix()}\n' for p in sorted(out.rglob('*')) if p.is_file()),encoding='utf-8')
    with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for src in sorted(out.rglob('*')):
            if src.is_file():z.write(src,Path(out.name)/src.relative_to(out))
    archive.with_suffix('.zip.sha256').write_text(f'{sha(archive)}  {archive.name}\n',encoding='utf-8')
    print(json.dumps({'archive':str(archive),'sha256':sha(archive),'files':len(manifest['files'])+2,'compiledModules':len(compiled),'browserNoticePackages':len(dependencies)},indent=2))

if __name__=='__main__':main()
