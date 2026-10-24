"""Capture the running native Android app with its accessibility controls."""
import pathlib, re, subprocess, time, xml.etree.ElementTree as ET

root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'android' / 'previews'
out.mkdir(parents=True, exist_ok=True)
def adb(*args):
    return subprocess.check_output(['adb', *args])
def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/studio-window.xml')
    xml = adb('exec-out', 'cat', '/sdcard/studio-window.xml')
    (out / 'last-window.xml').write_bytes(xml)
    return ET.fromstring(xml).iter('node')
def tap(label):
    for _ in range(12):
        for node in nodes():
            if not any(value.casefold().startswith(label.casefold()) for value in (node.get('text', ''), node.get('content-desc', ''))):
                continue
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
            adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
            time.sleep(1)
            return
        time.sleep(1)
    raise RuntimeError('Missing accessible control: ' + label)
def capture(name):
    (out / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))

apk = next((root / 'dist').glob('PokeBacon_Studio_v*.apk'))
adb('install', '-r', str(apk))
adb('shell', 'am', 'start', '-n', 'dev.pokebacon.studio/.MainActivity')
time.sleep(8)
tap('Start editing')
time.sleep(2)
capture('01-map-editor')
tap('Project menu')
capture('02-projects')
adb('shell', 'input', 'keyevent', '4')
time.sleep(1)
tap('Switch workspace')
capture('03-workspaces')
tap('Sprite workshop')
capture('04-sprites')
adb('shell', 'input', 'keyevent', '4')
time.sleep(1)
capture('05-back-to-map')
