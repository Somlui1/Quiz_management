# 🛡️ Quizmaster Pro — สรุปเทคโนโลยีและความปลอดภัย

## เทคโนโลยีที่ใช้ (Technology Stack)

| ส่วน | เทคโนโลยี | ทำหน้าที่ |
|------|-----------|----------|
| **Frontend** | React 19, TypeScript, TailwindCSS v4 | หน้าเว็บ SPA สำหรับแอดมินและผู้สอบ |
| **Backend** | Node.js 20, Express 4 | API Server + เสิร์ฟหน้าเว็บ |
| **Database** | SQLite (`better-sqlite3`) | ฐานข้อมูลแบบไฟล์ แยกต่อห้องสอบ |
| **Auth** | JWT (`jsonwebtoken`) + `bcryptjs` | ลงรหัส Token + แฮชรหัสผ่าน |
| **Reverse Proxy** | NGINX | Rate Limiting + ส่งต่อ Traffic |
| **Deployment** | Docker Compose (3 containers) | App + NGINX + ngrok tunnel |
| **Real-time** | Server-Sent Events (SSE) | Live Dashboard ติดตามผู้สอบ |

---

## สถาปัตยกรรมการ Deploy (Deployment Architecture)

```mermaid
graph LR
    User["🌐 ผู้ใช้งาน (Browser)"] -->|"Port 3344"| NGINX["🛡️ NGINX\nRate Limiting\nReverse Proxy"]
    NGINX -->|"Proxy Pass"| APP["🖥️ Node.js + Express\nAPI Server\nPort 3000 (internal)"]
    APP -->|"Read/Write"| DB["💾 SQLite\nmaster.db\ncampaign_*.db"]
    APP -->|"ตรวจสอบพนักงาน"| ESS["🏢 ESS Aapico API\n(ess.aapico.com)"]

    style NGINX fill:#f97316,stroke:#000,color:#fff
    style APP fill:#3b82f6,stroke:#000,color:#fff
    style DB fill:#22c55e,stroke:#000,color:#fff
    style ESS fill:#8b5cf6,stroke:#000,color:#fff
```

---

## ระบบความปลอดภัย 4 ชั้น (Layered Security)

```mermaid
graph TD
    subgraph "ชั้นที่ 1 — Network Layer (NGINX)"
        A["🛡️ Rate Limiting\nLogin: 5 req/s | สอบ: 15 req/s ต่อ IP"]
    end
    subgraph "ชั้นที่ 2 — Authentication Layer (JWT)"
        B["🔐 Admin JWT → isAdmin: true\n🎓 Student JWT → type: student"]
    end
    subgraph "ชั้นที่ 3 — Identity Enforcement"
        C["🔍 ตรวจสอบว่า employeeId ใน Token\nตรงกับ userIdentifier ใน Request"]
    end
    subgraph "ชั้นที่ 4 — Data Protection"
        D["🔒 bcrypt แฮชรหัสผ่าน\n📋 Parameterized SQL ป้องกัน Injection\n🚫 ตัดเฉลยก่อนส่งข้อสอบให้ผู้สอบ"]
    end

    A --> B --> C --> D

    style A fill:#ef4444,stroke:#000,color:#fff
    style B fill:#f97316,stroke:#000,color:#fff
    style C fill:#eab308,stroke:#000,color:#000
    style D fill:#22c55e,stroke:#000,color:#fff
```

---

## การไหลของข้อมูลขณะทำข้อสอบ (Exam Data Flow)

