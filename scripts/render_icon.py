#!/usr/bin/env python3
"""Export every raster fallback from the editable Icon Composer document."""
import json
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
app = root / 'SafariExtension/RightClickRestore/Shared (App)'
renderer = '/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool'

def resize(source, destination, size):
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['sips', '-z', str(size), str(size), str(source), '--out', str(destination)], check=True, stdout=subprocess.DEVNULL)

with tempfile.TemporaryDirectory(prefix='rightclick-icons-') as scratch:
    master = Path(scratch) / 'master.png'
    subprocess.run([renderer, str(root / 'Assets/RestoreIcon.icon'), '--export-image', '--output-file', str(master), '--platform', 'macOS', '--rendition', 'Default', '--width', '1024', '--height', '1024', '--scale', '1', '--design-generation', '27'], check=True)
    if not master.is_file():
        raise RuntimeError('Icon Composer did not produce an image')
    catalog = app / 'Assets.xcassets/AppIcon.appiconset'
    for item in json.loads((catalog / 'Contents.json').read_text())['images']:
        size = int(item['size'].split('x')[0]) * int(item.get('scale', '1x')[0])
        resize(master, catalog / item['filename'], size)
    for size in [16, 32, 48, 64, 128, 256, 512]:
        resize(master, root / f'src/icons/icon-{size}.png', size)
    resize(master, app / 'Assets.xcassets/LargeIcon.imageset/icon-256.png', 256)
    for path in ['Resources/Icon.png', 'Resources/Base.lproj/Icon.png']:
        resize(master, app / path, 1024)
    iconset = Path(scratch) / 'AppIcon.iconset'
    for size in [16, 32, 128, 256, 512]:
        for scale in [1, 2]:
            suffix = '@2x' if scale == 2 else ''
            resize(master, iconset / f'icon_{size}x{size}{suffix}.png', size * scale)
    subprocess.run(['iconutil', '-c', 'icns', str(iconset), '-o', str(app / 'Resources/AppIcon.icns')], check=True)

subprocess.run(["swift", str(root / "scripts/render_toolbar.swift"), str(root)], check=True)
