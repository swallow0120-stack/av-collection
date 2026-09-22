"""One-time migration of the verified, user-maintained HTML collection."""
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.groups = []
        self.heading = False
        self.code = False
        self.anchor = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h2':
            self.heading = True
            self.groups.append({'label': '', 'people': [], 'codes': []})
        if tag == 'a' and self.heading:
            self.anchor = {'name': '', 'url': attrs.get('href', '')}
        if tag == 'div' and 'code' in attrs.get('class', '').split():
            self.code = True
            self.groups[-1]['codes'].append('')
    def handle_data(self, text):
        if self.heading:
            self.groups[-1]['label'] += text
        if self.anchor is not None:
            self.anchor['name'] += text
        if self.code:
            self.groups[-1]['codes'][-1] += text
    def handle_endtag(self, tag):
        if tag == 'h2': self.heading = False
        if tag == 'a' and self.anchor is not None:
            self.groups[-1]['people'].append(self.anchor)
            self.anchor = None
        if tag == 'div': self.code = False

def main():
    if (ROOT / "data/catalog.json").exists():
        raise SystemExit("Migration already exists; refusing to overwrite catalog")
    p = Parser()
    p.feed((ROOT / 'data/pre-migration.html').read_text(encoding='utf-8'))
    groups = [g for g in p.groups if g['codes']]
    people, categories, items = [], [], []
    for i, group in enumerate(groups):
        cid = f'category-{i + 1:02d}'
        label = group['label'].split('】')[0].removeprefix('【')
        kind = 'group' if '少數共演' in label else 'compilation' if '大型合集' in label else 'person'
        ids = []
        if kind == 'person':
            pid = f'person-{len(people) + 1:02d}'
            people.append({'id': pid, 'name': group['people'][0]['name'], 'aliases': [x['name'] for x in group['people'][1:]]})
            ids.append(pid)
        else:
            for person in group['people']:
                if person['name'] == '新有菜':
                    next(p for p in people if p['name'] == '橋本ありな')['aliases'].append('新有菜')
                    continue
                pid = f'person-{len(people) + 1:02d}'
                people.append({'id': pid, 'name': person['name'], 'aliases': []})
                ids.append(pid)
        categories.append({'id': cid, 'name': label, 'kind': kind, 'people': ids, 'links': group['people']})
        items.extend({'code': code.strip(), 'category': cid, 'people': ids.copy(), 'note': ''} for code in group['codes'])
    # Restore cast metadata for the six entries previously merged at the user's request.
    cast = {'IPZZ-789': ['長浜みつり', '金松季歩'], '9MIRD-284': ['九野ひなの', '伊藤舞雪', '金松季歩', '桜空もも'], 'ATID-651': ['木下ひまり', '翔田千里', '二階堂麗'], 'ATID-652': ['木下ひまり', '翔田千里', '二階堂麗'], 'OFSD-060': ['木下ひまり', '水瀬さな', '藤井レイラ', '透美かなた'], 'HMN-719': ['木下ひまり', '春陽モカ']}
    for item in items:
        if item['code'] not in cast: continue
        item['people'] = []
        for name in cast[item['code']]:
            person = next((p for p in people if name in [p['name'], *p['aliases']]), None)
            if person is None:
                person = {'id': f'person-{len(people)+1:02d}', 'name': name, 'aliases': []}
                people.append(person)
            item['people'].append(person['id'])
    catalog = {'schema_version': 1, 'people': people, 'categories': categories, 'items': items}
    assert len(items) == len({x['code'] for x in items}) == 203
    (ROOT / 'data/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (ROOT / 'data/migration-baseline.json').write_text(json.dumps(sorted(x['code'] for x in items), indent=2)+'\n', encoding='utf-8')

if __name__ == '__main__': main()
