import importlib.util, unittest, xml.etree.ElementTree as ET
from pathlib import Path
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
if __name__=='__main__':unittest.main()
