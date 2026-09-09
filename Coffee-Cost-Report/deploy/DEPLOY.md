# Deploy — Coffee Cost Report

URL ปลายทาง: **https://www.cpr-one.com/coffee-cost-report**

> vhost เดิม redirect `cpr-one.com` → `www.cpr-one.com` อยู่แล้ว
> ดังนั้นเข้าที่ `cpr-one.com/coffee-cost-report` ก็จะเด้งไป `www.` ให้เอง

แอปนี้เป็น **Next.js 16 (App Router)** ที่มี API routes และเขียนไฟล์ลงดิสก์
จึง **ใช้ `Alias` เหมือน `/capex/api` หรือ `/technician_pm/ui` ไม่ได้**
ต้องรันเป็น Node process แล้วให้ Apache `ProxyPass` เข้าไป
— หลักการเดียวกับที่ vhost ปัจจุบันทำกับ `/phpMyAdmin` → `127.0.0.1:8080`

**ข้อดีของการใช้ sub-path:** ไม่ต้องแตะ DNS, ไม่ต้องแตะ ALB, ไม่ต้องขอ cert ใหม่

```
Browser → https://www.cpr-one.com/coffee-cost-report
             │
             ▼
        Apache :443  (vhost cpr-one.com เดิม)
             │ ProxyPass /coffee-cost-report
             ▼
        Node.js 127.0.0.1:3001   (systemd: coffee-cost-report)
             │
             ▼
        /var/www/apps/coffee-cost-report/data/*.json
```

---

## สิ่งที่แก้ในโค้ดเพื่อรองรับ sub-path

Next.js ไม่ได้ทำงานใต้ sub-path โดยอัตโนมัติ ต้องบอกมันตรงๆ ทำไปแล้ว 2 อย่าง:

1. **`lib/basePath.ts`** — ที่เดียวที่กำหนดว่าแอปอยู่ path ไหน
   ```ts
   export const BASE_PATH = "/coffee-cost-report";
   ```
2. **`next.config.ts`** import ค่านี้ไปใส่ `basePath` และ component ทั้ง 3 ไฟล์
   เรียก `apiUrl()` แทนการเขียน `/api/...` ตรงๆ (7 จุด)

> **ถ้าจะย้าย path ทีหลัง** แก้บรรทัดเดียวใน `lib/basePath.ts`
> แล้ว build ใหม่ + แก้ path ใน Apache config ให้ตรงกัน

---

## 1. ติดตั้ง Node.js บน server (ครั้งเดียว)

Next.js 16 ต้องการ Node 20 ขึ้นไป (เครื่อง dev ใช้ 23.11.0)

```bash
node -v   # ถ้ามีอยู่แล้วและ >= 20 ข้ามข้อนี้ได้
```

ถ้ายังไม่มี — ติดตั้ง Node 22 LTS (Ubuntu):
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v
```

---

## 2. วางโค้ดบน server

วางไว้ **นอก** `/var/www/html` เพราะ Apache ไม่ได้เสิร์ฟไฟล์ของแอปนี้โดยตรง
(ทุก request ถูก proxy ไป Node) การวางไว้นอก DocumentRoot ทำให้ไม่ต้อง
เขียน `Require all denied` กัน source แบบที่ทำกับ `/capex/api`

```bash
sudo mkdir -p /var/www/apps
sudo chown ubuntu:ubuntu /var/www/apps
cd /var/www/apps
git clone <URL-ของ-repo> coffee-cost-report
cd coffee-cost-report
```

Build ครั้งแรก:
```bash
npm ci
npm run build
```

> `npm ci` ติดตั้ง devDependencies ด้วย — จำเป็น เพราะ build ต้องใช้
> TypeScript และ Tailwind

---

## 3. โฟลเดอร์ data (ข้อมูลที่ต้องไม่หาย)

แอปเก็บข้อมูลเป็นไฟล์ JSON ที่ `data/` — ทั้งไฟล์ MB51 ที่อัปโหลด,
ค่า STD master และ unit-weight master

```bash
mkdir -p /var/www/apps/coffee-cost-report/data
chown ubuntu:ubuntu /var/www/apps/coffee-cost-report/data
```

- อยู่ใน `.gitignore` แล้ว → `git pull` ไม่ทับ
- **ต้อง backup แยก** ไม่ได้อยู่ใน git
- user ที่รัน service (`ubuntu`) ต้องเขียนได้ ไม่งั้นอัปโหลดจะ error 500

Backup (ใส่ cron รายวันได้):
```bash
tar czf ~/coffee-data-$(date +%F).tar.gz -C /var/www/apps/coffee-cost-report data
```

---

## 4. ตั้ง systemd service

```bash
sudo cp /var/www/apps/coffee-cost-report/deploy/coffee-cost-report.service \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now coffee-cost-report
sudo systemctl status coffee-cost-report
```

ทดสอบว่า Node ตอบจริงก่อนไปต่อ — **ต้องมี prefix ด้วย**:
```bash
curl -I http://127.0.0.1:3001/coffee-cost-report    # ต้องได้ 200
curl -I http://127.0.0.1:3001/                      # ได้ 404 = ถูกต้องแล้ว
```

ดู log:
```bash
sudo journalctl -u coffee-cost-report -f
```

---

## 5. แก้ Apache vhost

เนื้อหาที่ต้องแทรกอยู่ใน [`apache-snippet.conf`](apache-snippet.conf)
นำไปวางใน `<VirtualHost *:443>` ของ `cpr-one.com` ที่มีอยู่แล้ว
(แนะนำวางต่อจาก Alias ของ `/technician_pm/ui`)

```bash
# 1) เปิด module ที่จำเป็น (proxy/proxy_http เปิดอยู่แล้วจาก phpMyAdmin)
sudo a2enmod proxy proxy_http headers