```mermaid
sequenceDiagram
    participant S as 📱 ผู้สอบ
    participant N as 🛡️ NGINX
    participant API as 🖥️ Express Server
    participant DB as 💾 SQLite
    participant ESS as 🏢 ESS API
    participant Admin as 📊 Live Dashboard

    S->>N: 1. Login (รหัสพนักงาน + รหัสผ่าน)
    N->>API: Rate Limit ✓ → Forward
    API->>ESS: ยืนยันตัวตนกับระบบ ESS
    ESS-->>API: ข้อมูลพนักงาน ✓
    API->>API: ออก Student JWT (sign ด้วย JWT_SECRET)
    API-->>S: JWT Token + ข้อมูลพนักงาน

    S->>N: 2. เริ่มทำข้อสอบ [Bearer JWT]
    N->>API: Forward
    API->>API: ตรวจ JWT + ตรวจ Identity Match
    API->>DB: ดึงข้อสอบ → สุ่ม → ตัดเฉลย
    API->>DB: บันทึก Attempt (เก็บเฉลยไว้ฝั่ง Server)
    API-->>S: ข้อสอบ (ไม่มีเฉลย)
    API->>Admin: SSE → "ผู้สอบเข้าห้องสอบแล้ว"

    S->>N: 3. ส่งคำตอบ [Bearer JWT]
    N->>API: Forward
    API->>API: ตรวจ JWT + Identity Match
    API->>DB: ดึงเฉลยจาก Attempts → ตรวจให้คะแนน
    API->>DB: บันทึกผลสอบ (Submissions)
    API->>Admin: SSE → "ผู้สอบส่งข้อสอบแล้ว (ผ่าน/ไม่ผ่าน)"
    API-->>S: ผลคะแนน
```

---

## JWT คืออะไร? (JSON Web Token)

**JWT (JSON Web Token)** คือมาตรฐานเปิด (RFC 7519) สำหรับส่งข้อมูลยืนยันตัวตนระหว่าง Client กับ Server อย่างปลอดภัย โดยข้อมูลจะถูก **เข้ารหัสดิจิทัล (Digitally Signed)** ด้วยคีย์ลับ (`JWT_SECRET`) ทำให้ไม่สามารถปลอมแปลงหรือแก้ไขเนื้อหาได้

### โครงสร้างของ JWT Token

```
eyJhbGciOiJIUzI1NiJ9.eyJlbXBsb3llZUlkIjoiQUgxMDAwMjg5OCIsInR5cGUiOiJzdHVkZW50In0.xxxSIGNATURExxx
├─── Header ────┤├────────────────── Payload ──────────────────────────┤├── Signature ──┤
```

| ส่วน | คืออะไร | ตัวอย่างในระบบนี้ |
|------|---------|------------------|
| **Header** | ระบุอัลกอริทึมที่ใช้เข้ารหัส | `{"alg": "HS256"}` |
| **Payload** | ข้อมูลตัวตนที่ฝังไว้ใน Token | `{"employeeId": "AH10002898", "type": "student"}` |
| **Signature** | ลายเซ็นดิจิทัล ป้องกันการปลอมแปลง | `HMACSHA256(header.payload, JWT_SECRET)` |

### วิธีการทำงานในระบบ Quizmaster Pro

```mermaid
sequenceDiagram
    participant User as 📱 ผู้ใช้
    participant Server as 🖥️ Server

    User->>Server: 1. Login (username + password)
    Server->>Server: 2. ตรวจสอบรหัสผ่านถูกต้อง
    Server->>Server: 3. สร้าง JWT Token (sign ด้วย JWT_SECRET)
    Server-->>User: 4. ส่ง Token กลับ → เก็บไว้ใน Browser

    User->>Server: 5. เรียก API พร้อมแนบ Header "Authorization: Bearer eyJ..."
    Server->>Server: 6. jwt.verify(token, JWT_SECRET)
    alt Token ถูกต้อง
        Server-->>User: ✅ อนุญาตให้เข้าถึง
    else Token ผิด/หมดอายุ
        Server-->>User: ❌ 401 Unauthorized
    end
```

> **ทำไมถึงใช้ JWT?** — เพราะเป็นแบบ Stateless คือ Server ไม่ต้องเก็บ Session ไว้ใน Memory หรือ Database เลย แค่เอา Token ที่ Client ส่งมาถอดรหัสดูก็รู้ว่าเป็นใคร ทำให้ระบบรองรับผู้สอบจำนวนมากได้โดยไม่หนัก

---

## Docker Network คืออะไร?

**Docker Network** คือเครือข่ายเสมือน (Virtual Network) ที่ Docker สร้างขึ้นเพื่อให้ Container ต่างๆ สามารถสื่อสารกันได้ภายใน โดยไม่ต้องเปิดเผยพอร์ตออกสู่ภายนอก

