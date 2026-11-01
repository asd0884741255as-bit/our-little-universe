import json
from pathlib import Path

root = Path(__file__).resolve().parent
w = root if (root / 'data.js').is_file() else Path('_anniversary_analysis/website')
p = Path('_anniversary_analysis')

data = json.loads((w / 'data.js').read_text('utf-8').removeprefix('window.MEMORIES=').removesuffix(';'))
idx_file = p / 'reviewed_index.json'
idx = {r['id']: r for r in json.loads(idx_file.read_text('utf-8'))} if idx_file.is_file() else {}

used = {pid for e in data for pid in e['photos']}
ids = {e['id'] for e in data}
assert 'E006' not in ids
assert not any('นักล่าหมูกระทะ' in e['title'] for e in data)
expected_merges = {
    'E005': {'P022', 'P023', 'P024', 'P076'},
    'E025': {'P013', 'P054', 'P055', 'P056'},
    'E037': {'P066', 'P074'},
    'E060': {'P001', 'P008'},
    'E064': {'P002', 'P026'},
    'E072': {'P070', 'P071'},
}
for event_id, photo_ids in expected_merges.items():
    merged = next(e for e in data if e['id'] == event_id)
    assert photo_ids.issubset(set(merged['photos'])), event_id
assert not (w / 'assets' / 'P025.jpg').exists()
for pid in used:
    if idx:
        assert idx[pid]['usage_status'] == 'PUBLIC_WEB_OK', pid
    assert (w / 'assets' / f'{pid}.jpg').is_file(), pid
for event in data:
    for item in event.get('media', []):
        if item['type'] == 'video':
            assert (w / 'assets' / item['asset']).is_file(), item
        elif item['type'] == 'gif':
            assert (w / 'assets' / item['asset']).is_file(), item
assert 'P108' in used
print(f'Asset check passed: {len(data)} events, {len(used)} public image previews; no secret media.')
