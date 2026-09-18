#!/usr/bin/env python3
"""Check that config.js's note markers and config-notes.md agree.

config.js carries a marker on every documented line -- `// (warn)N0005` for a note
with a trap, `// ~N0004` for prose. This asserts the two files have not drifted:
every marker resolves to exactly one note, and every note is still pointed at.

Run it after moving, adding or deleting a config key.
"""
import re, sys, os

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, '..', 'src')
code = open(os.path.join(src, 'config.js'), encoding='utf-8').read()
md = open(os.path.join(src, 'config-notes.md'), encoding='utf-8').read()

# the header's own examples are illustrations, not markers -- skip the preamble
body = code.split('*/', 1)[1] if code.startswith('/*') else code

markers = re.findall(r'[~⚠](N\d{4})', body)
notes = re.findall(r'^###?\s*(?:⚠\s*)?(N\d{4})\b', md, re.M)
notes += re.findall(r'^`(N\d{4})`', md, re.M)          # section-header form

dup_m = {i for i in markers if markers.count(i) > 1}
dup_n = {i for i in notes if notes.count(i) > 1}
ms, ns = set(markers), set(notes)

bad = []
for i in sorted(ms - ns): bad.append('marker ~%s in config.js has NO note' % i)
for i in sorted(ns - ms): bad.append('note %s is no longer pointed at by any key' % i)
for i in sorted(dup_m):   bad.append('marker %s appears on more than one line' % i)
for i in sorted(dup_n):   bad.append('note %s is defined more than once' % i)

print('markers in config.js: %d   notes in config-notes.md: %d' % (len(ms), len(ns)))
if bad:
    print('\nDRIFT:')
    for b in bad: print('  -', b)
    sys.exit(1)
print('ok -- every marker resolves, every note is reachable')
