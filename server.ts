import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "aapico-smart-eval-secret-key-2026";

// Create database directory if it doesn't exist
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize Master Database
const masterDbPath = path.join(dataDir, "master.db");
let masterDb = new Database(masterDbPath);
masterDb.pragma("journal_mode = WAL");

masterDb.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    status TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    passing_percentage INTEGER NOT NULL,
    time_limit_minutes INTEGER NOT NULL,
    questions_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// Initialize Admins Table and Seed Default Admin Accounts
masterDb.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username_or_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    type TEXT NOT NULL, -- 'system' or 'ess'
    password TEXT, -- hashed or plain text password for system admins
    role TEXT NOT NULL DEFAULT 'admin', -- 'super_admin' or 'admin'
    created_at TEXT NOT NULL
  )
`);

try {
  const adminCountRow = masterDb.prepare("SELECT COUNT(*) as count FROM admins").get() as { count: number } | undefined;
  if (adminCountRow && adminCountRow.count === 0) {
    const insertAdmin = masterDb.prepare(`
      INSERT OR IGNORE INTO admins (id, username_or_id, name, department, type, password, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // 1. Seed the default ESS admin account AH10002898
    insertAdmin.run(
      "ess_wajeepradit",
      "AH10002898",
      "วจีประดิษฐ์ พรมพันธุ์",
      "IT-96-Indirect (แผนกไอที)",
      "ess",
      null,
      "admin",
      new Date().toISOString()
    );

    // 2. Pre-create one (1) default System Account with username/password ready for login (safely hashed with bcrypt)
    const seededHash = bcrypt.hashSync("admin123", 10);
    insertAdmin.run(
      "sys_admin",
      "admin",
      "System Administrator",
      "IT Administration",
      "system",
      seededHash,
      "super_admin",
      new Date().toISOString()
    );
    console.log("Seeded default administrator accounts successfully with secure hashing.");
  }
} catch (err) {
  console.error("Error seeding default administrator accounts:", err);
}


// Safe migration for existing installations to add total_questions_to_test column
try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN total_questions_to_test INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists
}

// Safe migration for existing installations to add max_attempts column
try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN max_attempts INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists
}

// Safe migration for existing installations to add results_display_mode column
try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN results_display_mode TEXT DEFAULT 'full'");
} catch (e) {
  // Column already exists
}

// Safe migration for existing installations to add is_untimed column
try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN is_untimed INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists
}

// Safe migration for existing installations to add randomization_mode column
try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN randomization_mode TEXT DEFAULT 'static'");
} catch (e) {
  // Column already exists
}

// Safe migration for existing installations to add updated_at column
try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN updated_at TEXT");
} catch (e) {
  // Column already exists
}

// Create central questions table
masterDb.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT,
    category TEXT NOT NULL DEFAULT '',
    difficulty TEXT NOT NULL DEFAULT ''
  )
`);

// Add migrations for campaigns table to support manual/rule-based selections
try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN question_selection_mode TEXT DEFAULT 'manual'");
} catch (e) {}

try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN manual_question_ids_json TEXT DEFAULT '[]'");
} catch (e) {}

try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN rule_category TEXT DEFAULT ''");
} catch (e) {}

try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN rule_difficulty TEXT DEFAULT 'all'");
} catch (e) {}

try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN rule_count INTEGER DEFAULT 0");
} catch (e) {}

try {
  masterDb.exec("ALTER TABLE questions ADD COLUMN booklet TEXT DEFAULT ''");
} catch (e) {}

try {
  masterDb.exec("ALTER TABLE campaigns ADD COLUMN target_booklet TEXT DEFAULT ''");
} catch (e) {}

// Create exam_packets table
masterDb.exec(`
  CREATE TABLE IF NOT EXISTS exam_packets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  )