ในระบบนี้ใช้เครือข่ายชื่อ `quiz-network` แบบ Bridge Mode ซึ่งหมายความว่า Container ทั้ง 3 ตัว (NGINX, App, ngrok) อยู่ใน "ห้องเดียวกัน" สามารถเรียกกันด้วยชื่อ Container (เช่น `app:3000` หรือ `nginx:80`) ได้โดยตรง

### แผนผัง Docker Network

```mermaid
graph TB
    subgraph "🌐 ภายนอก (Internet)"
        Browser["👤 ผู้ใช้งาน"]
    end

    subgraph "🐳 Docker Network: quiz-network (Bridge Mode)"
        direction TB
        NGINX["🛡️ quizmaster-nginx\nnginx:alpine\nPort 80\n\nรับ Traffic จากภายนอก\nRate Limiting\nProxy Pass ไปที่ app:3000"]
        APP["🖥️ quizmaster-app\nnode:20-bullseye-slim\nPort 3000 (expose only)\n\nExpress API Server\nSQLite Database"]
        NGROK["🔗 ngrok_tunnel\nngrok/ngrok\n\nสร้าง Public URL\nเชื่อมไปที่ nginx:80"]
    end

    Browser -->|"Port 3344\n(Direct Access)"| NGINX
    Browser -->|"*.ngrok-free.app\n(Public Tunnel)"| NGROK
    NGROK -->|"Internal: nginx:80"| NGINX
    NGINX -->|"Internal: app:3000"| APP

    style NGINX fill:#f97316,stroke:#000,color:#fff
    style APP fill:#3b82f6,stroke:#000,color:#fff
    style NGROK fill:#8b5cf6,stroke:#000,color:#fff
```

### จุดสำคัญ

| ข้อ | รายละเอียด |
|-----|-----------|
| **App ไม่เปิดพอร์ตออกภายนอก** | ใช้ `expose: 3000` แทน `ports: 3344:3000` หมายความว่าผู้ใช้จากภายนอก **ไม่สามารถ** ยิง API ตรงไปที่ Node.js ได้เลย ต้องผ่าน NGINX เท่านั้น |
| **Container เรียกกันด้วยชื่อ** | NGINX เรียก `app:3000` ได้ตรงๆ, ngrok เรียก `nginx:80` ได้ตรงๆ โดยไม่ต้องรู้ IP Address |
| **แยก Network = แยกปลอดภัย** | หากมี Container อื่นที่ไม่ได้อยู่ใน `quiz-network` จะไม่สามารถเข้าถึง App หรือฐานข้อมูลได้ |

---

## NGINX คืออะไร? และทำงานอย่างไร?

**NGINX** (อ่านว่า "เอ็นจิน-เอ็กซ์") คือซอฟต์แวร์ **Reverse Proxy / Web Server** ที่มีประสิทธิภาพสูง ใช้กันอย่างแพร่หลายในระดับองค์กรทั่วโลก ในโปรเจกต์นี้ NGINX ทำหน้าที่เป็น **"ยามรักษาความปลอดภัย"** ที่ยืนอยู่หน้า Node.js Server

### หน้าที่ของ NGINX ในระบบนี้

```mermaid
graph LR
    subgraph "ผู้ใช้ส่ง Request เข้ามา"
        R1["POST /api/auth\n(Login)"]
        R2["POST /api/campaigns/.../submit\n(ส่งข้อสอบ)"]
        R3["GET /\n(โหลดหน้าเว็บ)"]
    end

    subgraph "🛡️ NGINX ทำหน้าที่"
        CHECK1["1. Rate Limit Check\nLogin ≤ 5 req/s\nสอบ ≤ 15 req/s"]
        CHECK2["2. Proxy Pass\nส่งต่อไปที่ app:3000"]
    end

    subgraph "🖥️ Node.js App"
        APP["Express Server\nประมวลผลจริง"]
    end

    R1 --> CHECK1
    R2 --> CHECK1
    R3 --> CHECK1
    CHECK1 -->|"ผ่าน ✅"| CHECK2
    CHECK1 -->|"เกิน Limit ❌"| BLOCK["503 Service Unavailable"]
    CHECK2 --> APP
```

### ทำไมต้องใช้ NGINX? ไม่ให้ Node.js รับ Traffic ตรงๆ ได้เหรอ?

