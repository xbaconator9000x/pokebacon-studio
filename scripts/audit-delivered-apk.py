#!/usr/bin/env python3
"""Compare delivered APK assets with Git source without importing any payload.

Run from the repository root. Output contains paths and hashes only; keep APKs,
source archives and signing material outside the public repository.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import zipfile


def digest(data):
    return hashlib.sha256(data).hexdigest() if data is not None else None


def git_bytes(ref, path):
    result = subprocess.run(['git', 'show', f'{ref}:{path}'], capture_output=True)
    return result.stdout if result.returncode == 0 else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=pathlib.Path)
    parser.add_argument('--base', required=True, help='Verified common source baseline')
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    base = subprocess.check_output(['git', 'rev-parse', args.base], text=True).strip()
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    root = pathlib.Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    tracked = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', head, 'dist/'], text=True).splitlines()
    records = []
    with zipfile.ZipFile(args.apk) as apk:
        names = [n for n in apk.namelist() if n.startswith('assets/') and not n.endswith('/')]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate APK asset names; comparison is ambiguous')
        delivered = {n[7:]: n for n in names}
        paths = sorted(set(delivered) | {p[5:] for p in tracked})
        for path in paths:
            if '..' in pathlib.PurePosixPath(path).parts or path.startswith('/'):
                raise ValueError('Unsafe asset path')
            repo_path = 'dist/' + path
            old = git_bytes(base, repo_path)
            current = git_bytes(head, repo_path)
            incoming = apk.read(delivered[path]) if path in delivered else None
            if current == incoming:
                state = 'identical'
            elif current is None:
                state = 'delivered-only'
            elif incoming is None:
                state = 'repository-only'
            elif incoming == old:
                state = 'repository-change-delivery-at-baseline'
            elif current == old:
                state = 'delivery-change-repository-at-baseline'
            else:
                state = 'diverged-review-required'
            records.append({'path': repo_path, 'status': state, 'baseSha256': digest(old),
                            'repositorySha256': digest(current), 'deliveredSha256': digest(incoming)})
    counts = {state: sum(r['status'] == state for r in records) for state in sorted({r['status'] for r in records})}
    report = {'format': 'pokebacon-delivered-asset-comparison', 'version': 1,
              'repositoryCommit': head, 'baseCommit': base, 'apkSha256': digest(args.apk.read_bytes()),
              'deliveredAssetCount': len(names), 'counts': counts,
              'identicalPaths': [r['path'] for r in records if r['status'] == 'identical'],
              'assets': [r for r in records if r['status'] != 'identical'],
              'limits': ['Byte comparison does not determine semantic equivalence or safe merge direction.',
                         'Repository-only files may be required adapter dependencies; do not delete automatically.',
                         'Native shell, signing identity, physical Android and gameplay are not verified.',
                         'No APK payloads are copied or executed.']}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'deliveredAssets': len(names), 'counts': counts}))


if __name__ == '__main__':
    main()
