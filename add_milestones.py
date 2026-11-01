from pathlib import Path
p=Path('_anniversary_analysis/website/index.html')
s=p.read_text('utf-8-sig')
s=s.replace('<div class="year-tabs"', '<div class="milestones"><div><small>06.09.2024</small><b>เริ่มคบกัน</b><span>ไก่ต้มน้ำปลาที่อัยย์ทำให้กิน</span></div><div><small>06.09.2025</small><b>ครบรอบ 1 ปี</b><span>มื้อที่ร้านเย็นตาโฟ โต้รุ่ง</span></div><div><small>06.09.2026</small><b>ครบรอบ 2 ปี</b><span>รูปของเราวันนี้</span></div></div><div class="year-tabs"')
p.write_text(s,encoding='utf-8')