| ปัญหาถ้าไม่มี NGINX | NGINX ช่วยแก้ปัญหา |
|---------------------|-------------------|
| บอทยิง Login ล้านครั้ง → Node.js ล่ม | NGINX ตัดทิ้ง ≤ 5 req/s ต่อ IP |
| บอทยิง API ส่งข้อสอบปลอม → RAM เต็ม | NGINX จำกัดไว้ ≤ 15 req/s ต่อ IP |
| Node.js ต้องจัดการ Static files เอง → ช้า | NGINX เสิร์ฟ Static files ได้เร็วกว่า |
| ไม่มีตัวกลาง → ผู้โจมตีรู้ IP/Port จริงของ App | NGINX ซ่อน App ไว้ข้างหลัง เข้าถึงตรงไม่ได้ |

---

## Server-Sent Events (SSE) คืออะไร?

**SSE (Server-Sent Events)** คือเทคโนโลยีมาตรฐานของเว็บ (W3C Standard) ที่ช่วยให้ Server สามารถ **ผลักดันข้อมูล (Push)** ไปยัง Browser ได้แบบ **Real-time** โดยไม่ต้องให้ Browser คอยถามซ้ำๆ (Polling)

### SSE vs Polling — ทำไม SSE ดีกว่า?

```mermaid
sequenceDiagram
    participant B as 📱 Browser
    participant S as 🖥️ Server

    Note over B,S: ❌ แบบเดิม (Polling) — Browser ถามซ้ำทุก 3 วินาที
    loop ทุก 3 วินาที
        B->>S: มีข้อมูลใหม่ไหม?
        S-->>B: ไม่มี (เปลืองทรัพยากร)
    end

    Note over B,S: ✅ แบบ SSE — Server บอกเองเมื่อมีข้อมูลใหม่
    B->>S: เปิดการเชื่อมต่อ SSE (ครั้งเดียว)
    S-->>B: เชื่อมต่อแล้ว ✓
    Note over S: (เงียบ... รอจนมีข้อมูลจริง)
    S-->>B: 🔔 "นาย A เข้าห้องสอบแล้ว"
    Note over S: (เงียบ... รอจนมีข้อมูลจริง)
    S-->>B: 🔔 "นาย A ส่งข้อสอบแล้ว — ผ่าน 85%"
```

### SSE ถูกใช้ที่ไหนในระบบนี้?

Admin เปิดหน้า **Live Dashboard** (CampaignAnalytics) ระบบจะเชื่อมต่อ SSE ไปที่ `GET /api/campaigns/{id}/live` ทันที จากนั้น Server จะผลักดัน 3 ประเภท Event มาให้อัตโนมัติ:

| Event Type | เมื่อไหร่ | ข้อมูลที่ได้ |
|-----------|----------|-------------|
| `join` | พนักงานเข้าห้องสอบ | ชื่อ, รหัสพนักงาน, แผนก |
| `submission` | พนักงานส่งข้อสอบ | คะแนน, ผ่าน/ไม่ผ่าน, เวลาที่ใช้ |
| `reset` | แอดมินรีเซ็ตห้องสอบ | ล้างข้อมูลทั้งหมดบนหน้าจอ |

> **ข้อดีของ SSE**: ประหยัดทรัพยากรกว่า WebSocket (ใช้ HTTP ธรรมดา ไม่ต้องติดตั้งอะไรเพิ่ม) และรองรับ Browser ทุกตัวรวมถึงมือถือ

---

## สรุปสั้นๆ

> **เทคโนโลยี**: React + Node.js + SQLite + Docker + NGINX
>
> **ความปลอดภัย**: ป้องกัน 4 ชั้น ตั้งแต่ Network (Rate Limit) → Authentication (JWT) → Identity Enforcement (ตรวจรหัสพนักงาน) → Data Protection (แฮชรหัสผ่าน + ตัดเฉลยข้อสอบ)
>
> **ผลลัพธ์**: ผู้ไม่หวังดีไม่สามารถสวมรอย, สุ่มรหัสผ่าน, โกงข้อสอบ หรือยิงถล่มเซิร์ฟเวอร์ได้

