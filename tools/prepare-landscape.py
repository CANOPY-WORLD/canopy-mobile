import json,urllib.request,gzip,hashlib
from pathlib import Path
routes=json.load(open('dist/asset-sources.json'))['resources']
base='scenes/imperial_corridor_8km/context/vector_landscape/'
out=Path('dist/mobile-assets');out.mkdir(exist_ok=True)
records=[]
def get(path):
 target=routes[base+path]
 if isinstance(target,dict):target=target['url']
 raw=urllib.request.urlopen(target).read()
 records.append({'source_url':target,'source_sha256':hashlib.sha256(raw).hexdigest(),'source_bytes':len(raw)})
 return raw
meta=json.loads(get('manifest.json'));source=json.loads(get('source/scene-meta.json'))
print('source keys',list(source))
# Retain essential placements for the traffic context; tree sampling is display only.
small={'trees':source['trees'][::8],'placements':source.get('placements',{}),'fixtures':{'hedge':[]}}
(out/'landscape-source.json.gz').write_bytes(gzip.compress(json.dumps(small,separators=(',',':')).encode(),mtime=0))
for i,layer in enumerate(meta['layers']):
 raw=get(layer['file']);filename=f'surface-{i:02}.f32.gz';(out/filename).write_bytes(gzip.compress(raw,mtime=0));layer['file']=filename
(out/'landscape.json').write_text(json.dumps(meta))
(out/'provenance.json').write_text(json.dumps({'description':'Lossless gzip of retained flat surfaces; vegetation sampled one in eight for mobile display; placements retained. No scientific field modified.','source_records':records,'files':[{'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in out.iterdir()]},indent=2))
print('Mobile landscape bytes',sum(p.stat().st_size for p in out.iterdir()))
