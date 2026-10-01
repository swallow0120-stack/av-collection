(function (root) {
  'use strict';
  function normalize(value) {
    const text = String(value).normalize('NFKC').toUpperCase().trim().replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, '');
    const match = /^(\d*)([A-Z]+)-?(\d{1,6})(?:-?(V))?$/.exec(text);
    if (!match) return null;
    return match[1] + match[2] + '-' + String(Number(match[3])).padStart(3, '0') + (match[4] ? '-V' : '');
  }
  function base(code) {
    const canonical = normalize(code);
    return canonical ? canonical.replace(/^\d+/, '').replace(/-V$/, '') : null;
  }
  function parse(text) {
    return String(text).split(/[\n,，;；、]+/).flatMap(line => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      if (normalize(trimmed)) return [trimmed];
      const tokens = trimmed.split(/\s+(?:跟|與|和|及)\s+|\s{2,}|\s+(?=\d*[A-Za-z]+[-\d])/).filter(Boolean);
      return tokens.length > 1 ? tokens : [trimmed];
    });
  }
  function check(input, items, draftItems = []) {
    const seen = new Set(), families = new Set();
    return parse(input).map(raw => {
      const code = normalize(raw);
      if (!code) return {raw, code: null, state: 'invalid', matches: [], inList: false, similarInList: false};
      const inList = seen.has(code), family = base(code), similarInList = !inList && families.has(family);
      seen.add(code); families.add(family);
      const exact = items.filter(x => normalize(x.code) === code || (x.lookup_aliases || []).some(alias => normalize(alias) === code));
      const possible = items.filter(x => base(x.code) === family);
      const local = draftItems.filter(x => base(x.code) === family && !items.some(y => normalize(y.code) === normalize(x.code)));
      return {raw, code, inList, similarInList, state: exact.length ? 'owned' : possible.length ? 'possible' : local.length ? 'draft' : 'missing', matches: exact.length ? exact : possible.length ? possible : local};
    });
  }
  const api = {normalize, base, parse, check};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CollectionCheck = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
