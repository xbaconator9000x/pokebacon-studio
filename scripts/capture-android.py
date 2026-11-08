"""Capture the running Android app, handling emulator startup overlays only."""
import pathlib, re, subprocess, time, xml.etree.ElementTree as ET
root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'android' / 'previews'
def adb(*args):return subprocess.check_output(['adb', *args])
def nodes():
    adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/studio-window.xml')
    xml = adb('exec-out', 'cat', '/sdcard/studio-window.xml')
    (out / 'last-window.xml').write_bytes(xml)
    try:return list(ET.fromstring(xml).iter('node'))
    except ET.ParseError:return []
def control(rows, label):
    for node in rows:
        if node.get('visible-to-user', 'true') == 'false':continue
        if any(v.casefold().startswith(label.casefold()) for v in (node.get('text', ''), node.get('content-desc', ''))):
            bounds = re.findall(r'-?\d+', node.get('bounds', ''))
            if len(bounds) == 4:
                x1, y1, x2, y2 = map(int, bounds)
                if x2 > x1 >= 0 and y2 > y1 >= 0:return (x1 + x2) // 2, (y1 + y2) // 2
    return None
def startup_action(rows):
    text = ' '.join(n.get('text', '') for n in rows).casefold()
    if "isn't responding" in text or 'is not responding' in text:
        if 'quickstep' not in text:raise RuntimeError('App/system ANR during preview: ' + text)
        # Quickstep is the emulator launcher. Never dismiss a Studio ANR.
        return control(rows, 'Close app')
    return control(rows, 'Start editing')
def click(point):
    adb('shell', 'input', 'tap', str(point[0]), str(point[1]));time.sleep(1)
def tap(label):
    for _ in range(20):
        rows = nodes();overlay = startup_action(rows)
        if overlay:click(overlay);continue
        point = control(rows, label)
        if point:click(point);return
        time.sleep(1)
    raise RuntimeError('Missing accessible control: ' + label)
def wait_for_editor():
    for _ in range(30):
        rows = nodes();overlay = startup_action(rows)
        if overlay:click(overlay);continue
        text = ' '.join(n.get('text', '') for n in rows).casefold()
        if control(rows, 'Project menu') and not any(t in text for t in ['preparing tiles', 'loading workshop', 'opening your workshop']):return
        time.sleep(1)
    raise RuntimeError('Studio did not become ready after startup overlays')
def capture(name):(out / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))
def main():
    out.mkdir(parents=True, exist_ok=True)
    manifest = ET.parse(root / 'android' / 'AndroidManifest.xml').getroot();package = manifest.attrib['package']
    activity = manifest.find('application/activity').attrib['{http://schemas.android.com/apk/res/android}name']
    if activity.startswith('.'):activity = package + activity
    apk = root / 'dist' / ('PokeBacon_Studio_v' + manifest.attrib['{http://schemas.android.com/apk/res/android}versionName'] + '.apk')
    adb('install', '-r', str(apk));adb('shell', 'wm', 'dismiss-keyguard');adb('shell', 'input', 'keyevent', '82')
    adb('shell', 'am', 'start', '-W', '-n', package + '/' + activity);time.sleep(8)
    capture('00-launch');wait_for_editor();capture('01-map-editor');tap('Project menu');capture('02-projects')
    adb('shell', 'input', 'keyevent', '4');time.sleep(1);tap('Switch workspace');capture('03-workspaces')
    tap('Sprite workshop');capture('04-sprites');adb('shell', 'input', 'keyevent', '4');time.sleep(1);capture('05-back-to-map')
if __name__ == '__main__':
    try:main()
    except Exception:
        out.mkdir(parents=True, exist_ok=True)
        try:capture('failure');(out / 'failure-logcat.txt').write_bytes(adb('logcat', '-d', '-t', '3000'))
        except Exception:pass
        raise
