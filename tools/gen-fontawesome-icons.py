# /// script
# requires-python = ">=3.9"
# dependencies = ["fonttools", "brotli", "pyyaml"]
# ///
"""Regenerate fa-icons.js (Font Awesome Free names + search keywords).

Usage: uv run tools/gen-fontawesome-icons.py <package-dir> <output-js>

<package-dir> holds css/all.min.css, webfonts/fa-{solid-900,regular-400,brands-400}.woff2
and metadata/icons.yml from the @fortawesome/fontawesome-free npm package
(tools/update-fontawesome.sh downloads them for you).

An icon is included only if its glyph really exists in the Free web font for that
style, because metadata/icons.yml also lists Pro-only styles and icons.
"""
import json
import re
import sys

import yaml
from fontTools.ttLib import TTFont

pkg, out = sys.argv[1], sys.argv[2]
meta = yaml.safe_load(open(pkg + '/metadata/icons.yml'))
css = open(pkg + '/css/all.min.css').read()

version = (re.search(r'Font Awesome Free ([\d.]+)', css) or [None, None])[1]
if not version:
    sys.exit('Could not read the version from the Font Awesome CSS header.')

fonts = {'solid': 'fa-solid-900', 'regular': 'fa-regular-400', 'brands': 'fa-brands-400'}
code = {'solid': 's', 'regular': 'r', 'brands': 'b'}
cmaps = {s: set(TTFont('%s/webfonts/%s.woff2' % (pkg, f)).getBestCmap()) for s, f in fonts.items()}

res = {'s': [], 'r': [], 'b': []}
for name, m in meta.items():
    name = str(name)
    cp = int(str(m['unicode']), 16)
    if not re.search(r'\.fa-' + re.escape(name) + r'(?![a-z0-9-])', css):
        continue  # no CSS class in the Free build
    words = {str(t).lower() for t in (m.get('search', {}).get('terms') or [])}
    words |= {str(a).lower() for a in (m.get('aliases', {}).get('names') or [])}
    words.add(str(m.get('label', '')).lower())
    words.discard(name)
    kw = ' '.join(sorted(w for w in words if w))
    for style in m['styles']:
        if style in fonts and cp in cmaps[style]:
            res[code[style]].append([name, kw])

for k in res:
    res[k].sort()
if sum(len(v) for v in res.values()) < 500:
    sys.exit('Found very few icons; the Font Awesome package layout may have changed.')

with open(out, 'w') as f:
    f.write('// Font Awesome Free %s icon names + search keywords, generated from its metadata and web fonts.\n' % version)
    f.write('// s = solid, r = regular, b = brands. Each entry is [name, "extra search keywords"].\n')
    f.write('window.FA_ICONS = ' + json.dumps(res, separators=(',', ':'), ensure_ascii=False) + ';\n')
print('fa-icons.js: %d solid, %d regular, %d brands (Font Awesome Free %s)' % (len(res['s']), len(res['r']), len(res['b']), version))
