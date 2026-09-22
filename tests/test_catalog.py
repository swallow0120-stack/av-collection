import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_site', ROOT / 'scripts/build_site.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'))
    def test_valid_catalog(self):
        self.assertEqual(build.validate(self.data), len(self.data['items']))
    def test_duplicate_rejected(self):
        self.data['items'].append(copy.deepcopy(self.data['items'][0]))
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_missing_baseline_rejected(self):
        baseline=set(json.loads((ROOT/'data/migration-baseline.json').read_text(encoding='utf-8')))
        self.data['items']=[x for x in self.data['items'] if x['code'] != next(iter(baseline))]
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_future_addition_allowed(self):
        self.data['items'].append({'code':'TEST-999999','category':self.data['categories'][0]['id'],'people':[],'note':''})
        self.assertEqual(build.validate(self.data),len(self.data['items']))
    def test_unknown_category_rejected(self):
        self.data['items'][0]['category']='missing'
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_duplicate_alias_rejected(self):
        self.data['people'][1]['aliases'].append(self.data['people'][0]['name'])
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_cast_preserved(self):
        item=next(x for x in self.data['items'] if x['code']=='9MIRD-284')
        self.assertEqual(len(item['people']),4)
    def test_html_escaped(self):
        self.data['items'][0]['note']='<script>alert(1)</script>'
        page=build.render(self.data)
        self.assertNotIn('<script>alert(1)</script>',page)
        self.assertIn('&lt;script&gt;',page)
    def test_unsafe_link_rejected(self):
        self.data['categories'][0]['links'][0]['url']='javascript:alert(1)'
        with self.assertRaises(ValueError): build.validate(self.data)
    def test_sorting(self):
        codes=['YUJ-072','9SNOS-059','SNOS-003','START-172-V','START-172']
        self.assertEqual(sorted(codes,key=build.sort_key),['SNOS-003','9SNOS-059','START-172','START-172-V','YUJ-072'])

if __name__ == '__main__': unittest.main()
