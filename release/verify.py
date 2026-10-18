"""Verify an extracted candidate's manifest, documentation, module graph and hygiene."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import hashlib, json, re, argparse

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('candidate',type=Path);a=parser.parse_args();root=a.candidate.resolve()
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    manifest=json.loads((root/'distribution-manifest.json').read_text(encoding='utf-8'));errors=[];links=0
    for item in manifest['files']:
        p=root/item['path']
        if not p.is_file() or sha(p)!=item['sha256']:errors.append('Manifest mismatch: '+item['path'])
    for line in (root/'SHA256SUMS.txt').read_text().splitlines():
        h,p=line.split('  ',1)
        if sha(root/p)!=h:errors.append('SHA256SUMS mismatch: '+p)
    def anchors(path):
        text=path.read_text(encoding='utf-8');seen={};out=set(re.findall(r'<a\s+id="([^"]+)"',text))
        for heading in re.findall(r'^#{1,6}\s+(.+)$',text,re.M):
            name=re.sub(r'[^\w\- ]','',heading.lower()).replace(' ','-');n=seen.get(name,0);seen[name]=n+1;out.add(name+(f'-{n}' if n else ''))
        return out
    for p in sorted(root.rglob('*')):
        if not p.is_file():continue
        rel=p.relative_to(root).as_posix()
        if any(part in {'.git','node_modules','target','test-results','__pycache__'} for part in p.relative_to(root).parts):errors.append('Unexpected development directory: '+rel)
        if p.suffix in {'.pdb','.map'}:errors.append('Unexpected debug artifact: '+rel)
        if p.suffix in {'.json','.js','.mjs','.md','.html','.txt','.ts'}:
            text=p.read_text(encoding='utf-8')
            if re.search(r'[CD]:[/\\]+(?:Users[/\\]+(?!User(?:[/\\]|$))[^/\\\s"<>]+|Ankhimate[/\\])',text,re.I):errors.append('Internal path: '+rel)
            if p.suffix=='.json':json.loads(text)
            if p.suffix=='.md' or p.name=='llms.txt':
                for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',text):
                    url=urlsplit(link)
                    if url.scheme or url.netloc:continue
                    target=(p.parent/unquote(url.path)).resolve() if url.path else p
                    links+=1
                    if not target.is_relative_to(root) or not target.exists():errors.append(f'Broken link {rel}: {link}')
                    elif url.fragment and target.suffix=='.md' and unquote(url.fragment) not in anchors(target):errors.append(f'Broken anchor {rel}: {link}')
    imports={'pixi.js':root/'Runtime/vendor/pixi.mjs','fflate':root/'Runtime/vendor/fflate.mjs','@ankhimate/runtime':root/'Runtime/core/index.js','@ankhimate/pixi-runtime':root/'Runtime/pixi/index.js'}
    module_count=0
    for p in [*root.glob('Runtime/**/*.js'),*root.glob('Runtime/**/*.mjs'),*root.glob('Docs/*.mjs'),*root.glob('Examples/**/*.mjs')]:
        module_count+=1
        for spec in re.findall(r'^(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?[\'"]([^\'"]+)[\'"]',p.read_text(encoding='utf-8'),re.M):
            dest=imports.get(spec) if not spec.startswith('.') else (p.parent/spec).resolve()
            if dest is None or not dest.is_file():errors.append(f'Unresolved import: {p.name} -> {spec}')
    for f in [manifest['launcher'],manifest['example']['project'],manifest['example']['export'],manifest['example']['demo'],manifest['aiIndex'],*manifest['documentation']]:
        if not (root/f).is_file():errors.append('Manifest reference missing: '+f)
    rigs=list(root.glob('**/*.ankh'))
    if len(rigs)!=1 or rigs[0].name!='Sentinelle.ankh':errors.append('Expected only Jade Sentinel author project')
    result={'pass':not errors,'manifestFiles':len(manifest['files']),'markdownLinks':links,'modulesChecked':module_count,'errors':errors}
    print(json.dumps(result,indent=2));return 0 if not errors else 1

if __name__=='__main__':raise SystemExit(main())
