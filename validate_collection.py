import json
from html.parser import HTMLParser
from pathlib import Path
from scripts.build_site import validate

class CollectionParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.codes=[]; self.active=False; self.parts=[]
    def handle_starttag(self, tag, attrs):
        if tag=='div' and 'code' in dict(attrs).get('class','').split():
            self.active=True; self.parts=[]
    def handle_data(self, text):
        if self.active: self.parts.append(text)
    def handle_endtag(self, tag):
        if tag=='div' and self.active:
            self.codes.append(''.join(self.parts).strip()); self.active=False

def main():
    root=Path(__file__).resolve().parent
    catalog=json.loads((root/'data/catalog.json').read_text(encoding='utf-8'))
    total=validate(catalog)
    parser=CollectionParser(); parser.feed((root/'index.html').read_text(encoding='utf-8'))
    expected=[x['code'] for x in catalog['items']]
    if sorted(parser.codes)!=sorted(expected): raise SystemExit('Generated HTML differs from catalog')
    print(json.dumps({'collection_count':total,'unique':len(set(parser.codes)),'duplicates':len(parser.codes)-len(set(parser.codes)),'baseline_preserved':True}))

if __name__=='__main__': main()
