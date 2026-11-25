import importlib.util, unittest, xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch
import subprocess
spec=importlib.util.spec_from_file_location('capture',Path(__file__).with_name('capture-android.py'))
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
def rows(*texts):return [ET.Element('node',{'text':text,'bounds':'[10,20][110,60]'}) for text in texts]
class PreviewControls(unittest.TestCase):
    def test_launcher_overlay_and_welcome_are_handled(self):
        self.assertEqual(capture.startup_action(rows("Quickstep isn't responding",'Close app','Wait')),(60,40))
        self.assertEqual(capture.startup_action(rows('Welcome to PokéBacon Studio','START EDITING')),(60,40))
        self.assertIsNone(capture.startup_action(rows('Project menu')))
    def test_studio_anr_is_a_failure(self):
        with self.assertRaisesRegex(RuntimeError,'ANR'):capture.startup_action(rows("PokéBacon Studio isn't responding",'Close app'))
    def test_invisible_and_invalid_controls_are_not_tapped(self):
        for attrs in [{'bounds':'[0,0][0,0]'},{'bounds':'[-10,0][20,30]'},{'visible-to-user':'false'}]:
            node=rows('Project menu')[0];node.attrib.update(attrs);self.assertIsNone(capture.control([node],'Project menu'))
    def test_transient_emulator_dump_kill_retries_then_succeeds(self):
        killed=subprocess.CalledProcessError(137,['adb','shell','uiautomator'])
        with patch.object(capture,'adb',side_effect=[killed,b'UI hierarchy dumped']) as adb, patch.object(capture.time,'sleep') as sleep:
            self.assertEqual(capture.dump_window(attempts=2,delay=0.1),b'UI hierarchy dumped')
            self.assertEqual(adb.call_count,2)
            sleep.assert_called_once_with(0.1)
    def test_persistent_kill_and_nontransient_fail_closed(self):
        for code,attempts in [(137,3),(1,3),(-9,2)]:
            error=subprocess.CalledProcessError(code,['adb','shell','uiautomator'])
            with patch.object(capture,'adb',side_effect=error) as adb, patch.object(capture.time,'sleep'):
                with self.assertRaises(subprocess.CalledProcessError) as raised:
                    capture.dump_window(attempts=attempts,delay=0)
                self.assertEqual(raised.exception.returncode,code)
                self.assertEqual(adb.call_count,attempts if code in (137,-9) else 1)
if __name__=='__main__':unittest.main()
