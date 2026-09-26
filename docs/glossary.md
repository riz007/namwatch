# Glossary — TH / EN

Terminology used across the UI, the code and the docs. SPEC §9.

Keep these consistent. If a new domain term appears, add it here in the same PR
that introduces it, and use the same wording in `th.json` and `en.json`.

## Flood and water

| TH | EN | Notes |
|---|---|---|
| น้ำท่วมขัง | Waterlogging / standing water | Water that has pooled and is not flowing away |
| น้ำล้นตลิ่ง | Overbank flooding | A canal or river has risen above its bank |
| ระดับน้ำ | Water level | Always metres MSL for stations |
| ระดับตลิ่ง | Bank level | `min_bank` upstream; metres MSL |
| คลอง | Canal (khlong) | Keep "khlong" in EN place names |
| ประตูระบายน้ำ | Water gate / floodgate | |
| สถานีวัดน้ำ | Gauging station | An official sensor |
| ปริมาณฝน | Rainfall | Millimetres |
| รถเล็กไม่ควรผ่าน | Not passable for small cars | Depth band 3 |
| น้ำลดแล้ว | Water receded | Vote option |
| ยังท่วมอยู่ | Still flooded | Vote option |

## Administrative

| TH | EN | Notes |
|---|---|---|
| จังหวัด | Province | |
| เขต | District (khet) | Bangkok's 50 districts |
| แขวง | Subdistrict (khwaeng) | Within a Bangkok district |
| อำเภอ | District (amphoe) | Outside Bangkok |
| ตำบล | Subdistrict (tambon) | Outside Bangkok |
| ประกาศเขตพื้นที่ประสบสาธารณภัย | Disaster area declaration | |

## Agencies

| TH | EN | Short |
|---|---|---|
| กรุงเทพมหานคร | Bangkok Metropolitan Administration | BMA / กทม. |
| สำนักการระบายน้ำ | Department of Drainage and Sewerage | DDS |
| กรมป้องกันและบรรเทาสาธารณภัย | Department of Disaster Prevention and Mitigation | DDPM / ปภ. |
| สถาบันสารสนเทศทรัพยากรน้ำ | Hydro-Informatics Institute | HII / สสน. |
| สำนักงานพัฒนาเทคโนโลยีอวกาศและภูมิสารสนเทศ | Geo-Informatics and Space Technology Development Agency | GISTDA |
| ศูนย์เทคโนโลยีอิเล็กทรอนิกส์และคอมพิวเตอร์แห่งชาติ | National Electronics and Computer Technology Center | NECTEC |

## Product terms

| TH | EN | Notes |
|---|---|---|
| รายงานจากประชาชน | Community report | Our crowd data. Never call it official |
| สถานีวัดของหน่วยงานรัฐ | Government sensor station | Official sensor data |
| เรื่องแจ้งผ่านช่องทางราชการ | Filed through an official channel | Traffy Fondue: citizen-reported, agency-tracked |
| แหล่งข้อมูล | Source | Shown on every datum |
| ข้อมูลล่าช้า | Source delayed | Older than 3× its cadence |
| ยืนยัน | Confirm | Crowd vote |

## Tone rules (SPEC §9)

- Gender-neutral Thai. No ครับ / ค่ะ anywhere in UI chrome.
- Short imperative verbs for actions: แจ้งน้ำท่วม, ยืนยัน, แชร์, ลองใหม่.
- English at roughly a grade-6 reading level. Prefer "Not passable" over "Impassable".
- Never imply we dispatch rescue. "Need help" always points to the hotlines.