`);

try {
  masterDb.exec("ALTER TABLE questions ADD COLUMN packet_id TEXT DEFAULT ''");
} catch (e) {}

// Seed default exam packet, questions, and active campaign
try {
  // Clear existing packets, questions, and campaigns to fulfill requirement: "จัดชุดของให้เหลือเเค่ชุด เดียว พร้อมตั้งห้องสอบให้ข้อสอบชุดนี้"
  masterDb.prepare("DELETE FROM exam_packets").run();
  masterDb.prepare("DELETE FROM questions").run();
  masterDb.prepare("DELETE FROM campaigns").run();

  const insertP = masterDb.prepare("INSERT INTO exam_packets (id, name, created_at) VALUES (?, ?, ?)");
  insertP.run("p_m365", "ชุดข้อสอบ Microsoft 365 & Copilot", new Date().toISOString());

  const questionsToSeed = [
    {
      id: "m365_q1",
      text: "Microsoft Office 365 มีลักษณะการให้บริการแบบใด?",
      options: ["บริการระบบคลาวด์แบบสมัครสมาชิก", "ซอฟต์แวร์ซื้อขาดติดตั้งครั้งเดียว", "ฮาร์ดแวร์เซิร์ฟเวอร์ภายในองค์กร", "แอปพลิเคชันฟรีแบบโอเพนซอร์ส"],
      correctIndex: 0,
      explanation: "Microsoft 365 (เดิมคือ Office 365) เป็นบริการระบบคลาวด์แบบสมัครสมาชิกจาก Microsoft ที่รวมแอปพลิเคชันชั้นนำและทำงานร่วมกันได้จากทุกอุปกรณ์",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q2",
      text: "แนวคิดหลัก \"Copilot ≠ Autopilot\" สื่อถึงสิ่งใด?",
      options: ["คนยังเป็นกัปตันที่ตรวจสอบและตัดสินใจ", "Copilot ทำงานแทนคนได้ทั้งหมดโดยอัตโนมัติ", "ต้องใช้ Copilot คู่กับระบบขับเคลื่อนอัตโนมัติ", "Copilot ใช้ได้เฉพาะผู้ดูแลระบบเท่านั้น"],
      correctIndex: 0,
      explanation: "Copilot ช่วยสร้างร่างงานและวิเคราะห์ แต่คนยังเป็นกัปตันที่ตรวจสอบและตัดสินใจ ไม่ใช่ระบบที่ทำงานแทนทั้งหมด",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q3",
      text: "Microsoft 365 Copilot ทำงานในลักษณะใด?",
      options: ["เป็นผู้ช่วยในแอปที่ใช้ทุกวัน ไม่ใช่ Chatbot แยกต่างหาก", "เป็นแอปพลิเคชันแยกที่ต้องเปิดต่างหากเสมอ", "เป็นเว็บไซต์ที่ต้องเข้าผ่านเบราว์เซอร์เท่านั้น", "เป็นอุปกรณ์ฮาร์ดแวร์เสริม"],
      correctIndex: 0,
      explanation: "Copilot ไม่ใช่ Chatbot แยกต่างหาก แต่เป็น \"Copilot\" ที่ฝังอยู่ในแอปที่ใช้ทุกวัน",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q4",
      text: "ในด้านความปลอดภัยของข้อมูล Copilot มีหลักการอย่างไร?",
      options: ["ใช้เฉพาะข้อมูลที่มีสิทธิ์เข้าถึงและไม่ถูกนำไปเทรนโมเดลสาธารณะ", "แชร์ข้อมูลทั้งหมดให้โมเดลสาธารณะเพื่อพัฒนา", "เข้าถึงไฟล์ทุกไฟล์ในองค์กรได้โดยไม่จำกัดสิทธิ์", "เก็บ Prompt ไว้บนเซิร์ฟเวอร์สาธารณะ"],
      correctIndex: 0,
      explanation: "ข้อมูลและ Prompt อยู่ภายใต้ขอบเขตความปลอดภัยขององค์กร ใช้เฉพาะข้อมูลที่มีสิทธิ์เข้าถึง และไม่ถูกนำไปเทรนโมเดลสาธารณะ",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q5",
      text: "แอปพลิเคชันของ Microsoft 365 ในกลุ่มที่ 1 (เครื่องมือทำงานทั่วไป) ประกอบด้วยอะไรบ้าง?",
      options: ["Excel, Word, PowerPoint, OneNote", "Outlook, Teams, OneDrive, SharePoint", "Word, Outlook, Teams, OneDrive", "Excel, Teams, OneNote, OneDrive"],
      correctIndex: 0,
      explanation: "กลุ่มที่ 1 OFFICE เป็นเครื่องมือสำหรับงานทั่วไป ได้แก่ Excel, Word, PowerPoint และ OneNote",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q6",
      text: "ในโครงสร้างของ Excel \"เซลล์ (Cell)\" หมายถึงอะไร?",
      options: ["จุดตัดของแถวและคอลัมน์ เช่น B2", "แนวตั้งทั้งหมดของตาราง", "แนวนอนทั้งหมดของตาราง", "ชื่อของชีตงาน"],
      correctIndex: 0,
      explanation: "เซลล์ (Cell) คือจุดตัดของแถว (Row) และคอลัมน์ (Column) เช่น B2",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q7",
      text: "ฟีเจอร์ Flash Fill ใน Excel ใช้ทำสิ่งใด?",
      options: ["เติมข้อมูลอัตโนมัติตามรูปแบบที่พิมพ์เป็นตัวอย่าง", "สร้างกราฟและแดชบอร์ดอัตโนมัติ", "เฝ้าดูค่าของเซลล์จากหลายชีต", "ป้องกันไฟล์ด้วยรหัสผ่าน"],
      correctIndex: 0,
      explanation: "Flash Fill ตรวจจับรูปแบบจากตัวอย่างที่พิมพ์ แล้วเติมข้อมูลที่เหลือทั้งคอลัมน์ให้อัตโนมัติ โดยไม่ต้องเขียนสูตร",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q8",
      text: "ปุ่มลัดใดใช้สั่งให้ Flash Fill เติมข้อมูลทั้งคอลัมน์ทันที?",
      options: ["Ctrl + E", "Ctrl + N", "Ctrl + S", "Ctrl + P"],
      correctIndex: 0,
      explanation: "กด Ctrl + E เพื่อให้ Excel เติมข้อมูลที่เหลือทั้งคอลัมน์ด้วย Flash Fill ทันที",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q9",
      text: "ฟีเจอร์ Watch Window ใน Excel มีประโยชน์อย่างไร?",
      options: ["เฝ้าดูค่าของเซลล์สำคัญจากทุกชีตได้ในหน้าต่างเดียว", "แก้ไขค่าของเซลล์จากหลายไฟล์พร้อมกัน", "แปลงข้อมูลเป็นกราฟอัตโนมัติ", "ล็อกเซลล์ไม่ให้ผู้อื่นแก้ไข"],
      correctIndex: 0,
      explanation: "Watch Window ช่วยเฝ้าดูค่าและสูตรของเซลล์สำคัญจากทุกชีตแบบเรียลไทม์ในหน้าต่างเดียว แต่ใช้ดูค่าเท่านั้น แก้ไขไม่ได้",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q10",
      text: "ฟีเจอร์ Compare Documents ใน Word ทำหน้าที่ใด?",
      options: ["เปรียบเทียบเอกสารสองฉบับเพื่อดูความแตกต่าง", "รวมเอกสารหลายไฟล์เป็นไฟล์เดียว", "แปลงเอกสารเป็นไฟล์ PDF", "ตรวจสอบการสะกดคำอัตโนมัติ"],
      correctIndex: 0,
      explanation: "Compare Documents เปรียบเทียบไฟล์ต้นฉบับกับฉบับแก้ไขแบบคำต่อคำ แล้วสร้างเอกสารใหม่แสดงความต่างผ่านมุมมอง Track Changes",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q11",
      text: "เมื่อใช้ Compare Documents ใน Word ผลลัพธ์จะแสดงในรูปแบบใด?",
      options: ["เอกสารฉบับใหม่ที่แสดงความต่างแบบ Track Changes", "เขียนทับไฟล์ต้นฉบับทันที", "ไฟล์ Excel สรุปความแตกต่าง", "อีเมลแจ้งเตือนผู้เขียน"],
      correctIndex: 0,
      explanation: "ระบบสร้างเอกสารฉบับที่ 3 ขึ้นใหม่เพื่อไม่ให้กระทบไฟล์เดิม และแสดงความแตกต่างทั้งหมดผ่านมุมมอง Track Changes",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q12",
      text: "ฟีเจอร์ Design Suggestions (Designer) ใน PowerPoint ช่วยเรื่องใด?",
      options: ["ช่วยออกแบบและจัดวางสไลด์ให้สวยงามโดยอัตโนมัติ", "แปลภาษาข้อความในสไลด์", "บันทึกเสียงบรรยายอัตโนมัติ", "บีบอัดขนาดไฟล์งานนำเสนอ"],
      correctIndex: 0,
      explanation: "Design Suggestions ให้ PowerPoint ช่วยแนะนำการจัดวางและออกแบบสไลด์ให้สวยงามอัตโนมัติในไม่กี่วินาที ผ่านแถบ Designer",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q13",
      text: "ฟีเจอร์ Reuse Slides ใน PowerPoint ทำสิ่งใด?",
      options: ["นำสไลด์จากไฟล์งานนำเสนออื่นมาใช้ซ้ำได้ทันที", "ทำซ้ำสไลด์เดิมภายในไฟล์เดียว", "ล้างการจัดรูปแบบของสไลด์", "แปลงสไลด์เป็นวิดีโอ"],
      correctIndex: 0,
      explanation: "Reuse Slides ช่วยนำสไลด์จากไฟล์งานนำเสนออื่นมาใช้ซ้ำได้ทันที โดยเลือกติ๊ก Keep source formatting เพื่อคงดีไซน์เดิมได้",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q14",
      text: "OneNote จัดโครงสร้างการบันทึกในรูปแบบใด?",
      options: ["สมุด (Notebook) → หมวดหมู่ (Section) → หน้า (Page)", "โฟลเดอร์ → ไฟล์ → ชีต", "ทีม → ช่อง → ข้อความ", "ไดรฟ์ → โฟลเดอร์ → ลิงก์"],
      correctIndex: 0,
      explanation: "OneNote จัดโครงสร้างแบบยืดหยุ่นโดยแบ่งเป็นสมุด (Notebook), หมวดหมู่ (Section) และหน้า (Page)",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q15",
      text: "ฟีเจอร์ Search Across Notebooks ใน OneNote ทำอะไรได้?",
      options: ["ค้นหาข้อมูลข้ามทุกสมุดบันทึกได้ในคลิกเดียว", "แปลงบันทึกเป็นไฟล์ PDF", "ซิงค์บันทึกกับ Excel", "ล็อกสมุดบันทึกด้วยรหัสผ่าน"],
      correctIndex: 0,
      explanation: "Search Across Notebooks ช่วยค้นหาคำสำคัญข้ามทุกสมุดบันทึกพร้อมกัน โดยเลือกขอบเขตเป็น All Notebooks",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q16",
      text: "แอปในกลุ่มที่ 2 (อีเมลและการประสานงานหลัก) คือแอปใด?",
      options: ["Outlook และ Teams", "Excel และ Word", "OneNote และ OneDrive", "PowerPoint และ Excel"],
      correctIndex: 0,
      explanation: "กลุ่มที่ 2 เป็นแอปสำหรับอีเมลและการประสานงานหลัก ได้แก่ Outlook และ Microsoft Teams",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q17",
      text: "ฟีเจอร์ Focused Inbox ใน Outlook ทำหน้าที่ใด?",
      options: ["แยกอีเมลสำคัญออกจากอีเมลทั่วไปโดยอัตโนมัติ", "ลบอีเมลขยะทิ้งถาวรทันที", "แปลอีเมลเป็นภาษาอื่น", "เข้ารหัสอีเมลทุกฉบับ"],
      correctIndex: 0,
      explanation: "Focused Inbox ช่วยให้ Outlook แยกอีเมลสำคัญออกจากอีเมลทั่วไปโดยอัตโนมัติ",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q18",
      text: "\"ผู้ช่วยจัดตารางเวลา (Scheduling Assistant)\" ใน Outlook ใช้ทำสิ่งใด?",
      options: ["ดูช่วงเวลาที่ผู้เข้าร่วมทุกคนว่างตรงกัน", "ตอบอีเมลอัตโนมัติแทนผู้ใช้", "จัดเรียงอีเมลตามหมวดหมู่สี", "บันทึกการประชุมเป็นข้อความ"],
      correctIndex: 0,
      explanation: "Scheduling Assistant ช่วยตรวจสอบเวลาว่างของผู้เข้าร่วม เพื่อหาช่วงเวลาที่ทุกคนว่างตรงกันในการนัดประชุม",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q19",
      text: "ใน Microsoft Teams การจัดกลุ่มการทำงานตามโครงการหรือแผนกใช้สิ่งใด?",
      options: ["ทีม (Teams) และช่อง (Channels)", "โฟลเดอร์และไฟล์", "สมุดและหน้า", "ป้ายและหมวดหมู่สี"],
      correctIndex: 0,
      explanation: "Teams จัดกลุ่มการทำงานเป็นทีม (Team) และแบ่งช่อง (Channel) ตามโครงการ แผนก หรือหัวข้องาน",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    },
    {
      id: "m365_q20",
      text: "ฟีเจอร์ Version History ใน OneDrive มีประโยชน์อย่างไร?",
      options: ["ย้อนดูและกู้คืนไฟล์เวอร์ชันก่อนหน้าได้ทุกเมื่อ", "ลบไฟล์เก่าทิ้งอัตโนมัติเพื่อประหยัดพื้นที่", "แปลงไฟล์เป็นรูปแบบอื่น", "จำกัดจำนวนคนที่แก้ไขไฟล์"],
      correctIndex: 0,
      explanation: "Version History ช่วยแสดงเวอร์ชันย้อนหลังพร้อมวันที่ เวลา และผู้แก้ไข ทำให้เปรียบเทียบและกู้คืนไฟล์เวอร์ชันก่อนหน้าได้ทุกเมื่อ",
      packetId: "p_m365",
      booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
    }
  ];

  const insertQ = masterDb.prepare(`
    INSERT INTO questions (id, text, options_json, correct_index, explanation, packet_id, booklet)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const q of questionsToSeed) {
    insertQ.run(q.id, q.text, JSON.stringify(q.options), q.correctIndex, q.explanation, q.packetId, q.booklet);
  }

  // Insert active campaign (room)
  const insertStmt = masterDb.prepare(`
    INSERT OR REPLACE INTO campaigns (
      id, name, group_name, status, start_time, end_time, passing_percentage, 
      time_limit_minutes, total_questions_to_test, max_attempts, results_display_mode, 
      randomization_mode, questions_json, question_selection_mode, manual_question_ids_json, 
      rule_category, rule_difficulty, rule_count, target_booklet, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    "demo-quiz",
    "ห้องสอบ Microsoft 365 & Copilot",
    "ห้องสอบพนักงาน (Employee Exam)",
    "ACTIVE",
    null,
    null,
    60,
    20,
    20,
    3,
    "full",
    "static",
    JSON.stringify(questionsToSeed.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation
    }))),
    "manual",
    JSON.stringify(questionsToSeed.map(q => q.id)),
    "",
    "all",
    0,
    "ชุดข้อสอบ Microsoft 365 & Copilot",
    new Date().toISOString(),
    new Date().toISOString()
  );

  console.log("Database initialized successfully with exactly 1 Microsoft 365 & Copilot packet and 1 Active Campaign room.");
} catch (err) {
  console.error("Error initializing Microsoft 365 database seed:", err);
}

// Cache of campaign-specific database connections
const campaignDbs = new Map<string, Database.Database>();
const liveClients = new Map<string, any[]>();
const activeParticipants = new Map<string, Map<string, any>>();

// Stress-test simulation timeouts tracking to allow 100% reliable aborts
const activeStressTestTimeouts = new Map<string, Set<any>>();

function clearCampaignStressTest(campaignId: string) {
  const timeouts = activeStressTestTimeouts.get(campaignId);
  if (timeouts) {
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    timeouts.clear();
  }
}

function scheduleCampaignStressTestTimeout(campaignId: string, fn: () => void, delay: number) {
  if (!activeStressTestTimeouts.has(campaignId)) {
    activeStressTestTimeouts.set(campaignId, new Set());
  }
  const timeouts = activeStressTestTimeouts.get(campaignId)!;
  const timeoutId = setTimeout(() => {
    timeouts.delete(timeoutId);
    fn();
  }, delay);
  timeouts.add(timeoutId);
  return timeoutId;
}

function getCampaignDb(campaignId: string): Database.Database {
  // Validate campaignId to prevent directory traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(campaignId)) {
    throw new Error("Invalid campaign ID format");
  }

  if (campaignDbs.has(campaignId)) {
    return campaignDbs.get(campaignId)!;
  }

  const dbPath = path.join(dataDir, `campaign_${campaignId}.db`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      user_identifier TEXT NOT NULL,
      score REAL NOT NULL,
      total_questions INTEGER NOT NULL,
      correct_answers INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      answers_json TEXT NOT NULL
    )
  `);

  // Safe migration for existing installations to add department column
  try {
    db.exec("ALTER TABLE submissions ADD COLUMN department TEXT DEFAULT ''");
  } catch (e) {
    // Column already exists
  }

  // Safe migration for existing installations to add extra profile columns
  try {
    db.exec("ALTER TABLE submissions ADD COLUMN surname TEXT DEFAULT ''");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE submissions ADD COLUMN em_no TEXT DEFAULT ''");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE submissions ADD COLUMN company_email TEXT DEFAULT ''");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE submissions ADD COLUMN company TEXT DEFAULT ''");
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      user_identifier TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  campaignDbs.set(campaignId, db);
  return db;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Middleware to authenticate admin token via JWT
  const authenticateAdminToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    let token = authHeader && authHeader.split(" ")[1];

    // Fallback: Check token in query parameters (for EventSource or simple GET links)
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: "Access Denied: ไม่พบสิทธิ์การเข้าใช้งาน (Missing Authorization Token)" });
    }

    try {
      const verified = jwt.verify(token, JWT_SECRET) as any;
      req.adminUser = verified;
      next();
    } catch (err) {
      return res.status(403).json({ error: "Access Denied: สิทธิ์การเข้าใช้งานหมดอายุหรือคุณไม่มีสิทธิ์เข้าถึง (Invalid or Expired Token)" });
    }
  };

  // Global /api protection middleware
  app.use("/api", (req, res, next) => {
    // Exempt login/auth endpoint
    if (req.path === "/auth") {
      return next();
    }

    // Exempt student-facing API endpoints:
    // - /api/campaigns/:id/student
    // - /api/campaigns/:id/submit
    // - /api/campaigns/:id/join
    // - /api/campaigns/:id/attempts/:identifier
    // - /api/campaigns/:id/start-attempt
    const path = req.path; // Note: req.path for app.use("/api") will be relative to /api, so e.g. "/campaigns/midterm/student"
    const isStudentRoute = 
      path.endsWith("/student") || 
      path.endsWith("/submit") || 
      path.endsWith("/join") || 
      path.includes("/attempts/") || 
      path.endsWith("/start-attempt");

    if (isStudentRoute) {
      return next();
    }

    // Otherwise protect with admin token
    authenticateAdminToken(req, res, next);
  });

  // API: Proxy login authentication to ESS Aapico with Employee Pre-Info retrieval
  app.post("/api/auth", async (req, res) => {
    try {
      const { identifier, password, isAdminLogin } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ error: "กรุณากรอก Username และ Password" });
      }

      const upperId = identifier.trim().toUpperCase();

      // Check first if it is a System Admin Account in SQLite
      const sysAdmin = masterDb.prepare("SELECT * FROM admins WHERE LOWER(username_or_id) = ? AND type = 'system'").get(identifier.trim().toLowerCase()) as any;
      if (sysAdmin) {
        // Handle secure verification of hashed system passwords using bcryptjs, with fallback support for plain text
        let passwordMatches = false;
        if (sysAdmin.password && (sysAdmin.password.startsWith("$2a$") || sysAdmin.password.startsWith("$2b$"))) {
          passwordMatches = bcrypt.compareSync(password, sysAdmin.password);
        } else {
          passwordMatches = password === sysAdmin.password;
        }

        if (!passwordMatches) {
          return res.status(400).json({ error: "Username หรือ Password ไม่ถูกต้อง" });
        }
        
        const systemProfile = {
          employeeId: sysAdmin.username_or_id,
          empNo: sysAdmin.username_or_id,
          firstName: sysAdmin.name,
          lastName: "",
          fullNameEn: sysAdmin.name,
          idCard: "",
          birthDate: "",
          company: "SYSTEM",
          department: sysAdmin.department || "System Admin",
          startDate: "",
          payrollEnabled: false,
          authUserId: 0,
          username: sysAdmin.username_or_id,
          name: sysAdmin.name,
          surname: "",
          emNo: sysAdmin.username_or_id,
          em_no: sysAdmin.username_or_id,
          companyEmail: "",
          role: sysAdmin.role,
          type: "system",
          isAdmin: true
        };

        const token = jwt.sign(
          {
            username: sysAdmin.username_or_id,
            role: sysAdmin.role,
            type: "system",
            employeeId: sysAdmin.username_or_id
          },
          JWT_SECRET,
          { expiresIn: "8h" }
        );

        return res.json({
          jwt: token,
          user: systemProfile
        });
      }

      // If it's not a system admin, it must be an ESS Account.
      // We will authenticate using mock ESS accounts first or live ESS.
      let authenticatedUser: any = null;

      const mockUsers: Record<string, any> = {
        "AH10002898": {
          employeeId: "AH10002898",
          empNo: "10002898",
          firstName: "วจีประดิษฐ์",
          lastName: "พรมพันธุ์",
          fullNameEn: "Mr.Wajeepradit Prompan",
          idCard: "1600101870283",
          birthDate: "2001-05-18",
          company: "AH",
          department: "IT-96-Indirect",
          startDate: "2024-08-01",
          payrollEnabled: true,
          authUserId: 13935,
          username: "AH10002898",
          name: "วจีประดิษฐ์",
          surname: "พรมพันธุ์",
          emNo: "AH10002898",
          em_no: "AH10002898",
          companyEmail: "wajeepradit.p@aapico.com"
        },
        "AH10002900": {
          employeeId: "AH10002900",
          empNo: "10002900",
          firstName: "สมนึก",
          lastName: "รักดี",
          fullNameEn: "Mrs.Somnuek Rakdee",
          idCard: "1100102930412",
          birthDate: "1995-10-12",
          company: "AH",
          department: "HR-01-Direct",
          startDate: "2020-03-15",
          payrollEnabled: true,
          authUserId: 14002,
          username: "AH10002900",
          name: "สมนึก",
          surname: "รักดี",
          emNo: "AH10002900",
          em_no: "AH10002900",
          companyEmail: "somnuek.r@aapico.com"
        },
        "AH10003500": {
          employeeId: "AH10003500",
          empNo: "10003500",
          firstName: "ใจเด็ด",
          lastName: "รักษาสัตย์",
          fullNameEn: "Mr.Jaided Raksasat",
          idCard: "3100201847583",
          birthDate: "1988-04-25",
          company: "AH",
          department: "PROD-02-Indirect",
          startDate: "2018-11-01",
          payrollEnabled: true,
          authUserId: 14590,
          username: "AH10003500",
          name: "ใจเด็ด",
          surname: "รักษาสัตย์",
          emNo: "AH10003500",
          em_no: "AH10003500",
          companyEmail: "jaided.r@aapico.com"
        }
      };

      // Generate 10 mock accounts TEST10001111 - TEST10001120 for production/testing
      for (let i = 11; i <= 20; i++) {
        const username = `TEST100011${i}`;
        mockUsers[username] = {
          employeeId: username,
          empNo: `100011${i}`,
          firstName: `ผู้ทดสอบ ${i}`,
          lastName: "ระบบสอบ SmartEval",
          fullNameEn: `Tester ${i} SmartEval`,
          idCard: `31000000011${i}`,
          birthDate: `1999-01-${i}`,
          company: "AAPICO",
          department: "IT-96-Indirect (แผนกไอที)",
          startDate: "2026-01-01",
          payrollEnabled: true,
          authUserId: 20000 + i,
          username: username,
          name: `ผู้ทดสอบ ${i}`,
          surname: "ระบบสอบ SmartEval",
          emNo: username,
          em_no: username,
          companyEmail: `test100011${i}@aapico.com`
        };
      }

      const isTestMockUser = upperId.startsWith("TEST100011") && parseInt(upperId.slice(-2)) >= 11 && parseInt(upperId.slice(-2)) <= 20;

      if (mockUsers[upperId] && (password === "123456" || (isTestMockUser && password === "1234"))) {
        if (process.env.NODE_ENV === "production" && !isTestMockUser) {
          return res.status(403).json({ error: "ไม่อนุญาตให้ใช้บัญชีทดสอบในสภาพแวดล้อมจริง (Production Environment) กรุณาเข้าสู่ระบบด้วยบัญชีพนักงานจริงของคุณผ่านระบบ Live ESS API" });
        }
        authenticatedUser = { ...mockUsers[upperId] };
      } else {
        // Step 1: Authenticate against /auth/local
        const response = await fetch("https://ess.aapico.com/auth/local", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ identifier, password })
        });

        if (response.status === 400) {
          return res.status(400).json({ error: "Username หรือ Password ไม่ถูกต้อง" });
        }

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ตรวจสอบสิทธิ์: ${errText || response.statusText}` });
        }

        const authData = await response.json();
        const user = authData.user;
        if (!user) {
          return res.status(400).json({ error: "การเข้าสู่ระบบสำเร็จแต่ไม่พบข้อมูลผู้ใช้ (Missing User Profile)" });
        }

        const idCard = user.idCard || user.id_card;
        const birthday = user.birthday || user.birthDate || user.birth_date;

        if (!idCard) {
          return res.status(400).json({ error: "ไม่พบข้อมูลเลขบัตรประชาชน (idCard) ของผู้ใช้งานในระบบ ESS เพื่อเชื่อมต่อประวัติ" });
        }

        // Step 2: Retrieve detailed Employee Pre-Information
        const preinfoUrl = `https://ess.aapico.com/employees/preinfo?id_card=${encodeURIComponent(idCard)}&birth_day_contains=${encodeURIComponent(birthday || "")}`;
        const empResponse = await fetch(preinfoUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        });

        if (!empResponse.ok) {
          const empErrText = await empResponse.text();
          return res.status(empResponse.status).json({ error: `เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน: ${empErrText || empResponse.statusText}` });
        }

        const empList = await empResponse.json();
        if (!Array.isArray(empList) || empList.length === 0) {
          return res.status(404).json({ error: "ไม่พบข้อมูลพนักงานในระบบ Employee Pre-Information (Employee Not Found)" });
        }

        const emp = empList[0];

        // Step 3: Construct Consolidated Employee Profile
        authenticatedUser = {
          employeeId: emp.emp_id,
          empNo: user.empID || user.emp_id || emp.emp_id,
          firstName: emp.emp_name,
          lastName: emp.sure_name,
          fullNameEn: emp.eng_name,
          idCard: idCard,
          birthDate: birthday,
          company: emp.company,
          department: emp.group_th_desc || emp.group_en_desc || "",
          startDate: emp.start_date,
          payrollEnabled: !!emp.isPayroll,
          authUserId: user.id,
          username: user.username,

          // For absolute backwards compatibility with standard QuizTaker.tsx and downstream storage fields
          name: emp.emp_name,
          surname: emp.sure_name,
          emNo: emp.emp_id,
          em_no: emp.emp_id,
          companyEmail: ""
        };
      }

      if (!authenticatedUser) {
        return res.status(400).json({ error: "Username หรือ Password ไม่ถูกต้อง" });
      }

      // If this is an Admin Login Panel request, check permissions
      if (isAdminLogin) {
        const empIdToCheck = authenticatedUser.employeeId || authenticatedUser.username || upperId;
        const essAdmin = masterDb.prepare("SELECT * FROM admins WHERE UPPER(username_or_id) = ? AND type = 'ess'").get(empIdToCheck.toUpperCase()) as any;
        if (!essAdmin) {
          return res.status(403).json({ error: `บัญชีพนักงาน ESS (${empIdToCheck}) ไม่ได้รับสิทธิ์เป็นผู้ดูแลระบบ กรุณาติดต่อ Super Admin เพื่อขอสิทธิ์การเข้าใช้งาน` });
        }
        
        authenticatedUser.role = essAdmin.role;
        authenticatedUser.isAdmin = true;
      }

      // Secure self-signed JWT creation for authenticated ESS admin and user accounts
      const token = jwt.sign(
        {
          username: authenticatedUser.username || authenticatedUser.employeeId || upperId,
          role: authenticatedUser.role || "admin",
          type: "ess",
          employeeId: authenticatedUser.employeeId || authenticatedUser.username || upperId
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.json({
        jwt: token,
        user: authenticatedUser
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "เกิดข้อผิดพลาดในการติดต่อระบบส่งข้อมูลภายนอก" });
    }
  });

  // API: Get all administrator accounts
  app.get("/api/admins", (req, res) => {
    try {
      const stmt = masterDb.prepare("SELECT id, username_or_id, name, department, type, role, created_at FROM admins ORDER BY type DESC, username_or_id ASC");
      const rows = stmt.all() as any[];
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Search/lookup ESS Employee account details
  app.get("/api/ess/lookup/:id", (req, res) => {
    try {
      const { id } = req.params;
      const upperId = id.trim().toUpperCase();

      const mockUsers: Record<string, any> = {
        "AH10002898": {
          employeeId: "AH10002898",
          name: "วจีประดิษฐ์ พรมพันธุ์",
          department: "IT-96-Indirect (แผนกไอที)",
        },
        "AH10002900": {
          employeeId: "AH10002900",
          name: "สมนึก รักดี",
          department: "HR-01-Direct (ฝ่ายบุคคล)",
        },
        "AH10003500": {
          employeeId: "AH10003500",
          name: "ใจเด็ด รักษาสัตย์",
          department: "PROD-02-Indirect (ฝ่ายผลิต)",
        }
      };

      for (let i = 11; i <= 20; i++) {
        const username = `TEST100011${i}`;
        mockUsers[username] = {
          employeeId: username,
          name: `ผู้ทดสอบ ${i} ระบบสอบ SmartEval`,
          department: "IT-96-Indirect (แผนกไอที)",
        };
      }

      const isTestMockUser = upperId.startsWith("TEST100011") && parseInt(upperId.slice(-2)) >= 11 && parseInt(upperId.slice(-2)) <= 20;

      if (mockUsers[upperId]) {
        if (process.env.NODE_ENV === "production" && !isTestMockUser) {
          return res.json({ found: false, message: "ไม่อนุญาตให้ดึงข้อมูลบัญชีผู้ใช้จำลองในโหมดใช้งานจริง (Production)" });
        }
        return res.json({ found: true, user: mockUsers[upperId] });
      }

      res.json({ found: false, message: "ไม่พบข้อมูลพนักงาน ESS รหัสนี้ในหน่วยบันทึกความจำจำลอง" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Grant Admin privileges / Create system admin account
  app.post("/api/admins", (req, res) => {
    try {
      const { username_or_id, name, department, type, password, role } = req.body;
      if (!username_or_id || !name || !type) {
        return res.status(400).json({ error: "กรุณาระบุข้อมูลที่จำเป็น (รหัสพนักงาน, ชื่อ-นามสกุล, และประเภท)" });
      }

      const cleanId = username_or_id.trim();
      const lookupKey = type === "system" ? cleanId.toLowerCase() : cleanId.toUpperCase();

      // Check if already assigned
      const queryCheck = type === "system" 
        ? "SELECT * FROM admins WHERE LOWER(username_or_id) = ? AND type = 'system'"
        : "SELECT * FROM admins WHERE UPPER(username_or_id) = ? AND type = 'ess'";
      
      const existing = masterDb.prepare(queryCheck).get(lookupKey);
      if (existing) {
        return res.status(400).json({ error: `บัญชีผู้ใช้นี้ได้รับสิทธิ์ผู้ดูแลระบบอยู่แล้วในกลุ่ม ${type.toUpperCase()}` });
      }

      if (type === "system") {
        if (!password || !password.trim()) {
          return res.status(400).json({ error: "บัญชีระบบ (System Account) จำเป็นต้องระบุรหัสผ่านสำหรับการเข้าใช้งาน" });
        }
      }

      const id = type + "_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
      const stmt = masterDb.prepare(`
        INSERT INTO admins (id, username_or_id, name, department, type, password, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const savedPassword = type === "system" && password ? bcrypt.hashSync(password.trim(), 10) : null;

      stmt.run(
        id,
        type === "system" ? cleanId : cleanId.toUpperCase(),
        name.trim(),
        (department || "").trim(),
        type,
        savedPassword,
        role || "admin",
        new Date().toISOString()
      );

      res.status(201).json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Update Administrator details (role, password, name, department)
  app.put("/api/admins/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, department, password, role } = req.body;

      const existing = masterDb.prepare("SELECT * FROM admins WHERE id = ?").get(id) as any;
      if (!existing) {
        return res.status(404).json({ error: "ไม่พบข้อมูลบัญชีผู้ดูแลระบบ" });
      }

      const stmt = masterDb.prepare(`
        UPDATE admins
        SET name = ?, department = ?, password = ?, role = ?
        WHERE id = ?
      `);
      
      let finalPassword = existing.password;
      if (existing.type === "system" && password && password.trim()) {
        finalPassword = bcrypt.hashSync(password.trim(), 10);
      }

      stmt.run(
        name ? name.trim() : existing.name,
        department !== undefined ? department.trim() : existing.department,
        finalPassword,
        role || existing.role,
        id
      );

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Revoke administrative privileges / delete admin account
  app.delete("/api/admins/:id", (req, res) => {
    try {
      const { id } = req.params;

      const existing = masterDb.prepare("SELECT * FROM admins WHERE id = ?").get(id) as any;
      if (!existing) {
        return res.status(404).json({ error: "ไม่พบข้อมูลบัญชีผู้ดูแลระบบที่ระบุ" });
      }

      // Safeguard: Cannot delete system default admin account to prevent lockout
      if (existing.username_or_id === "admin" && existing.type === "system") {
        return res.status(400).json({ error: "ไม่สามารถเพิกถอนสิทธิ์หรือลบบัญชีระบบหลัก (admin) ได้ เพื่อป้องกันสิทธิ์ว่างในระบบ" });
      }

      const stmt = masterDb.prepare("DELETE FROM admins WHERE id = ?");
      stmt.run(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Reset all databases to factory settings
  app.post("/api/admin/reset", (req, res) => {
    try {
      console.log("Database reset requested!");

      // Security check: check for ACTIVE campaigns/exam rooms
      try {
        const tableCheck = masterDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaigns'").get();
        if (tableCheck) {
          const activeCountRow = masterDb.prepare("SELECT COUNT(*) as count FROM campaigns WHERE status = 'ACTIVE'").get() as { count: number } | undefined;
          if (activeCountRow && activeCountRow.count > 0) {
            return res.status(400).json({
              error: `ไม่สามารถรีเซ็ตฐานข้อมูลได้ เนื่องจากมีห้องสอบที่กำลังเปิดใช้งาน (ACTIVE) อยู่ทั้งหมด ${activeCountRow.count} ห้อง กรุณาปิดการทำงานของห้องสอบทั้งหมดก่อนทำการรีเซ็ตฐานข้อมูล`
            });
          }
        }
      } catch (dbErr) {
        console.error("Error checking active campaigns before reset:", dbErr);
      }
      
      // 1. Close all active campaign DB connections
      for (const [campaignId, db] of campaignDbs.entries()) {
        try {
          db.close();
        } catch (e) {
          console.error(`Error closing DB for campaign ${campaignId}:`, e);
        }
      }
      campaignDbs.clear();

      // 2. Close master DB
      try {
        masterDb.close();
      } catch (e) {
        console.error("Error closing master DB:", e);
      }

      // 3. Reset active participant states and live socket connections
      for (const id of activeStressTestTimeouts.keys()) {
        clearCampaignStressTest(id);
      }
      activeStressTestTimeouts.clear();
      liveClients.clear();
      activeParticipants.clear();

      // 4. Delete SQLite files in the data directory
      const files = fs.readdirSync(dataDir);
      for (const file of files) {
        if (file.endsWith(".db") || file.endsWith(".db-wal") || file.endsWith(".db-shm")) {
          try {
            const filePath = path.join(dataDir, file);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Deleted database file: ${file}`);
            }
          } catch (err) {
            console.error(`Failed to delete file ${file}:`, err);
          }
        }
      }

      // 5. Reinitialize fresh master database
      masterDb = new Database(masterDbPath);
      masterDb.pragma("journal_mode = WAL");

      masterDb.exec(`
        CREATE TABLE IF NOT EXISTS campaigns (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          group_name TEXT NOT NULL,
          status TEXT NOT NULL,
          start_time TEXT,
          end_time TEXT,
          passing_percentage INTEGER NOT NULL,
          time_limit_minutes INTEGER NOT NULL,
          questions_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);

      // Add all missing columns with individual try-catch blocks
      const runQuery = (q: string) => {
        try {
          masterDb.exec(q);
        } catch (e) {
          console.error(`Migration error during reset for query [${q}]:`, e);
        }
      };

      runQuery("ALTER TABLE campaigns ADD COLUMN total_questions_to_test INTEGER DEFAULT 0");
      runQuery("ALTER TABLE campaigns ADD COLUMN max_attempts INTEGER DEFAULT 0");
      runQuery("ALTER TABLE campaigns ADD COLUMN results_display_mode TEXT DEFAULT 'full'");
      runQuery("ALTER TABLE campaigns ADD COLUMN is_untimed INTEGER DEFAULT 0");
      runQuery("ALTER TABLE campaigns ADD COLUMN randomization_mode TEXT DEFAULT 'static'");
      runQuery("ALTER TABLE campaigns ADD COLUMN updated_at TEXT");
      runQuery("ALTER TABLE campaigns ADD COLUMN question_selection_mode TEXT DEFAULT 'manual'");
      runQuery("ALTER TABLE campaigns ADD COLUMN manual_question_ids_json TEXT DEFAULT '[]'");
      runQuery("ALTER TABLE campaigns ADD COLUMN rule_category TEXT DEFAULT ''");
      runQuery("ALTER TABLE campaigns ADD COLUMN rule_difficulty TEXT DEFAULT 'all'");
      runQuery("ALTER TABLE campaigns ADD COLUMN rule_count INTEGER DEFAULT 0");
      runQuery("ALTER TABLE campaigns ADD COLUMN target_booklet TEXT DEFAULT ''");

      // Create questions table
      masterDb.exec(`
        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          options_json TEXT NOT NULL,
          correct_index INTEGER NOT NULL,
          explanation TEXT,
          category TEXT NOT NULL DEFAULT '',
          difficulty TEXT NOT NULL DEFAULT '',
          booklet TEXT DEFAULT '',
          packet_id TEXT DEFAULT ''
        )
      `);

      // Create exam_packets table
      masterDb.exec(`
        CREATE TABLE IF NOT EXISTS exam_packets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        )
      `);

      // Create admins table
      masterDb.exec(`
        CREATE TABLE IF NOT EXISTS admins (
          id TEXT PRIMARY KEY,
          username_or_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          department TEXT,
          type TEXT NOT NULL, -- 'system' or 'ess'
          password TEXT, -- plain text password for system admins
          role TEXT NOT NULL DEFAULT 'admin', -- 'super_admin' or 'admin'
          created_at TEXT NOT NULL
        )
      `);

      // Seed admins table
      try {
        const insertAdmin = masterDb.prepare(`
          INSERT OR IGNORE INTO admins (id, username_or_id, name, department, type, password, role, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertAdmin.run(
          "ess_wajeepradit",
          "AH10002898",
          "วจีประดิษฐ์ พรมพันธุ์",
          "IT-96-Indirect (แผนกไอที)",
          "ess",
          null,
          "admin",
          new Date().toISOString()
        );

        insertAdmin.run(
          "sys_admin",
          "admin",
          "System Administrator",
          "IT Administration",
          "system",
          "admin123",
          "super_admin",
          new Date().toISOString()
        );
        console.log("Re-seeded admins table during system reset.");
      } catch (err) {
        console.error("Error re-seeding admins table during reset:", err);
      }

      // Seed packets
      const insertP = masterDb.prepare("INSERT OR IGNORE INTO exam_packets (id, name, created_at) VALUES (?, ?, ?)");
      insertP.run("p_m365", "ชุดข้อสอบ Microsoft 365 & Copilot", new Date().toISOString());

      // Seed default questions
      const seedQuestions = [
        {
          id: "m365_q1",
          text: "Microsoft Office 365 มีลักษณะการให้บริการแบบใด?",
          options: ["บริการระบบคลาวด์แบบสมัครสมาชิก", "ซอฟต์แวร์ซื้อขาดติดตั้งครั้งเดียว", "ฮาร์ดแวร์เซิร์ฟเวอร์ภายในองค์กร", "แอปพลิเคชันฟรีแบบโอเพนซอร์ส"],
          correctIndex: 0,
          explanation: "Microsoft 365 (เดิมคือ Office 365) เป็นบริการระบบคลาวด์แบบสมัครสมาชิกจาก Microsoft ที่รวมแอปพลิเคชันชั้นนำและทำงานร่วมกันได้จากทุกอุปกรณ์",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q2",
          text: "แนวคิดหลัก \"Copilot ≠ Autopilot\" สื่อถึงสิ่งใด?",
          options: ["คนยังเป็นกัปตันที่ตรวจสอบและตัดสินใจ", "Copilot ทำงานแทนคนได้ทั้งหมดโดยอัตโนมัติ", "ต้องใช้ Copilot คู่กับระบบขับเคลื่อนอัตโนมัติ", "Copilot ใช้ได้เฉพาะผู้ดูแลระบบเท่านั้น"],
          correctIndex: 0,
          explanation: "Copilot ช่วยสร้างร่างงานและวิเคราะห์ แต่คนยังเป็นกัปตันที่ตรวจสอบและตัดสินใจ ไม่ใช่ระบบที่ทำงานแทนทั้งหมด",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q3",
          text: "Microsoft 365 Copilot ทำงานในลักษณะใด?",
          options: ["เป็นผู้ช่วยในแอปที่ใช้ทุกวัน ไม่ใช่ Chatbot แยกต่างหาก", "เป็นแอปพลิเคชันแยกที่ต้องเปิดต่างหากเสมอ", "เป็นเว็บไซต์ที่ต้องเข้าผ่านเบราว์เซอร์เท่านั้น", "เป็นอุปกรณ์ฮาร์ดแวร์เสริม"],
          correctIndex: 0,
          explanation: "Copilot ไม่ใช่ Chatbot แยกต่างหาก แต่เป็น \"Copilot\" ที่ฝังอยู่ในแอปที่ใช้ทุกวัน",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q4",
          text: "ในด้านความปลอดภัยของข้อมูล Copilot มีหลักการอย่างไร?",
          options: ["ใช้เฉพาะข้อมูลที่มีสิทธิ์เข้าถึงและไม่ถูกนำไปเทรนโมเดลสาธารณะ", "แชร์ข้อมูลทั้งหมดให้โมเดลสาธารณะเพื่อพัฒนา", "เข้าถึงไฟล์ทุกไฟล์ในองค์กรได้โดยไม่จำกัดสิทธิ์", "เก็บ Prompt ไว้บนเซิร์ฟเวอร์สาธารณะ"],
          correctIndex: 0,
          explanation: "ข้อมูลและ Prompt อยู่ภายใต้ขอบเขตความปลอดภัยขององค์กร ใช้เฉพาะข้อมูลที่มีสิทธิ์เข้าถึง และไม่ถูกนำไปเทรนโมเดลสาธารณะ",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q5",
          text: "แอปพลิเคชันของ Microsoft 365 ในกลุ่มที่ 1 (เครื่องมือทำงานทั่วไป) ประกอบด้วยอะไรบ้าง?",
          options: ["Excel, Word, PowerPoint, OneNote", "Outlook, Teams, OneDrive, SharePoint", "Word, Outlook, Teams, OneDrive", "Excel, Teams, OneNote, OneDrive"],
          correctIndex: 0,
          explanation: "กลุ่มที่ 1 OFFICE เป็นเครื่องมือสำหรับงานทั่วไป ได้แก่ Excel, Word, PowerPoint และ OneNote",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q6",
          text: "ในโครงสร้างของ Excel \"เซลล์ (Cell)\" หมายถึงอะไร?",
          options: ["จุดตัดของแถวและคอลัมน์ เช่น B2", "แนวตั้งทั้งหมดของตาราง", "แนวนอนทั้งหมดของตาราง", "ชื่อของชีตงาน"],
          correctIndex: 0,
          explanation: "เซลล์ (Cell) คือจุดตัดของแถว (Row) และคอลัมน์ (Column) เช่น B2",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q7",
          text: "ฟีเจอร์ Flash Fill ใน Excel ใช้ทำสิ่งใด?",
          options: ["เติมข้อมูลอัตโนมัติตามรูปแบบที่พิมพ์เป็นตัวอย่าง", "สร้างกราฟและแดชบอร์ดอัตโนมัติ", "เฝ้าดูค่าของเซลล์จากหลายชีต", "ป้องกันไฟล์ด้วยรหัสผ่าน"],
          correctIndex: 0,
          explanation: "Flash Fill ตรวจจับรูปแบบจากตัวอย่างที่พิมพ์ แล้วเติมข้อมูลที่เหลือทั้งคอลัมน์ให้อัตโนมัติ โดยไม่ต้องเขียนสูตร",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q8",
          text: "ปุ่มลัดใดใช้สั่งให้ Flash Fill เติมข้อมูลทั้งคอลัมน์ทันที?",
          options: ["Ctrl + E", "Ctrl + N", "Ctrl + S", "Ctrl + P"],
          correctIndex: 0,
          explanation: "กด Ctrl + E เพื่อให้ Excel เติมข้อมูลที่เหลือทั้งคอลัมน์ด้วย Flash Fill ทันที",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q9",
          text: "ฟีเจอร์ Watch Window ใน Excel มีประโยชน์อย่างไร?",
          options: ["เฝ้าดูค่าของเซลล์สำคัญจากทุกชีตได้ในหน้าต่างเดียว", "แก้ไขค่าของเซลล์จากหลายไฟล์พร้อมกัน", "แปลงข้อมูลเป็นกราฟอัตโนมัติ", "ล็อกเซลล์ไม่ให้ผู้อื่นแก้ไข"],
          correctIndex: 0,
          explanation: "Watch Window ช่วยเฝ้าดูค่าและสูตรของเซลล์สำคัญจากทุกชีตแบบเรียลไทม์ในหน้าต่างเดียว แต่ใช้ดูค่าเท่านั้น แก้ไขไม่ได้",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q10",
          text: "ฟีเจอร์ Compare Documents ใน Word ทำหน้าที่ใด?",
          options: ["เปรียบเทียบเอกสารสองฉบับเพื่อดูความแตกต่าง", "รวมเอกสารหลายไฟล์เป็นไฟล์เดียว", "แปลงเอกสารเป็นไฟล์ PDF", "ตรวจสอบการสะกดคำอัตโนมัติ"],
          correctIndex: 0,
          explanation: "Compare Documents เปรียบเทียบไฟล์ต้นฉบับกับฉบับแก้ไขแบบคำต่อคำ แล้วสร้างเอกสารใหม่แสดงความต่างผ่านมุมมอง Track Changes",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q11",
          text: "เมื่อใช้ Compare Documents ใน Word ผลลัพธ์จะแสดงในรูปแบบใด?",
          options: ["เอกสารฉบับใหม่ที่แสดงความต่างแบบ Track Changes", "เขียนทับไฟล์ต้นฉบับทันที", "ไฟล์ Excel สรุปความแตกต่าง", "อีเมลแจ้งเตือนผู้เขียน"],
          correctIndex: 0,
          explanation: "ระบบสร้างเอกสารฉบับที่ 3 ขึ้นใหม่เพื่อไม่ให้กระทบไฟล์เดิม และแสดงความแตกต่างทั้งหมดผ่านมุมมอง Track Changes",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q12",
          text: "ฟีเจอร์ Design Suggestions (Designer) ใน PowerPoint ช่วยเรื่องใด?",
          options: ["ช่วยออกแบบและจัดวางสไลด์ให้สวยงามโดยอัตโนมัติ", "แปลภาษาข้อความในสไลด์", "บันทึกเสียงบรรยายอัตโนมัติ", "บีบอัดขนาดไฟล์งานนำเสนอ"],
          correctIndex: 0,
          explanation: "Design Suggestions ให้ PowerPoint ช่วยแนะนำการจัดวางและออกแบบสไลด์ให้สวยงามอัตโนมัติในไม่กี่วินาที ผ่านแถบ Designer",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q13",
          text: "ฟีเจอร์ Reuse Slides ใน PowerPoint ทำสิ่งใด?",
          options: ["นำสไลด์จากไฟล์งานนำเสนออื่นมาใช้ซ้ำได้ทันที", "ทำซ้ำสไลด์เดิมภายในไฟล์เดียว", "ล้างการจัดรูปแบบ of สไลด์", "แปลงสไลด์เป็นวิดีโอ"],
          correctIndex: 0,
          explanation: "Reuse Slides ช่วยนำสไลด์จากไฟล์งานนำเสนออื่นมาใช้ซ้ำได้ทันที โดยเลือกติ๊ก Keep source formatting เพื่อคงดีไซน์เดิมได้",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q14",
          text: "OneNote จัดโครงสร้างการบันทึกในรูปแบบใด?",
          options: ["สมุด (Notebook) → หมวดหมู่ (Section) → หน้า (Page)", "โฟลเดอร์ → ไฟล์ → ชีต", "ทีม → ช่อง → ข้อความ", "ไดรฟ์ → โฟลเดอร์ → ลิงก์"],
          correctIndex: 0,
          explanation: "OneNote จัดโครงสร้างแบบยืดหยุ่นโดยแบ่งเป็นสมุด (Notebook), หมวดหมู่ (Section) และหน้า (Page)",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q15",
          text: "ฟีเจอร์ Search Across Notebooks ใน OneNote ทำอะไรได้?",
          options: ["ค้นหาข้อมูลข้ามทุกสมุดบันทึกได้ในคลิกเดียว", "แปลงบันทึกเป็นไฟล์ PDF", "ซิงค์บันทึกกับ Excel", "ล็อกสมุดบันทึกด้วยรหัสผ่าน"],
          correctIndex: 0,
          explanation: "Search Across Notebooks ช่วยค้นหาคำสำคัญข้ามทุกสมุดบันทึกพร้อมกัน โดยเลือกขอบเขตเป็น All Notebooks",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q16",
          text: "แอปในกลุ่มที่ 2 (อีเมลและการประสานงานหลัก) คือแอปใด?",
          options: ["Outlook และ Teams", "Excel และ Word", "OneNote และ OneDrive", "PowerPoint และ Excel"],
          correctIndex: 0,
          explanation: "กลุ่มที่ 2 เป็นแอปสำหรับอีเมลและการประสานงานหลัก ได้แก่ Outlook และ Microsoft Teams",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q17",
          text: "ฟีเจอร์ Focused Inbox ใน Outlook ทำหน้าที่ใด?",
          options: ["แยกอีเมลสำคัญออกจากอีเมลทั่วไปโดยอัตโนมัติ", "ลบอีเมลขยะทิ้งถาวรทันที", "แปลอีเมลเป็นภาษาอื่น", "เข้ารหัสอีเมลทุกฉบับ"],
          correctIndex: 0,
          explanation: "Focused Inbox ช่วยให้ Outlook แยกอีเมลสำคัญออกจากอีเมลทั่วไปโดยอัตโนมัติ",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q18",
          text: "\"ผู้ช่วยจัดตารางเวลา (Scheduling Assistant)\" ใน Outlook ใช้ทำสิ่งใด?",
          options: ["ดูช่วงเวลาที่ผู้เข้าร่วมทุกคนว่างตรงกัน", "ตอบอีเมลอัตโนมัติแทนผู้ใช้", "จัดเรียงอีเมลตามหมวดหมู่สี", "บันทึกการประชุมเป็นข้อความ"],
          correctIndex: 0,
          explanation: "Scheduling Assistant ช่วยตรวจสอบเวลาว่างของผู้เข้าร่วม เพื่อหาช่วงเวลาที่ทุกคนว่างตรงกันในการนัดประชุม",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q19",
          text: "ใน Microsoft Teams การจัดกลุ่มการทำงานตามโครงการหรือแผนกใช้สิ่งใด?",
          options: ["ทีม (Teams) และช่อง (Channels)", "โฟลเดอร์และไฟล์", "สมุดและหน้า", "ป้ายและหมวดหมู่สี"],
          correctIndex: 0,
          explanation: "Teams จัดกลุ่มการทำงานเป็นทีม (Team) และแบ่งช่อง (Channel) ตามโครงการ แผนก หรือหัวข้องาน",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        },
        {
          id: "m365_q20",
          text: "ฟีเจอร์ Version History ใน OneDrive มีประโยชน์อย่างไร?",
          options: ["ย้อนดูและกู้คืนไฟล์เวอร์ชันก่อนหน้าได้ทุกเมื่อ", "ลบไฟล์เก่าทิ้งอัตโนมัติเพื่อประหยัดพื้นที่", "แปลงไฟล์เป็นรูปแบบอื่น", "จำกัดจำนวนคนที่แก้ไขไฟล์"],
          correctIndex: 0,
          explanation: "Version History ช่วยแสดงเวอร์ชันย้อนหลังพร้อมวันที่ เวลา และผู้แก้ไข ทำให้เปรียบเทียบและกู้คืนไฟล์เวอร์ชันก่อนหน้าได้ทุกเมื่อ",
          packetId: "p_m365",
          booklet: "ชุดข้อสอบ Microsoft 365 & Copilot"
        }
      ];

      const insertQ = masterDb.prepare(`
        INSERT OR IGNORE INTO questions (id, text, options_json, correct_index, explanation, packet_id, booklet)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const q of seedQuestions) {
        insertQ.run(q.id, q.text, JSON.stringify(q.options), q.correctIndex, q.explanation, q.packetId, q.booklet);
      }

      // Seed Demo Tech Quiz campaign with full columns
      const insertStmt = masterDb.prepare(`
        INSERT OR REPLACE INTO campaigns (
          id, name, group_name, status, start_time, end_time, passing_percentage, 
          time_limit_minutes, total_questions_to_test, max_attempts, results_display_mode, 
          randomization_mode, questions_json, question_selection_mode, manual_question_ids_json, 
          rule_category, rule_difficulty, rule_count, target_booklet, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        "demo-quiz",
        "ห้องสอบ Microsoft 365 & Copilot",
        "ห้องสอบพนักงาน (Employee Exam)",
        "ACTIVE",
        null,
        null,
        60,
        20,
        20,
        3,
        "full",
        "static",
        JSON.stringify(seedQuestions.map(q => ({
          id: q.id,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation
        }))),
        "manual",
        JSON.stringify(seedQuestions.map(q => q.id)),
        "",
        "all",
        0,
        "ชุดข้อสอบ Microsoft 365 & Copilot",
        new Date().toISOString(),
        new Date().toISOString()
      );

      console.log("Database reset complete. Seeded demo campaign with full schema!");
      res.json({ success: true, message: "รีเซ็ตฐานข้อมูลทั้งหมดและสร้างควิซจำลองเรียบร้อยแล้ว" });
    } catch (err: any) {
      console.error("Failed to reset database:", err);
      res.status(500).json({ error: err.message || "เกิดข้อผิดพลาดในการรีเซ็ตระบบ" });
    }
  });

  // ==========================================
  // CENTRAL QUESTION BANK ENDPOINTS
  // ==========================================

  // GET all packets
  app.get("/api/packets", (req, res) => {
    try {
      const stmt = masterDb.prepare("SELECT * FROM exam_packets ORDER BY name ASC");
      const rows = stmt.all() as any[];
      res.json(rows.map(r => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create a packet
  app.post("/api/packets", (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "กรุณาระบุชื่อชุดข้อสอบ" });
      }
      const trimmedName = name.trim();
      const existing = masterDb.prepare("SELECT id FROM exam_packets WHERE name = ?").get(trimmedName);
      if (existing) {
        return res.status(400).json({ error: "มีชุดข้อสอบชื่อนี้อยู่แล้วในระบบ" });
      }
      const id = "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
      const stmt = masterDb.prepare("INSERT INTO exam_packets (id, name, created_at) VALUES (?, ?, ?)");
      stmt.run(id, trimmedName, new Date().toISOString());
      res.status(201).json({ success: true, id, name: trimmedName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE a packet and its associated questions (complete independent separation!)
  app.delete("/api/packets/:id", (req, res) => {
    try {
      const { id } = req.params;
      
      // Delete questions associated with this packet to prevent stray references
      const deleteQs = masterDb.prepare("DELETE FROM questions WHERE packet_id = ?");
      deleteQs.run(id);

      // Delete packet
      const deleteP = masterDb.prepare("DELETE FROM exam_packets WHERE id = ?");
      deleteP.run(id);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET all questions in the bank
  app.get("/api/questions", (req, res) => {
    try {
      const stmt = masterDb.prepare(`
        SELECT q.*, p.name AS packet_name 
        FROM questions q
        LEFT JOIN exam_packets p ON q.packet_id = p.id
        ORDER BY q.id DESC
      `);
      const rows = stmt.all() as any[];
      const questions = rows.map(r => ({
        id: r.id,
        text: r.text,
        options: JSON.parse(r.options_json),
        correctIndex: r.correct_index,
        explanation: r.explanation || "",
        packetId: r.packet_id || "",
        booklet: r.packet_name || r.booklet || "ทั่วไป"
      }));
      res.json(questions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create a single question inside a packet
  app.post("/api/questions", (req, res) => {
    try {
      const { text, options, correctIndex, explanation, packetId } = req.body;
      if (!text || !options || typeof correctIndex !== "number" || !packetId) {
        return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วนสำหรับการสร้างข้อสอบ" });
      }

      const packet = masterDb.prepare("SELECT name FROM exam_packets WHERE id = ?").get(packetId) as any;
      if (!packet) {
        return res.status(400).json({ error: "ไม่พบชุดข้อสอบที่เลือก" });
      }
      const bookletName = packet.name;

      const id = "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
      const stmt = masterDb.prepare(`
        INSERT INTO questions (id, text, options_json, correct_index, explanation, packet_id, booklet)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, text.trim(), JSON.stringify(options), correctIndex, (explanation || "").trim(), packetId, bookletName);
      res.status(201).json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT update a single question
  app.put("/api/questions/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { text, options, correctIndex, explanation, packetId } = req.body;
      
      const check = masterDb.prepare("SELECT id FROM questions WHERE id = ?").get(id);
      if (!check) {
        return res.status(404).json({ error: "ไม่พบข้อสอบที่ต้องการแก้ไข" });
      }

      const packet = masterDb.prepare("SELECT name FROM exam_packets WHERE id = ?").get(packetId) as any;
      if (!packet) {
        return res.status(400).json({ error: "ไม่พบชุดข้อสอบที่เลือก" });
      }
      const bookletName = packet.name;

      const stmt = masterDb.prepare(`
        UPDATE questions
        SET text = ?, options_json = ?, correct_index = ?, explanation = ?, packet_id = ?, booklet = ?
        WHERE id = ?
      `);
      stmt.run(text.trim(), JSON.stringify(options), correctIndex, (explanation || "").trim(), packetId, bookletName, id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE a single question
  app.delete("/api/questions/:id", (req, res) => {
    try {
      const { id } = req.params;
      const stmt = masterDb.prepare("DELETE FROM questions WHERE id = ?");
      stmt.run(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST bulk import questions directly to a packet
  app.post("/api/questions/bulk", (req, res) => {
    try {
      const { questions, packetId } = req.body;
      if (!Array.isArray(questions)) {
        return res.status(400).json({ error: "โครงสร้างข้อมูลต้องเป็นแบบอาร์เรย์ (Array)" });
      }
      if (!packetId) {
        return res.status(400).json({ error: "กรุณาระบุรหัสชุดข้อสอบสำหรับการนำเข้า" });
      }

      const packet = masterDb.prepare("SELECT name FROM exam_packets WHERE id = ?").get(packetId) as any;
      if (!packet) {
        return res.status(400).json({ error: "ไม่พบชุดข้อสอบที่เลือก" });
      }
      const bookletName = packet.name;

      const insertQ = masterDb.prepare(`
        INSERT INTO questions (id, text, options_json, correct_index, explanation, packet_id, booklet)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = masterDb.transaction((qs) => {
         for (const q of qs) {
           const id = q.id || "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
           insertQ.run(
             id,
             q.text.trim(),
             JSON.stringify(q.options),
             q.correctIndex,
             (q.explanation || "").trim(),
             packetId,
             bookletName
           );
         }
      });

      transaction(questions);
      res.json({ success: true, count: questions.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Get all campaigns
  app.get("/api/campaigns", (req, res) => {
    try {
      const stmt = masterDb.prepare("SELECT * FROM campaigns ORDER BY created_at DESC");
      const rows = stmt.all() as any[];
      const campaigns = rows.map((row) => {
        let questions = [];
        const selectMode = row.question_selection_mode || "manual";
        if (selectMode === "random" || selectMode === "rule") {
          const booklet = row.target_booklet || "";
          const qStmt = masterDb.prepare("SELECT * FROM questions WHERE booklet = ?");
          const qRows = qStmt.all(booklet) as any[];
          questions = qRows.map((r: any) => ({
            id: r.id,
            text: r.text,
            options: JSON.parse(r.options_json),
            correctIndex: r.correct_index,
            explanation: r.explanation || "",
            packetId: r.packet_id,
            booklet: r.booklet || ""
          }));
        } else {
          let manualIds = [];
          try {
            manualIds = JSON.parse(row.manual_question_ids_json || "[]");
          } catch (e) {}

          if (manualIds.length > 0) {
            const placeholders = manualIds.map(() => "?").join(",");
            const qStmt = masterDb.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`);
            const qRows = qStmt.all(...manualIds) as any[];
            const qMap = new Map(qRows.map((r: any) => [r.id, r]));
            questions = manualIds.map(id => {
              const r = qMap.get(id);
              if (!r) return null;
              return {
                id: r.id,
                text: r.text,
                options: JSON.parse(r.options_json),
                correctIndex: r.correct_index,
                explanation: r.explanation || "",
                packetId: r.packet_id,
                booklet: r.booklet || ""
              };
            }).filter(Boolean);
          } else {
            questions = JSON.parse(row.questions_json || "[]");
          }
        }

        return {
          id: row.id,
          name: row.name,
          groupName: row.group_name,
          status: row.status,
          startTime: row.start_time,
          endTime: row.end_time,
          passingPercentage: row.passing_percentage,
          timeLimitMinutes: row.time_limit_minutes,
          totalQuestionsToTest: row.total_questions_to_test || 0,
          maxAttempts: row.max_attempts || 0,
          resultsDisplayMode: row.results_display_mode || "full",
          isUntimed: row.is_untimed === 1,
          randomizationMode: row.randomization_mode || "static",
          questions,
          createdAt: row.created_at,
          updatedAt: row.updated_at || row.created_at,
          questionSelectionMode: selectMode,
          manualQuestionIds: JSON.parse(row.manual_question_ids_json || "[]"),
          ruleCategory: row.rule_category || "",
          ruleDifficulty: row.rule_difficulty || "all",
          ruleCount: row.rule_count || 0,
          targetBooklet: row.target_booklet || "",
          activeTakersCount: activeParticipants.get(row.id)?.size || 0,
        };
      });
      res.json(campaigns);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Create a new campaign
  app.post("/api/campaigns", (req, res) => {
    try {
      const {
        id,
        name,
        groupName,
        status,
        startTime,
        endTime,
        passingPercentage,
        timeLimitMinutes,
        totalQuestionsToTest,
        maxAttempts,
        resultsDisplayMode,
        isUntimed,
        randomizationMode,
        questions,
        questionSelectionMode,
        manualQuestionIds,
        ruleCategory,
        ruleDifficulty,
        ruleCount,
        targetBooklet,
      } = req.body;

      if (!id || !name || !groupName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if ID already exists
      const checkStmt = masterDb.prepare("SELECT id FROM campaigns WHERE id = ?");
      if (checkStmt.get(id)) {
        return res.status(400).json({ error: "Campaign ID already exists" });
      }

      const stmt = masterDb.prepare(`
        INSERT INTO campaigns (
          id, name, group_name, status, start_time, end_time, passing_percentage, 
          time_limit_minutes, total_questions_to_test, max_attempts, results_display_mode, 
          is_untimed, randomization_mode, questions_json, created_at,
          question_selection_mode, manual_question_ids_json, rule_category, rule_difficulty, rule_count, target_booklet,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        name,
        groupName,
        status || "DRAFT",
        startTime || null,
        endTime || null,
        passingPercentage || 60,
        timeLimitMinutes || 30,
        totalQuestionsToTest || 0,
        maxAttempts || 0,
        resultsDisplayMode || "full",
        isUntimed ? 1 : 0,
        randomizationMode || "static",
        JSON.stringify(questions || []),
        new Date().toISOString(),
        questionSelectionMode || "manual",
        JSON.stringify(manualQuestionIds || []),
        ruleCategory || "",
        ruleDifficulty || "all",
        ruleCount || 0,
        targetBooklet || "",
        new Date().toISOString()
      );

      // Create isolated DB and tables for this campaign immediately
      getCampaignDb(id);

      res.status(201).json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Update a campaign
  app.put("/api/campaigns/:id", (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        groupName,
        status,
        startTime,
        endTime,
        passingPercentage,
        timeLimitMinutes,
        totalQuestionsToTest,
        maxAttempts,
        resultsDisplayMode,
        isUntimed,
        randomizationMode,
        questions,
        questionSelectionMode,
        manualQuestionIds,
        ruleCategory,
        ruleDifficulty,
        ruleCount,
        targetBooklet,
      } = req.body;

      const checkStmt = masterDb.prepare("SELECT id FROM campaigns WHERE id = ?");
      if (!checkStmt.get(id)) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const stmt = masterDb.prepare(`
        UPDATE campaigns
        SET name = ?, group_name = ?, status = ?, start_time = ?, end_time = ?, passing_percentage = ?, 
            time_limit_minutes = ?, total_questions_to_test = ?, max_attempts = ?, results_display_mode = ?, 
            is_untimed = ?, randomization_mode = ?, questions_json = ?,
            question_selection_mode = ?, manual_question_ids_json = ?, rule_category = ?, rule_difficulty = ?, rule_count = ?, target_booklet = ?,
            updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        name,
        groupName,
        status,
        startTime || null,
        endTime || null,
        passingPercentage,
        timeLimitMinutes,
        totalQuestionsToTest || 0,
        maxAttempts || 0,
        resultsDisplayMode || "full",
        isUntimed ? 1 : 0,
        randomizationMode || "static",
        JSON.stringify(questions || []),
        questionSelectionMode || "manual",
        JSON.stringify(manualQuestionIds || []),
        ruleCategory || "",
        ruleDifficulty || "all",
        ruleCount || 0,
        targetBooklet || "",
        new Date().toISOString(),
        id
      );

      if (status === "ACTIVE") {
        try {
          const db = getCampaignDb(id);
          db.prepare("DELETE FROM attempts").run();
        } catch (dbErr) {
          console.error("Failed to clear attempts on campaign activation:", dbErr);
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Reset database and metrics for a specific campaign (room)
  app.post("/api/campaigns/:id/reset", (req, res) => {
    try {
      const { id } = req.params;

      // Halt any active stress-test loops immediately
      clearCampaignStressTest(id);

      // Validate campaign existence
      const campaign = masterDb.prepare("SELECT id, name FROM campaigns WHERE id = ?").get(id) as any;
      if (!campaign) {
        return res.status(404).json({ error: "ไม่พบห้องสอบที่ต้องการรีเซ็ต" });
      }

      // Execute reset inside the campaign-specific database
      try {
        const db = getCampaignDb(id);
        db.prepare("DELETE FROM submissions").run();
        db.prepare("DELETE FROM attempts").run();
      } catch (dbErr: any) {
        console.error(`Error deleting rows in campaign ${id} database:`, dbErr);
        return res.status(500).json({ error: "ล้างข้อมูลในฐานข้อมูลย่อยไม่สำเร็จ: " + dbErr.message });
      }

      // Clear memory states for this campaign
      if (activeParticipants.has(id)) {
        activeParticipants.get(id)?.clear();
      }

      // Push SSE update to any active Live Lobbies
      const clients = liveClients.get(id);
      if (clients && clients.length > 0) {
        const payloadStr = JSON.stringify({ type: "reset" });
        clients.forEach(client => {
          try {
            client.write(`data: ${payloadStr}\n\n`);
          } catch (e) {}
        });
      }

      console.log(`Campaign room '${id}' reset successful.`);
      res.json({ success: true, message: "รีเซ็ตข้อมูลรายชื่อและประวัติคะแนนสอบทั้งหมดของห้องนี้สำเร็จแล้ว" });
    } catch (err: any) {
      console.error(`Unexpected campaign reset error:`, err);
      res.status(500).json({ error: err.message || "เกิดข้อผิดพลาดในการรีเซ็ตห้องสอบ" });
    }
  });

  // API: Delete a campaign and its database
  app.delete("/api/campaigns/:id", (req, res) => {
    try {
      const { id } = req.params;

      // Halt any active stress-test loops immediately
      clearCampaignStressTest(id);

      const stmt = masterDb.prepare("DELETE FROM campaigns WHERE id = ?");
      stmt.run(id);

      // Close and delete campaign specific database
      if (campaignDbs.has(id)) {
        try {
          const db = campaignDbs.get(id)!;
          db.close();
        } catch (dbCloseErr) {
          console.error("Error closing campaign DB:", dbCloseErr);
        }
        campaignDbs.delete(id);
      }

      const dbPath = path.join(dataDir, `campaign_${id}.db`);
      const walPath = path.join(dataDir, `campaign_${id}.db-wal`);
      const shmPath = path.join(dataDir, `campaign_${id}.db-shm`);

      try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      } catch (e) {
        console.error("Failed to delete DB file:", e);
      }
      try {
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      } catch (e) {
        console.error("Failed to delete WAL file:", e);
      }
      try {
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      } catch (e) {
        console.error("Failed to delete SHM file:", e);
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Get single campaign for admin (with answers)
  app.get("/api/campaigns/:id/admin", (req, res) => {
    try {
      const { id } = req.params;
      const stmt = masterDb.prepare("SELECT * FROM campaigns WHERE id = ?");
      const row = stmt.get(id) as any;

      if (!row) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      let questions = [];
      const selectMode = row.question_selection_mode || "manual";
      if (selectMode === "random" || selectMode === "rule") {
        const booklet = row.target_booklet || "";
        const qStmt = masterDb.prepare("SELECT * FROM questions WHERE booklet = ?");
        const qRows = qStmt.all(booklet) as any[];
        questions = qRows.map((r: any) => ({
          id: r.id,
          text: r.text,
          options: JSON.parse(r.options_json),
          correctIndex: r.correct_index,
          explanation: r.explanation || "",
          packetId: r.packet_id,
          booklet: r.booklet || ""
        }));
      } else {
        let manualIds = [];
        try {
          manualIds = JSON.parse(row.manual_question_ids_json || "[]");
        } catch (e) {}

        if (manualIds.length > 0) {
          const placeholders = manualIds.map(() => "?").join(",");
          const qStmt = masterDb.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`);
          const qRows = qStmt.all(...manualIds) as any[];
          const qMap = new Map(qRows.map((r: any) => [r.id, r]));
          questions = manualIds.map(qid => {
            const r = qMap.get(qid);
            if (!r) return null;
            return {
              id: r.id,
              text: r.text,
              options: JSON.parse(r.options_json),
              correctIndex: r.correct_index,
              explanation: r.explanation || "",
              packetId: r.packet_id,
              booklet: r.booklet || ""
            };
          }).filter(Boolean);
        } else {
          questions = JSON.parse(row.questions_json || "[]");
        }
      }

      res.json({
        id: row.id,
        name: row.name,
        groupName: row.group_name,
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
        passingPercentage: row.passing_percentage,
        timeLimitMinutes: row.time_limit_minutes,
        totalQuestionsToTest: row.total_questions_to_test || 0,
        maxAttempts: row.max_attempts || 0,
        resultsDisplayMode: row.results_display_mode || "full",
        isUntimed: row.is_untimed === 1,
        randomizationMode: row.randomization_mode || "static",
        questions,
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
        questionSelectionMode: selectMode,
        manualQuestionIds: JSON.parse(row.manual_question_ids_json || "[]"),
        ruleCategory: row.rule_category || "",
        ruleDifficulty: row.rule_difficulty || "all",
        ruleCount: row.rule_count || 0,
        targetBooklet: row.target_booklet || "",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Get single campaign for student (STRIPS answers for security!)
  app.get("/api/campaigns/:id/student", (req, res) => {
    try {
      const { id } = req.params;
      const stmt = masterDb.prepare("SELECT * FROM campaigns WHERE id = ?");
      const row = stmt.get(id) as any;

      if (!row) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const now = new Date();

      // Check auto-open / auto-close timings if specified
      if (row.start_time) {
        const start = new Date(row.start_time);
        if (now < start) {
          return res.status(403).json({ error: "This exam campaign has not started yet.", notStarted: true });
        }
      }

      if (row.end_time) {
        const end = new Date(row.end_time);
        if (now > end) {
          return res.status(403).json({ error: "This exam campaign has already closed.", closed: true });
        }
      }

      if (row.status !== "ACTIVE") {
        return res.status(403).json({ error: "This exam campaign is not active at the moment.", inactive: true });
      }

      const selectMode = row.question_selection_mode || "manual";
      let questions = [];

      if (selectMode === "random" || selectMode === "rule") {
        const booklet = row.target_booklet || "";
        const ruleCount = row.rule_count || 0;

        const qQuery = "SELECT COUNT(*) as count FROM questions WHERE booklet = ?";
        const params = [booklet];
        const countRes = masterDb.prepare(qQuery).get(...params) as any;
        const totalInPool = countRes ? countRes.count : 0;
        const questionsCount = ruleCount > 0 ? Math.min(ruleCount, totalInPool) : totalInPool;

        questions = Array.from({ length: questionsCount }, (_, i) => ({
          id: `dummy_${i}`,
          text: `คำถามข้อที่ ${i + 1}`,
          options: []
        }));
      } else {
        let manualIds = [];
        try {
          manualIds = JSON.parse(row.manual_question_ids_json || "[]");
        } catch (e) {}

        if (manualIds.length > 0) {
          const placeholders = manualIds.map(() => "?").join(",");
          const rows = masterDb.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`).all(...manualIds) as any[];
          const qMap = new Map(rows.map((r: any) => [r.id, r]));
          questions = manualIds.map(id => {
            const r = qMap.get(id);
            if (!r) return null;
            return {
              id: r.id,
              text: r.text,
              options: JSON.parse(r.options_json)
            };
          }).filter(Boolean);
        } else {
          questions = JSON.parse(row.questions_json || "[]").map((q: any) => ({
            id: q.id,
            text: q.text,
            options: q.options,
          }));
        }
      }

      res.json({
        id: row.id,
        name: row.name,
        groupName: row.group_name,
        timeLimitMinutes: row.time_limit_minutes,
        passingPercentage: row.passing_percentage,
        totalQuestionsToTest: row.total_questions_to_test || 0,
        maxAttempts: row.max_attempts || 0,
        resultsDisplayMode: row.results_display_mode || "full",
        isUntimed: row.is_untimed === 1,
        randomizationMode: row.randomization_mode || "static",
        questions,
        updatedAt: row.updated_at || row.created_at,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Get number of previous attempts of a student
  app.get("/api/campaigns/:id/attempts/:identifier", (req, res) => {
    try {
      const { id, identifier } = req.params;
      const campaignStmt = masterDb.prepare("SELECT * FROM campaigns WHERE id = ?");
      const campaign = campaignStmt.get(id) as any;
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const maxAttempts = campaign.max_attempts || 0;

      const db = getCampaignDb(id);
      const countStmt = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE user_identifier = ?");
      const result = countStmt.get(identifier) as any;
      const count = result ? result.count : 0;

      res.json({
        attemptsCount: count,
        maxAttempts: maxAttempts,
        allowed: maxAttempts === 0 || count < maxAttempts,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Start a fresh randomized attempt/session for student
  app.post("/api/campaigns/:id/start-attempt", (req, res) => {
    try {
      const { id } = req.params;
      const { userIdentifier } = req.body;

      if (!userIdentifier) {
        return res.status(400).json({ error: "Missing user identifier" });
      }

      const campStmt = masterDb.prepare("SELECT * FROM campaigns WHERE id = ?");
      const campaign = campStmt.get(id) as any;

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Shuffler helper
      function shuffle<T>(array: T[]): T[] {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }

      const selectMode = campaign.question_selection_mode || "manual";
      let poolQuestions = [];

      if (selectMode === "random" || selectMode === "rule") {
        const booklet = campaign.target_booklet || "";
        const ruleCount = campaign.rule_count || 10;

        const qQuery = "SELECT * FROM questions WHERE booklet = ?";
        const params = [booklet];

        const stmt = masterDb.prepare(qQuery);
        const rows = stmt.all(...params) as any[];

        let mappedPool = rows.map((r: any) => ({
          id: r.id,
          text: r.text,
          options: JSON.parse(r.options_json),
          correctIndex: r.correct_index,
          explanation: r.explanation || "",
          category: r.category || "General",
          difficulty: r.difficulty || "Medium",
          booklet: r.booklet || "ทั่วไป"
        }));

        // Dynamically randomize the selection pool for booklet matching
        mappedPool = shuffle(mappedPool);

        if (ruleCount > 0 && ruleCount < mappedPool.length) {
          poolQuestions = mappedPool.slice(0, ruleCount);
        } else {
          poolQuestions = mappedPool;
        }
      } else {
        let manualIds = [];
        try {
          manualIds = JSON.parse(campaign.manual_question_ids_json || "[]");
        } catch (e) {}

        if (manualIds.length > 0) {
          const placeholders = manualIds.map(() => "?").join(",");
          const rows = masterDb.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`).all(...manualIds) as any[];
          const qMap = new Map(rows.map((r: any) => [r.id, r]));
          poolQuestions = manualIds.map(qid => {
            const r = qMap.get(qid);
            if (!r) return null;
            return {
              id: r.id,
              text: r.text,
              options: JSON.parse(r.options_json),
              correctIndex: r.correct_index,
              explanation: r.explanation || "",
              category: r.category || "General",
              difficulty: r.difficulty || "Medium",
              booklet: r.booklet || "ทั่วไป"
            };
          }).filter(Boolean);
        } else {
          poolQuestions = JSON.parse(campaign.questions_json || "[]");
        }
      }

      const randMode = campaign.randomization_mode || "static";
      let selectedQuestions = [...poolQuestions];

      // Shuffling choices and updating correctIndex helper
      function shuffleChoices(q: any) {
        const originalCorrectOption = q.options[q.correctIndex];
        const shuffledOptions = shuffle(q.options);
        const newCorrectIndex = shuffledOptions.indexOf(originalCorrectOption);
        return {
          ...q,
          options: shuffledOptions,
          correctIndex: newCorrectIndex
        };
      }

      if (randMode === "fully_random") {
        // Mode 1: Fully randomized dynamic pool
        // 1. Shuffle all questions
        selectedQuestions = shuffle(selectedQuestions);
        // 2. Slice if totalQuestionsToTest is set
        const totalToTest = campaign.total_questions_to_test || 0;
        if (totalToTest > 0 && totalToTest < selectedQuestions.length) {
          selectedQuestions = selectedQuestions.slice(0, totalToTest);
        }
        // 3. Shuffle choices for each question
        selectedQuestions = selectedQuestions.map(q => shuffleChoices(q));
      } else if (randMode === "fix_random") {
        // Mode 2: Fix questions, but randomize sequence and choices
        const totalToTest = campaign.total_questions_to_test || 0;
        if (totalToTest > 0 && totalToTest < selectedQuestions.length) {
          selectedQuestions = selectedQuestions.slice(0, totalToTest);
        }
        // Shuffle their display sequence
        selectedQuestions = shuffle(selectedQuestions);
        // Shuffle choices for each question
        selectedQuestions = selectedQuestions.map(q => shuffleChoices(q));
      } else {
        // Mode 3: Static / No randomization
        const totalToTest = campaign.total_questions_to_test || 0;
        if (totalToTest > 0 && totalToTest < selectedQuestions.length) {
          selectedQuestions = selectedQuestions.slice(0, totalToTest);
        }
      }

      const attemptId = "att_" + Math.random().toString(36).substring(2, 10);
      const db = getCampaignDb(id);
      const stmt = db.prepare("INSERT INTO attempts (id, user_identifier, questions_json, created_at) VALUES (?, ?, ?, ?)");
      stmt.run(attemptId, userIdentifier, JSON.stringify(selectedQuestions), new Date().toISOString());

      // Strip correctIndex and explanations for security before returning to student
      const strippedQuestions = selectedQuestions.map((q: any) => ({
        id: q.id,
        text: q.text,
        options: q.options
      }));

      res.json({
        attemptId,
        questions: strippedQuestions
      });
    } catch (err: any) {
      console.error("Failed to start attempt:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API: Submit student exam answers
  app.post("/api/campaigns/:id/submit", (req, res) => {
    try {
      const { id } = req.params;
      const { userName, userIdentifier, department, surname, emNo, companyEmail, company, answers, durationSeconds, questionIds, attemptId } = req.body;

      if (!userName || !userIdentifier || !answers) {
        return res.status(400).json({ error: "Missing submission details" });
      }

      // Check campaign validity & fetch original questions for grading
      const campStmt = masterDb.prepare("SELECT * FROM campaigns WHERE id = ?");
      const campaign = campStmt.get(id) as any;

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      if (campaign.status !== "ACTIVE") {
        return res.status(403).json({ error: "This exam campaign is closed or inactive." });
      }

      if (campaign.max_attempts && campaign.max_attempts > 0) {
        const db = getCampaignDb(id);
        const countStmt = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE user_identifier = ?");
        const result = countStmt.get(userIdentifier) as any;
        const count = result ? result.count : 0;
        if (count >= campaign.max_attempts) {
          return res.status(403).json({ error: `ท่านสอบครบจำนวนสิทธิ์จำกัดแล้ว (${campaign.max_attempts} ครั้ง) ไม่สามารถส่งผลข้อสอบเพิ่มได้` });
        }
      }

      const now = new Date();
      if (campaign.end_time) {
        const end = new Date(campaign.end_time);
        if (now > end) {
          return res.status(403).json({ error: "This exam campaign has closed." });
        }
      }

      // Get the questions for this attempt, or fallback to campaign questions
      let assignedQuestions = [];
      if (attemptId) {
        const db = getCampaignDb(id);
        const attemptStmt = db.prepare("SELECT questions_json FROM attempts WHERE id = ? AND user_identifier = ?");
        const attempt = attemptStmt.get(attemptId, userIdentifier) as any;
        if (attempt) {
          assignedQuestions = JSON.parse(attempt.questions_json);
        }
      }

      // If no attempt found, fallback to original logic
      if (assignedQuestions.length === 0) {
        const questions = JSON.parse(campaign.questions_json);
        assignedQuestions = questionIds && Array.isArray(questionIds)
          ? questions.filter((q: any) => questionIds.includes(q.id))
          : questions;
      }

      let correctAnswers = 0;
      const totalQuestions = assignedQuestions.length;

      // Grade the responses securely on the server
      const answersEvaluation = assignedQuestions.map((q: any) => {
        const correctOptionText = q.options[q.correctIndex];
        const studentSelectedText = answers[q.id] || "";
        const isCorrect = studentSelectedText === correctOptionText;
        if (isCorrect) {
          correctAnswers++;
        }
        return {
          questionId: q.id,
          questionText: q.text,
          correctAnswer: correctOptionText,
          selectedAnswer: studentSelectedText,
          isCorrect,
          explanation: q.explanation || "",
        };
      });

      const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      const passed = score >= campaign.passing_percentage ? 1 : 0;

      // Save submission in isolated campaign database
      const db = getCampaignDb(id);
      const submitStmt = db.prepare(`
        INSERT INTO submissions (user_name, user_identifier, department, surname, em_no, company_email, company, score, total_questions, correct_answers, passed, submitted_at, duration_seconds, answers_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      submitStmt.run(
        userName,
        userIdentifier,
        department || "",
        surname || "",
        emNo || "",
        companyEmail || "",
        company || "",
        score,
        totalQuestions,
        correctAnswers,
        passed,
        new Date().toISOString(),
        durationSeconds || 0,
        JSON.stringify(answers)
      );

      // Remove from active participants since they submitted
      const participants = activeParticipants.get(id);
      if (participants) {
        participants.delete(userIdentifier);
      }

      // Notify SSE clients
      const clients = liveClients.get(id);
      if (clients && clients.length > 0) {
        const payloadStr = JSON.stringify({
          type: "submission",
          submission: {
            userName,
            userIdentifier,
            department: department || "",
            surname: surname || "",
            emNo: emNo || "",
            companyEmail: companyEmail || "",
            company: company || "",
            score,
            totalQuestions,
            correctAnswers,
            passed: passed === 1,
            submittedAt: new Date().toISOString(),
            durationSeconds: durationSeconds || 0,
            answers
          }
        });
        clients.forEach(client => {
          try {
            client.write(`data: ${payloadStr}\n\n`);
          } catch (e) {
            // client connection probably dead
          }
        });
      }

      res.json({
        success: true,
        scorePercent: parseFloat(score.toFixed(1)),
        totalQuestions,
        correctCount: correctAnswers,
        passed: passed === 1,
        passingCriteria: campaign.passing_percentage,
        answersEvaluation,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: SSE Live connection for real-time live board updates
  app.get("/api/campaigns/:id/live", (req, res) => {
    const { id } = req.params;
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    
    if (!liveClients.has(id)) {
      liveClients.set(id, []);
    }
    
    const clients = liveClients.get(id)!;
    clients.push(res);
    
    req.on("close", () => {
      const currentClients = liveClients.get(id);
      if (currentClients) {
        liveClients.set(id, currentClients.filter(c => c !== res));
      }
    });
  });

  // API: Register student joining/entering exam
  app.post("/api/campaigns/:id/join", express.json(), (req, res) => {
    try {
      const { id } = req.params;
      const { userIdentifier, userName, department, company } = req.body;
      if (!userIdentifier || !userName) {
        return res.status(400).json({ error: "Missing identity details" });
      }

      if (!activeParticipants.has(id)) {
        activeParticipants.set(id, new Map());
      }
      const participants = activeParticipants.get(id)!;
      participants.set(userIdentifier, {
        userIdentifier,
        userName,
        department: department || "",
        company: company || "",
        joinedAt: new Date().toISOString()
      });

      // Broadcast to SSE clients that a user joined
      const clients = liveClients.get(id);
      if (clients && clients.length > 0) {
        const payloadStr = JSON.stringify({
          type: "join",
          participant: {
            userIdentifier,
            userName,
            department: department || "",
            company: company || "",
            status: "JOINED"
          }
        });
        clients.forEach(client => {
          try {
            client.write(`data: ${payloadStr}\n\n`);
          } catch (e) {}
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Get active participants list
  app.get("/api/campaigns/:id/participants", (req, res) => {
    try {
      const { id } = req.params;
      const participants = activeParticipants.get(id);
      const list = participants ? Array.from(participants.values()) : [];
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Get submissions for an active/completed campaign (Admin only)
  app.get("/api/campaigns/:id/submissions", (req, res) => {
    try {
      const { id } = req.params;

      // Ensure campaign exists
      const campStmt = masterDb.prepare("SELECT id FROM campaigns WHERE id = ?");
      if (!campStmt.get(id)) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const db = getCampaignDb(id);
      const stmt = db.prepare("SELECT * FROM submissions ORDER BY submitted_at DESC");
      const rows = stmt.all() as any[];

      const submissions = rows.map((row) => ({
        id: row.id,
        userName: row.user_name,
        userIdentifier: row.user_identifier,
        department: row.department || "",
        surname: row.surname || "",
        emNo: row.em_no || "",
        companyEmail: row.company_email || "",
        company: row.company || "",
        score: row.score,
        totalQuestions: row.total_questions,
        correctAnswers: row.correct_answers,
        passed: row.passed === 1,
        submittedAt: row.submitted_at,
        durationSeconds: row.duration_seconds,
        answers: JSON.parse(row.answers_json),
      }));

      res.json(submissions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Mock stress-test simulation of 100 candidates with random behavior and retries until they pass
  app.post("/api/campaigns/:id/stress-test", express.json(), (req, res) => {
    try {
      const { id } = req.params;

      // Halt any active stress-test loops immediately before initializing
      clearCampaignStressTest(id);

      // Ensure campaign exists
      const campStmt = masterDb.prepare("SELECT * FROM campaigns WHERE id = ?");
      const campaign = campStmt.get(id) as any;
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Ensure status is ACTIVE to allow testing live lobby
      if (campaign.status !== "ACTIVE") {
        masterDb.prepare("UPDATE campaigns SET status = 'ACTIVE' WHERE id = ?").run(id);
      }

      const db = getCampaignDb(id);

      // Clear existing submissions & attempts
      db.prepare("DELETE FROM submissions").run();
      db.prepare("DELETE FROM attempts").run();
      if (activeParticipants.has(id)) {
        activeParticipants.get(id)!.clear();
      } else {
        activeParticipants.set(id, new Map());
      }

      // Notify SSE clients of reset so the Live Lobby clears immediately
      const clients = liveClients.get(id);
      if (clients && clients.length > 0) {
        const resetPayload = JSON.stringify({ type: "reset" });
        clients.forEach((client) => {
          try {
            client.write(`data: ${resetPayload}\n\n`);
          } catch (e) {}
        });
      }

      const thaiFirstNames = [
        "สมชาย", "สมศรี", "วิชัย", "อนันต์", "นารี", "ประเสริฐ", "นงลักษณ์", "พงษ์ศักดิ์", "สุรพล", "วรรณดี",
        "เกียรติ", "รัตนา", "บุญมี", "สายเพลิน", "มานพ", "ศิริพร", "ไพโรจน์", "กาญจนา", "อภิชาติ", "จีรพันธ์",
        "ธนพล", "เบญจวรรณ", "เฉลิม", "ดารณี", "สมเกียรติ", "อารี", "พงศ์เทพ", "สุชาดา", "ปรีชา", "อำพล",
        "สุพรรณ", "รสริน", "ดำรง", "นิภา", "โกศล", "วาสนา", "ชัชวาล", "พรรณราย", "ทวีศักดิ์", "มนัส",
        "สุชาติ", "นฤมล", "ชูชาติ", "จุฑารัตน์", "เกรียงไกร", "ยุพิน", "วีระ", "อรัญญา", "ธีรพล", "วนิดา"
      ];

      const thaiLastNames = [
        "ใจดี", "รักสงบ", "มั่นคง", "ยอดเยี่ยม", "รุ่งเรือง", "ดีเลิศ", "เจริญผล", "มีสุข", "ประเสริฐศรี", "สุขเกษม",
        "ปัญญาดี", "งามเสมอ", "ทองดี", "แก้วเกตุ", "เพชรพลอย", "มณีรัตน์", "สว่างจิตต์", "ศิริบูรณ์", "คงกระพัน", "วงศ์ษา",
        "ชื่นชม", "โชคอนันต์", "วิเศษศรี", "บารมี", "เกตุแก้ว", "นาคดี", "ศรีสุข", "ธรรมดี", "เดชณรงค์", "ทวีโชค",
        "ปานทอง", "ยิ่งยง", "วรศิลป์", "ทรัพย์ดี", "เพิ่มพูน", "รักษ์ไทย", "ศรีประเสริฐ", "สมหวัง", "มั่นคงดี", "สุขสวัสดิ์"
      ];

      const departments = ["IT", "HR", "Accounting", "Marketing", "Sales", "Production", "Quality Control", "Engineering", "Purchasing", "Logistics"];
      const companies = ["Aapico Hitech", "Aapico Plastics", "Aapico Forging", "Aapico ITS", "Aapico Structural"];

      const questions = JSON.parse(campaign.questions_json || "[]");
      const totalQuestions = questions.length || 10;

      const participants = [];
      for (let i = 0; i < 100; i++) {
        const fName = thaiFirstNames[i % thaiFirstNames.length];
        const lName = thaiLastNames[(i * 7) % thaiLastNames.length];
        const fullName = `${fName} ${lName}`;
        const empId = `STRESS-${1000 + i}`;
        const dept = departments[i % departments.length];
        const comp = companies[i % companies.length];
        const email = `${empId.toLowerCase()}@aapico.com`;

        participants.push({
          userIdentifier: empId,
          userName: fullName,
          surname: lName,
          emNo: empId,
          companyEmail: email,
          company: comp,
          department: dept
        });
      }

      // Helper function for submission execution
      function executeSubmit(p: any, attemptNum: number) {
        // First attempt: 40% pass. Second attempt: 66% of remaining pass. Third attempt: 100% pass.
        const isPassing = attemptNum === 1
          ? Math.random() < 0.40
          : attemptNum === 2
            ? Math.random() < 0.66
            : true;

        const passingPct = campaign.passing_percentage || 60;
        let score = 0;
        let correctAnswers = 0;

        if (isPassing) {
          const minCorrect = Math.ceil((passingPct / 100) * totalQuestions);
          correctAnswers = minCorrect + Math.floor(Math.random() * (totalQuestions - minCorrect + 1));
          if (correctAnswers > totalQuestions) correctAnswers = totalQuestions;
          score = (correctAnswers / totalQuestions) * 100;
        } else {
          const maxCorrect = Math.floor((passingPct / 100) * totalQuestions) - 1;
          correctAnswers = Math.max(0, Math.floor(Math.random() * (maxCorrect + 1)));
          score = (correctAnswers / totalQuestions) * 100;
        }

        const passed = isPassing ? 1 : 0;
        const submittedAt = new Date().toISOString();
        const durationSeconds = 30 + Math.floor(Math.random() * 90);

        const mockAnswers: Record<string, string> = {};
        questions.forEach((q: any) => {
          if (q.options && q.options.length > 0) {
            mockAnswers[q.id] = q.options[Math.floor(Math.random() * q.options.length)];
          } else {
            mockAnswers[q.id] = "";
          }
        });

        try {
          const sDb = getCampaignDb(id);
          const submitStmt = sDb.prepare(`
            INSERT INTO submissions (user_name, user_identifier, department, surname, em_no, company_email, company, score, total_questions, correct_answers, passed, submitted_at, duration_seconds, answers_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          submitStmt.run(
            p.userName,
            p.userIdentifier,
            p.department,
            p.surname,
            p.emNo,
            p.companyEmail,
            p.company,
            score,
            totalQuestions,
            correctAnswers,
            passed,
            submittedAt,
            durationSeconds,
            JSON.stringify(mockAnswers)
          );
        } catch (e) {
          console.error("Failed to insert mock submission in stress test:", e);
        }

        // Remove from active participants since they submitted
        if (activeParticipants.has(id)) {
          activeParticipants.get(id)!.delete(p.userIdentifier);
        }

        // Notify SSE clients of submission
        const liveClientsList = liveClients.get(id);
        if (liveClientsList && liveClientsList.length > 0) {
          const payloadStr = JSON.stringify({
            type: "submission",
            submission: {
              userName: p.userName,
              userIdentifier: p.userIdentifier,
              department: p.department,
              surname: p.surname,
              emNo: p.emNo,
              companyEmail: p.companyEmail,
              company: p.company,
              score,
              totalQuestions,
              correctAnswers,
              passed: isPassing,
              submittedAt,
              durationSeconds,
              answers: mockAnswers
            }
          });
          liveClientsList.forEach((client) => {
            try {
              client.write(`data: ${payloadStr}\n\n`);
            } catch (e) {}
          });
        }

        if (!isPassing) {
          // Retry loop: Join again after 1.5 - 2.5 seconds using managed timeout
          scheduleCampaignStressTestTimeout(id, () => {
            executeJoin(p, attemptNum + 1);
          }, 1500 + Math.random() * 1000);
        }
      }

      // Helper function for join execution
      function executeJoin(p: any, attemptNum: number) {
        if (!activeParticipants.has(id)) {
          activeParticipants.set(id, new Map());
        }
        const participantsMap = activeParticipants.get(id)!;
        participantsMap.set(p.userIdentifier, {
          userIdentifier: p.userIdentifier,
          userName: p.userName,
          department: p.department,
          company: p.company || "",
          joinedAt: new Date().toISOString()
        });

        // Notify SSE clients of join
        const liveClientsList = liveClients.get(id);
        if (liveClientsList && liveClientsList.length > 0) {
          const payloadStr = JSON.stringify({
            type: "join",
            participant: {
              userIdentifier: p.userIdentifier,
              userName: p.userName,
              department: p.department,
              company: p.company || "",
              status: "JOINED"
            }
          });
          liveClientsList.forEach((client) => {
            try {
              client.write(`data: ${payloadStr}\n\n`);
            } catch (e) {}
          });
        }

        // Schedule submission after 2 - 4 seconds using managed timeout
        scheduleCampaignStressTestTimeout(id, () => {
          executeSubmit(p, attemptNum);
        }, 2000 + Math.random() * 2000);
      }

      // Start staggering the 100 participants over 15 seconds using managed timeouts
      participants.forEach((p, index) => {
        scheduleCampaignStressTestTimeout(id, () => {
          executeJoin(p, 1);
        }, index * 150);
      });

      res.json({ success: true, count: 100 });
    } catch (err: any) {
      console.error("Stress test error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API: Mock simulation of 50 candidates for Live Lobby Board
  app.post("/api/campaigns/:id/simulate", express.json(), (req, res) => {
    try {
      const { id } = req.params;

      // Halt any active stress-test loops immediately before initializing static simulation
      clearCampaignStressTest(id);

      // Ensure campaign exists
      const campStmt = masterDb.prepare("SELECT * FROM campaigns WHERE id = ?");
      const campaign = campStmt.get(id) as any;
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Ensure status is ACTIVE to allow testing live lobby
      if (campaign.status !== "ACTIVE") {
        masterDb.prepare("UPDATE campaigns SET status = 'ACTIVE' WHERE id = ?").run(id);
      }

      const db = getCampaignDb(id);

      // Clear existing submissions & attempts to make room for exactly 50 mockup users
      db.prepare("DELETE FROM submissions").run();
      db.prepare("DELETE FROM attempts").run();
      if (activeParticipants.has(id)) {
        activeParticipants.get(id)!.clear();
      } else {
        activeParticipants.set(id, new Map());
      }

      // Notify SSE clients of reset so the Live Lobby clears immediately
      const liveClientsList = liveClients.get(id);
      if (liveClientsList && liveClientsList.length > 0) {
        const resetPayload = JSON.stringify({ type: "reset" });
        liveClientsList.forEach((client) => {
          try {
            client.write(`data: ${resetPayload}\n\n`);
          } catch (e) {}
        });
      }

      const participantsMap = activeParticipants.get(id)!;

      const thaiFirstNames = [
        "สมชาย", "สมศรี", "วิชัย", "อนันต์", "นารี", "ประเสริฐ", "นงลักษณ์", "พงษ์ศักดิ์", "สุรพล", "วรรณดี",
        "เกียรติ", "รัตนา", "บุญมี", "สายเพลิน", "มานพ", "ศิริพร", "ไพโรจน์", "กาญจนา", "อภิชาติ", "จีรพันธ์",
        "ธนพล", "เบญจวรรณ", "เฉลิม", "ดารณี", "สมเกียรติ", "อารี", "พงศ์เทพ", "สุชาดา", "ปรีชา", "อำพล",
        "สุพรรณ", "รสริน", "ดำรง", "นิภา", "โกศล", "วาสนา", "ชัชวาล", "พรรณราย", "ทวีศักดิ์", "มนัส",
        "สุชาติ", "นฤมล", "ชูชาติ", "จุฑารัตน์", "เกรียงไกร", "ยุพิน", "วีระ", "อรัญญา", "ธีรพล", "วนิดา"
      ];

      const thaiLastNames = [
        "ใจดี", "รักสงบ", "มั่นคง", "ยอดเยี่ยม", "รุ่งเรือง", "ดีเลิศ", "เจริญผล", "มีสุข", "ประเสริฐศรี", "สุขเกษม",
        "ปัญญาดี", "งามเสมอ", "ทองดี", "แก้วเกตุ", "เพชรพลอย", "มณีรัตน์", "สว่างจิตต์", "ศิริบูรณ์", "คงกระพัน", "วงศ์ษา",
        "ชื่นชม", "โชคอนันต์", "วิเศษศรี", "บารมี", "เกตุแก้ว", "นาคดี", "ศรีสุข", "ธรรมดี", "เดชณรงค์", "ทวีโชค",
        "ปานทอง", "ยิ่งยง", "วรศิลป์", "ทรัพย์ดี", "เพิ่มพูน", "รักษ์ไทย", "ศรีประเสริฐ", "สมหวัง", "มั่นคงดี", "สุขสวัสดิ์",
        "รวยเจริญ", "พูนทรัพย์", "อนันตชัย", "บุญฤทธิ์", "รุ่งโรจน์", "เกียรติขจร", "ประชารักษ์", "บุญเจริญ", "มีโชค", "แสนสุข"
      ];

      const depts = [
        "ฝ่ายผลิต (Production)", 
        "ฝ่ายควบคุมคุณภาพ (QC/QA)", 
        "ฝ่ายวิศวกรรม (Engineering)", 
        "ฝ่ายไอที (IT Support)", 
        "ฝ่ายโลจิสติกส์ (Logistics)", 
        "ฝ่ายทรัพยากรบุคคล (HR)"
      ];

      const passingPercent = campaign.passing_percentage || 60;
      const questions = JSON.parse(campaign.questions_json || "[]");
      const totalQuestions = questions.length || 10;

      const mockDataList = [];

      for (let i = 0; i < 50; i++) {
        const fName = thaiFirstNames[i % thaiFirstNames.length];
        const lName = thaiLastNames[i % thaiLastNames.length];
        const fullName = `${fName} ${lName}`;
        const empId = `EMP-${String(i + 1).padStart(3, "0")}`;
        const dept = depts[i % depts.length];
        const surname = lName;
        const companyEmail = `${empId.toLowerCase()}@aapico.com`;
        const company = "AAPICO Plastics";

        let status: "JOINED" | "PASSED" | "FAILED" = "JOINED";
        if (i >= 15 && i < 40) {
          status = "PASSED";
        } else if (i >= 40) {
          status = "FAILED";
        }

        if (status === "JOINED") {
          participantsMap.set(empId, {
            userIdentifier: empId,
            userName: fullName,
            department: dept,
            surname: surname,
            emNo: empId,
            companyEmail: companyEmail,
            company: company,
            joinedAt: new Date(Date.now() - (i * 30 * 1000)).toISOString()
          });

          mockDataList.push({
            type: "join",
            participant: {
              userIdentifier: empId,
              userName: fullName,
              department: dept,
              company: company,
              status: "JOINED"
            }
          });
        } else {
          const isPassed = status === "PASSED";
          let correct = 0;
          if (isPassed) {
            const minCorrect = Math.ceil((passingPercent / 100) * totalQuestions);
            correct = minCorrect + Math.floor(Math.random() * (totalQuestions - minCorrect + 1));
            if (correct > totalQuestions) correct = totalQuestions;
          } else {
            const maxCorrect = Math.floor((passingPercent / 100) * totalQuestions) - 1;
            correct = Math.max(0, Math.floor(Math.random() * (maxCorrect + 1)));
          }

          const score = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
          const passed = isPassed ? 1 : 0;

          const mockAnswers: Record<string, string> = {};
          questions.forEach((q: any) => {
            if (q.options && q.options.length > 0) {
              mockAnswers[q.id] = q.options[Math.floor(Math.random() * q.options.length)];
            } else {
              mockAnswers[q.id] = "";
            }
          });

          const submittedAt = new Date(Date.now() - (i * 2 * 60 * 1000)).toISOString();
          const duration = 180 + Math.floor(Math.random() * 600);

          db.prepare(`
            INSERT INTO submissions (user_name, user_identifier, department, surname, em_no, company_email, company, score, total_questions, correct_answers, passed, submitted_at, duration_seconds, answers_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            fullName,
            empId,
            dept,
            surname,
            empId,
            companyEmail,
            company,
            score,
            totalQuestions,
            correct,
            passed,
            submittedAt,
            duration,
            JSON.stringify(mockAnswers)
          );

          mockDataList.push({
            type: "submission",
            submission: {
              id: i + 1,
              userName: fullName,
              userIdentifier: empId,
              department: dept,
              surname: surname,
              emNo: empId,
              companyEmail: companyEmail,
              company: company,
              score,
              totalQuestions,
              correctAnswers: correct,
              passed: isPassed,
              submittedAt,
              durationSeconds: duration,
              answers: mockAnswers
            }
          });
        }
      }

      // Notify active SSE clients in real-time
      const clients = liveClients.get(id);
      if (clients && clients.length > 0) {
        mockDataList.forEach((evt) => {
          const payloadStr = JSON.stringify(evt);
          clients.forEach((client) => {
            try {
              client.write(`data: ${payloadStr}\n\n`);
            } catch (e) {}
          });
        });
      }

      res.json({ success: true, count: 50 });
    } catch (err: any) {
      console.error("Simulation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite development vs production config
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
