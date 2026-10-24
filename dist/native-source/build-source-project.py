#!/usr/bin/env python3
"""Check or rebuild an exported Studio source project in a separate directory."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', action='store_true')
    parser.add_argument('--rom', type=Path, help='CFRU base ROM; never modified')
    parser.add_argument('--output', type=Path, default=Path('Studio_Build.gba'))
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    report = json.loads((root / 'studio/source-report.json').read_text())
    cfru = report['engine'] in ('cfru', 'shiny')
    tools = ['arm-none-eabi-gcc', 'arm-none-eabi-as', 'arm-none-eabi-ld',
             'arm-none-eabi-objcopy', 'grit'] if cfru else ['make', 'gcc']
    missing = [t for t in tools if not shutil.which(t)]
    print(report['engineName'] + ': ' + str(len(report['changes'])) + ' changed files')
    if missing:
        raise SystemExit('Install the project toolchain first. Missing: ' + ', '.join(missing))
    if not args.build:
        print('Preflight passed. Run with --build to compile.')
        return
    output = args.output.resolve()
    if output.exists():
        raise SystemExit('Choose a new output filename; existing ROMs are not overwritten.')
    with tempfile.TemporaryDirectory(prefix='studio-source-build-') as temp:
        working = Path(temp) / 'project'
        shutil.copytree(root, working, ignore=shutil.ignore_patterns('.git', 'build', '*.gba', '*.sav'))
        if cfru:
            if not args.rom or not args.rom.is_file():
                raise SystemExit('CFRU requires --rom /path/to/BPRE0.gba')
            config = (working / 'scripts/make.py').read_text()
            match = re.search(r'^ROM_NAME\s*=\s*[\'"]([^\'"]+)[\'"]', config, re.M)
            if not match or Path(match[1]).name != match[1]:
                raise SystemExit('Unsupported CFRU base-ROM filename configuration.')
            shutil.copyfile(args.rom, working / match[1])
            insert = (working / 'scripts/insert.py').read_text()
            product = re.search(r'^ROM_NAME\s*=\s*[\'"]([^\'"]+)[\'"]', insert, re.M)
            if not product or Path(product[1]).name != product[1] or product[1] == match[1]:
                raise SystemExit('Unsupported CFRU output filename configuration.')
            command = [sys.executable, 'scripts/make.py']
            expected = working / product[1]
        else:
            command = ['make', '-j2']
            expected = None
        result = subprocess.run(command, cwd=working, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True)
        print(result.stdout)
        if result.returncode or re.search(r'(?im)^\s*(error[: ]|symbol missing:|there was an error|error compiling|errror!|unknown event type|devkit.*not found)', result.stdout):
            raise SystemExit('Source build failed; no ROM exported.')
        products = [expected] if expected else list(working.glob('*.gba'))
        products = [p for p in products if p and p.is_file()]
        if len(products) != 1:
            raise SystemExit('Build did not produce one identifiable GBA ROM.')
        data = products[0].read_bytes()
        if not 0xC0 <= len(data) <= 32 * 1024 * 1024 or data[0xB2] != 0x96:
            raise SystemExit('Build output is not a valid GBA ROM.')
        if ((-sum(data[0xA0:0xBD]) - 0x19) & 255) != data[0xBD]:
            raise SystemExit('Build output has an invalid GBA header checksum.')
        if cfru and data == args.rom.read_bytes():
            raise SystemExit('Unchanged ROM produced; no ROM exported.')
        shutil.copyfile(products[0], output)
        print('Saved ' + str(output) + '\nSHA256 ' + hashlib.sha256(data).hexdigest())


if __name__ == '__main__':
    main()