# 2) สำรอง config เดิมก่อนแก้ทุกครั้ง
sudo cp /etc/apache2/sites-available/<ไฟล์-vhost-ของคุณ>.conf \
        /etc/apache2/sites-available/<ไฟล์-vhost-ของคุณ>.conf.bak-$(date +%F)

# 3) แก้ไฟล์ แล้วแทรก snippet
sudo nano /etc/apache2/sites-available/<ไฟล์-vhost-ของคุณ>.conf

# 4) ตรวจ config ก่อน reload เสมอ
sudo apache2ctl configtest

# 5) reload (ไม่ใช่ restart — reload ไม่ตัด connection ที่ค้างอยู่)
sudo systemctl reload apache2
```

> ⚠️ ข้อควรระวัง: การแก้ vhost ไฟล์นี้กระทบ **เว็บหลักและแอปย่อยทุกตัว**
> ถ้า `configtest` ไม่ผ่านแล้วเผลอ reload เว็บทั้งหมดจะล่ม
> — `configtest` ต้องขึ้น `Syntax OK` เท่านั้นจึงค่อย reload
>
> ถ้าต้องการถอนออก: ลบ snippet → `configtest` → `reload`
> ตัว Node service ปิดแยกได้ด้วย `sudo systemctl stop coffee-cost-report`

---

## 6. ทดสอบ

```bash
curl -I https://www.cpr-one.com/coffee-cost-report
```

แล้วเปิดในเบราว์เซอร์ ตรวจ 3 อย่าง:
1. หน้าเว็บมี CSS ครบ (ถ้าหน้าโล่งไม่มีสไตล์ = ProxyPass strip prefix ผิด)
2. อัปโหลดไฟล์ MB51 จริง 1 ไฟล์ได้
3. กดปุ่ม Export แล้วได้ไฟล์ Excel กลับมา

ตรวจว่าแอปย่อยเดิมยังปกติด้วย:
```bash
curl -I https://www.cpr-one.com/capex/api
curl -I https://www.cpr-one.com/technician_pm/ui
```

---

## 7. อัปเดตรอบถัดไป

```bash
/var/www/apps/coffee-cost-report/deploy/update.sh
```

`git pull` → `npm ci` → `npm run build` → `systemctl restart` โดยไม่แตะ `data/`
ระหว่าง restart แอปจะ down ประมาณ 3–5 วินาที (เว็บหลักไม่กระทบ)

---

## ปัญหาที่พบบ่อย

| อาการ | สาเหตุ |
|---|---|
| **หน้าเว็บโหลดแต่ไม่มี CSS/JS** | ProxyPass strip prefix — เช็คว่า **ไม่มี** `/` ปิดท้าย URL ทั้งสองฝั่ง |
| `502 Bad Gateway` | Node ไม่ได้รัน — `sudo systemctl status coffee-cost-report` |
| `503 Service Unavailable` | Apache ไม่ได้เปิด `proxy_http` — `sudo a2enmod proxy_http` |
| `404` ทุกหน้า | `basePath` ใน `lib/basePath.ts` ไม่ตรงกับ path ใน Apache |
| อัปโหลดแล้ว error 500 | `data/` เขียนไม่ได้ — เช็ค owner เป็น `ubuntu` |
| อัปโหลดไฟล์ใหญ่แล้วค้าง | เพิ่ม `timeout=` ใน ProxyPass และเช็ค `LimitRequestBody` |

---

## ⚠️ ข้อควรรู้: ตอนนี้แอปยังไม่มีระบบ login

แอปไม่มี auth layer เลย (ไม่มี `middleware.ts` ไม่มี session)
เมื่อขึ้น production แล้ว **ใครก็ตามที่รู้ URL จะเปิดดูข้อมูลต้นทุนการผลิต
ทั้งหมด และอัปโหลดทับข้อมูลได้** — และ path นี้อยู่บนโดเมนหลักที่คนรู้จัก
อยู่แล้ว จึงมีโอกาสถูกเดา/ถูก index มากกว่า subdomain แยก

ถ้าต้องการปิดกั้นทีหลัง — เพิ่มใน `<Location /coffee-cost-report>` ที่มีอยู่แล้ว
โดยไม่ต้องแก้โค้ดแอป:

```apache
        AuthType Basic
        AuthName "Coffee Cost Report"
        AuthUserFile /etc/apache2/.htpasswd-coffee
        Require valid-user
```
แล้วสร้าง user (แทนที่บรรทัด `Require all granted` เดิม):
```bash
sudo htpasswd -c /etc/apache2/.htpasswd-coffee accounting
sudo apache2ctl configtest && sudo systemctl reload apache2
```

หรือจำกัดด้วย IP ภายในบริษัท — แทนที่ `Require all granted` ด้วย:
```apache
        Require ip 10.0.0.0/8 192.168.0.0/16
```
