import json,shutil
from pathlib import Path
p=Path('_anniversary_analysis'); out=p/'website'
es=json.loads((p/'events.json').read_text('utf-8')); idx={r['id']:r for r in json.loads((p/'reviewed_index.json').read_text('utf-8'))}
VIDEO_EXTENSIONS={'.mov','.mp4','.m4v','.webm','.ogg'}
ANIMATED_EXTENSIONS={'.gif'}

# Website-level editorial grouping. The source event records remain untouched;
# these groups only decide how memories are presented on the public preview site.
MERGE_GROUPS = [
    ('E005', ['E005', 'E071'], 'ทริปเที่ยวด้วยกันครั้งแรก — พาใจกลับบ้าน (Homecoming)'),
    ('E025', ['E025', 'E070'], 'พาอัยย์ไปเจอพ่อแม่ครั้งแรก'),
    ('E037', ['E037', 'E039'], 'วันพาอัยย์ไปตัดผม'),
    ('E060', ['E060', 'E066'], 'ทริปกาญจนบุรีกับครอบครัวอัยย์'),
    ('E064', ['E064', 'E067'], 'เที่ยวงานโชว์สัตว์น้ำที่เซ็นทรัลเวิลด์'),
    ('E072', ['E072', 'E073'], 'อัยย์แอบหยิบโทรศัพท์ไปเซลฟี่'),
]
EXCLUDED_EVENT_IDS = {'E006'}  # นักล่าหมูกระทะ — owner asked to remove from website
GROUP_BY_MEMBER = {
    member: (canonical, members, title)
    for canonical, members, title in MERGE_GROUPS
    for member in members
}

def valid_dates(events):
    return sorted({e.get('date') for e in events if str(e.get('date','')).startswith(('2024-','2025-','2026-'))})

def grouped_events(events):
    by_id={e['event_id']:e for e in events}
    consumed=set()
    result=[]
    for e in events:
        eid=e['event_id']
        if eid in EXCLUDED_EVENT_IDS or eid in consumed:
            continue
        group=GROUP_BY_MEMBER.get(eid)
        if not group:
            result.append(e)
            consumed.add(eid)
            continue
        canonical, members, title=group
        parts=[by_id[mid] for mid in members if mid in by_id and mid not in EXCLUDED_EVENT_IDS]
        merged=dict(e)
        merged['event_id']=canonical
        merged['name']=title
        merged['files']=list(dict.fromkeys(pid for part in parts for pid in part.get('files',[])))
        memories=[]
        for part in parts:
            memory=part.get('owner_memory','')
            if memory and memory != 'UNKNOWN' and memory not in memories:
                memories.append(memory)
        merged['owner_memory']='; '.join(memories)
        dates=valid_dates(parts)
        merged['date']=dates[0] if dates else 'UNKNOWN'
        merged['linked_event_ids']=members
        result.append(merged)
        consumed.update(members)
    return result

data=[]
for e in grouped_events(es):
 if e.get('usage_status')!='PUBLIC_WEB_OK':continue
 photos=[]
 media=[]
 videos=[]
 for pid in e['files']:
  r=idx.get(pid,{})
  if r.get('usage_status')!='PUBLIC_WEB_OK':continue
  if 'Screenshots' in r.get('category','') or pid in ['P057','P106','P107']:continue
  f=p/'previews'/f'{pid}.jpg'
  if not f.exists():continue
  shutil.copyfile(f,out/'assets'/f'{pid}.jpg');photos.append(pid)
  ext=str(r.get('extension','')).lower()
  media_type='video' if ext in VIDEO_EXTENSIONS else 'gif' if ext in ANIMATED_EXTENSIONS else 'image'
  asset_name=f'{pid}{ext}' if media_type in {'video','gif'} else f'{pid}.jpg'
  if media_type in {'video','gif'}:
   source=Path(r.get('file',''))
   if not source.is_file():
    source=p.parent/source
   if source.is_file():
    shutil.copyfile(source,out/'assets'/asset_name)
   else:
    media_type='image'; asset_name=f'{pid}.jpg'
  media.append({'id':pid,'type':media_type,'asset':asset_name})
  if media_type=='video':videos.append(pid)
 if not photos:continue
 memory=e.get('owner_memory','')
 if memory=='UNKNOWN':memory=''
 date=e.get('date','')
 if not date.startswith(('2024-','2025-','2026-')):date=''
 cat='everyday'
 if any(t in memory for t in ['เที่ยว','ทริป','หอศิลป์','ท้องฟ้า','เขาใหญ่','พัทยา']):cat='travel'
 elif any(t in memory for t in ['กิน','อาหาร','ข้าว','ขนม']):cat='food'
 elif any(t in memory for t in ['หลับ','แอบ','ตลก','อีโม']):cat='cute'
 data.append(dict(id=e['event_id'],title=e['name'].replace(' (รายละเอียด UNKNOWN)','').replace(' (เจ้าของระบุรูปปกติ)',''),memory=memory,date=date,photos=photos,videos=videos,media=media,category=cat))
(out/'data.js').write_text('window.MEMORIES='+json.dumps(data,ensure_ascii=False)+';',encoding='utf-8')
print('Prepared',len(data),'public events')
