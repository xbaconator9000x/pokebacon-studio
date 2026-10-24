#!/usr/bin/env python3
"""Stage only tracked web resources for the offline iOS bundle."""
import json, pathlib, re, shutil, subprocess
root = pathlib.Path(__file__).resolve().parent.parent
destination = root / 'ios' / 'Web'
if destination.exists(): shutil.rmtree(destination)
allowed = {'.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.wasm', '.bin', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.txt', '.md', '.bps', '.mp3', '.mid', '.wav', '.woff', '.woff2', '.ttf', '.map', '.c', '.ld', '.sh', '.py'}
files = subprocess.check_output(['git', 'ls-files', '-z', 'dist'], cwd=root).decode().split('\0')
for name in filter(None, files):
    source = root / name
    shard = re.fullmatch(r'group\d+-shard\d+of\d+', source.name)
    if not source.is_file() or source.is_symlink() or (source.suffix.lower() not in allowed and source.name not in {'LICENSE', 'NOTICE'} and not shard): continue
    target = destination / source.relative_to(root / 'dist')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
for manifest in destination.rglob('weights_manifest.json'):
    for group in json.loads(manifest.read_text()):
        for name in group['paths']:
            path = (manifest.parent / name).resolve()
            if not path.is_relative_to(destination.resolve()) or not path.is_file():
                raise SystemExit(f'Music model file missing from the iOS bundle: {name}')
print('Staged offline editor:', destination)
