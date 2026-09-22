import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


class CollectionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.codes = []
        self.active = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'div' and 'code' in dict(attrs).get('class', '').split():
            if self.active:
                raise ValueError('Nested collection entry')
            self.active = True
            self.parts = []

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == 'div' and self.active:
            self.codes.append(''.join(self.parts).strip())
            self.active = False


def validate(root):
    parser = CollectionParser()
    parser.feed((root / 'index.html').read_text(encoding='utf-8'))
    counts = Counter(parser.codes)
    baseline = set(json.loads((root / 'collection-baseline.json').read_text(encoding='utf-8')))
    additions = set('SNOS-172 SNOS-149 SNOS-115 OFES-033 YUJ-072 MNGS-072 START-620 START-608 START-599'.split())
    checks = {
        'collection_count_203': len(parser.codes) == 203,
        'unique_203': len(counts) == 203,
        'baseline_194': len(baseline) == 194,
        'original_entries_preserved': baseline <= counts.keys(),
        'exact_expected_set': set(counts) == baseline | additions,
        'YUJ-172_absent': 'YUJ-172' not in counts,
        'YUJ-072_once': counts['YUJ-072'] == 1,
        'SNOS-323_absent': 'SNOS-323' not in counts,
        'SONE-323_present': counts['SONE-323'] == 1,
        '9SNOS-059_present': counts['9SNOS-059'] == 1,
        '9OFJE-638_present': counts['9OFJE-638'] == 1,
        'START-548_once': counts['START-548'] == 1,
        'all_nine_additions_present': additions <= counts.keys(),
    }
    print(json.dumps({'checks': checks, 'collection_count': len(parser.codes), 'unique': len(counts), 'duplicates': len(parser.codes) - len(counts)}, indent=2))
    if not all(checks.values()):
        raise SystemExit('Collection integrity validation failed')


if __name__ == '__main__':
    validate(Path(__file__).resolve().parent)
