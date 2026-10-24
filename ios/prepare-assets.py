#!/usr/bin/env python3
"""Stage only tracked web resources for the offline iOS bundle."""
import pathlib, shutil, subprocess
root = pathlib.Path(__file__).resolve().parent.parent
destination = root / 'ios' / 'Web'
if destination.exists(): shutil.rmtree(destination)
allowed = {'.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.wasm', '.bin', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.txt', '.md', '.bps', '.mp3', '.mid', '.wav', '.woff', '.woff2', '.ttf', '.map'}
files = subprocess.check_output(['git', 'ls-files', '-z', 'dist'], cwd=root).decode().split('\0')
for name in filter(None, files):
    source = root / name
    if not source.is_file() or source.is_symlink() or (source.suffix.lower() not in allowed and source.name not in {'LICENSE', 'NOTICE'}): continue
    target = destination / source.relative_to(root / 'dist')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
print('Staged offline editor:', destination)
