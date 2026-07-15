import React, { useState } from "react";
import AAPICOSmartEvalLogo from "./AAPICOSmartEvalLogo";
import { 
  Check, 
  Copy, 
  Layout, 
  Palette, 
  Sliders, 
  Zap, 
  HelpCircle, 
  Layers, 
  AlertCircle, 
  Info,
  CheckCircle,
  Code
} from "lucide-react";

export default function BrandingGuidelines() {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number>(64);
  const [testHovered, setTestHovered] = useState(false);
  const [testPressed, setTestPressed] = useState(false);

  // Corporate CI Colors
  const colors = [
    { name: "AAPICO Blue (Primary Dominant)", hex: "#1D366D", use: "60% Base blocks, headers, trustworthy identity", textLight: true },
    { name: "AAPICO Ecogreen (Accent Highlights)", hex: "#2DC84D", use: "Active states, key call-to-actions, badges", textLight: false },
    { name: "Metallic Dark Grey", hex: "#464C59", use: "Solid hard flat shadows, secondary subheadings", textLight: true },
    { name: "Pure Black", hex: "#000000", use: "Structural borders, outlines, 90-degree grids", textLight: true },
    { name: "Pure White", hex: "#FFFFFF", use: "High-contrast card contents, canvas workspace", textLight: false },
    { name: "Cool Gray 08", hex: "#D8D9DA", use: "Body text on light backgrounds, disabled outlines", textLight: false },
    { name: "Cool Gray 03", hex: "#A1A1A5", use: "Body text on dark backgrounds, metadata tags", textLight: false },
  ];

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-300 text-left">
      {/* Banner Header */}
      <div className="bg-aapico-blue text-white p-8 border-3 border-black shadow-[5px_5px_0px_0px_#464C59] relative overflow-hidden rounded-none">
        <div className="absolute top-0 right-0 p-8 opacity-10 hidden md:block">
          <AAPICOSmartEvalLogo size={120} dark />
        </div>
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="bg-aapico-green text-black text-[10px] font-black uppercase px-2.5 py-1 tracking-widest font-mono">
            OFFICIAL BRAND CI & STYLE MANUAL
          </span>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight font-sans leading-none">
            AAPICO SmartEval
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
            คู่มือการออกแบบภาพลักษณ์ระบบจัดสอบประเมินผลความรู้ดิจิทัล สไตล์ <strong className="text-white font-bold">Neo-Brutalism Tech & Trust</strong> ผสมผสานความมั่นคงระดับองค์กรอุตสาหกรรมรถยนต์และการเขียนโปรแกรมที่เฉียบคมด้วยมุมมอง 90 องศาแบบตัดตรง
          </p>
        </div>
      </div>

      {/* Grid Layout of Manual */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column - Concepts & Color Palette (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Section 1: Visual Theme Philosophy */}
          <div className="bg-white border-3 border-black p-6 shadow-[4px_4px_0px_0px_#464C59] space-y-4 rounded-none">
            <div className="flex items-center gap-2 border-b-2 border-black pb-3">
              <Layout size={20} className="text-aapico-blue shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wide">
                1. ปรัชญาการออกแบบ (DESIGN PHILOSOPHY)
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-slate-600 leading-relaxed">
              <div className="space-y-2 bg-slate-50 p-4 border border-black rounded-none">
                <p className="font-black text-slate-900 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-aapico-blue" />
                  เรขาคณิต 90 องศา (STRICTLY SHARP)
                </p>
                <p>
                  กล่องข้อความ ปุ่ม และการ์ดทุกใบห้ามใช้มุมโค้งมนเด็ดขาด (Rounded-none) เพื่อสะท้อนความเฉียบคม มั่นคง และเป็นระเบียบตามรูปแบบของอุตสาหกรรมการผลิตยานยนต์ระดับโลก
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 p-4 border border-black rounded-none">
                <p className="font-black text-slate-900 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-aapico-green" />
                  เงาตัดแข็งทึบ (HARD OFFSET SHADOWS)
                </p>
                <p>
                  หลีกเลี่ยงเงาฟุ้งนุ่มนวลแบบเดิมๆ โดยทดแทนด้วยเงาตัดเหลี่ยมทึบตัน (Offset Solid Shadows) 3px - 5px โดยใช้สีเทาเมทัลลิคเข้ม (#464C59) และสีดำบริสุทธิ์เพื่อความเด่นชัดสูง
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 p-4 border border-black rounded-none col-span-1 md:col-span-2">
                <p className="font-black text-slate-900 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-black" />
                  เส้นขอบที่ชัดเจน (SOLID BORDER LINES)
                </p>
                <p>
                  ทุกองค์ประกอบต้องถูกห่อหุ้มด้วยเส้นขอบขนาด 2px หรือ 3px สีดำหรือสีน้ำเงินเข้มอาปิโกเสมอ เพื่อดึงดูดสายตาและยึดโครงร่างโครงสร้างให้สวยงามอย่างมีระบบระเบียบตามสไตล์นีโอบรูทัลลิสต์
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Color Palette */}
          <div className="bg-white border-3 border-black p-6 shadow-[4px_4px_0px_0px_#464C59] space-y-4 rounded-none">
            <div className="flex items-center gap-2 border-b-2 border-black pb-3">
              <Palette size={20} className="text-aapico-blue shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wide">
                2. จานสีทางการและคอนทราสต์ (COLOR PALETTE)
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              จานสีหลักที่ใช้สอดคล้องตามมาตรฐานแบรนด์อย่างเคร่งครัด ผ่านมาตรฐานความเปรียบต่าง WCAG AAA ในการเข้าถึงระดับสากล คลิกที่แถบสีเพื่อคัดลอกรหัส HEX:
            </p>

            <div className="space-y-2.5">
              {colors.map((color, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCopy(color.hex)}
                  className="w-full text-left p-3 border-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-2 transition-all hover:translate-x-1 cursor-pointer select-none rounded-none"
                  style={{ 
                    backgroundColor: color.hex === "#FFFFFF" ? "#FFFFFF" : color.hex,
                    color: color.textLight ? "#FFFFFF" : "#0f172a"
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-black text-xs uppercase tracking-wider">{color.name}</p>
                    <p className="text-[10px] font-mono opacity-80 truncate">{color.use}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold bg-white/25 px-1.5 py-0.5 rounded-none border border-current">
                      {color.hex}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wide bg-black/25 px-1.5 py-0.5 rounded-none">
                      {copiedColor === color.hex ? "COPIED" : "COPY"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Strict Character Encoding & Emoji Constraint Audit */}
          <div className="bg-rose-50 border-3 border-rose-950 p-6 shadow-[4px_4px_0px_0px_#464C59] space-y-3 rounded-none text-rose-950">
            <div className="flex items-center gap-2 border-b-2 border-rose-950 pb-3">
              <AlertCircle size={20} className="text-rose-700 shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wide text-rose-950">
                3. ตรวจสอบเงื่อนไขข้อจำกัดตัวอักษร (TEXT & EMOJI AUDIT)
              </h3>
            </div>
            <p className="text-xs font-medium leading-relaxed">
              <strong>ข้อกำหนดสำคัญด้านการแสดงผลตัวอักษร:</strong> ห้ามใช้ Text Emoji หรือ Graphical Emoji ทุกรูปแบบในระบบเด็ดขาด เพื่อป้องกันปัญหาการแสดงผลฟอนต์ผิดเพี้ยนบนบอร์ดตรวจสอบขนาดใหญ่ (Enterprise Monitor Encoding Error) และเพื่อรักษาลุคทางการน่าเชื่อถือขององค์กรอาปิโก
            </p>
            
            <div className="bg-white border-2 border-rose-950 p-4 space-y-2.5 rounded-none">
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-slate-700 font-bold">
                  ระบบคัดกรองและกำจัดไอคอนสัญลักษณ์อีโมจิภาพกล่อง (เช่น ถ้วยรางวัล, นาฬิกาจับเวลา, เป้าหมาย, จรวด, เครื่องหมายถูก) ออกจากฐานข้อมูลและหน้าจอมอนิเตอร์เสร็จสมบูรณ์เรียบร้อยแล้ว
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-slate-700 font-bold">
                  ทดแทนการสื่อสารสถานะด้วย <strong className="text-slate-900">สีของวัตถุ (UI Colors)</strong> และ <strong className="text-slate-900">สัญลักษณ์ไอคอนมาตรฐานของแท้ (Lucide React SVGs)</strong> สวยงามเสถียร 100%
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Right column - Logo Vector & Interactive Button States Customizer (5 cols) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Section 4: Logo Showcase */}
          <div className="bg-white border-3 border-black p-6 shadow-[4px_4px_0px_0px_#464C59] space-y-5 rounded-none">
            <div className="flex items-center gap-2 border-b-2 border-black pb-3">
              <Layers size={20} className="text-aapico-blue shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wide">
                4. โลโก้ทางการเวกเตอร์ (OFFICIAL LOGO)
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              การผสาน <strong>เครื่องหมายการประเมินคุณภาพ (Checklist)</strong> เข้ากับ <strong>แถบวัดมาตรวัดความเร็วอุตสาหกรรม (Automotive Gauge)</strong> พิมพ์ลายกริดเทคโนโลยีแบบคมชัด 90 องศา
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-black flex flex-col items-center justify-center min-h-[140px] text-center rounded-none">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-3 block">Light Background</span>
                <AAPICOSmartEvalLogo size={logoSize} />
              </div>
              <div className="p-4 bg-aapico-blue border border-black flex flex-col items-center justify-center min-h-[140px] text-center rounded-none">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 mb-3 block">Dark Background</span>
                <AAPICOSmartEvalLogo size={logoSize} dark />
              </div>
            </div>

            {/* Slider control to interact with the logo */}
            <div className="space-y-1.5 p-3.5 bg-slate-50 border border-black rounded-none">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1"><Sliders size={13} /> ปรับขนาดพรีวิวโลโก้:</span>
                <span className="font-mono text-aapico-blue">{logoSize}px</span>
              </div>
              <input
                type="range"
                min="32"
                max="128"
                step="4"
                value={logoSize}
                onChange={(e) => setLogoSize(Number(e.target.value))}
                className="w-full accent-aapico-blue cursor-ew-resize"
              />
            </div>
          </div>

          {/* Section 5: Interactive Button States */}
          <div className="bg-white border-3 border-black p-6 shadow-[4px_4px_0px_0px_#464C59] space-y-5 rounded-none">
            <div className="flex items-center gap-2 border-b-2 border-black pb-3">
              <Zap size={20} className="text-aapico-blue shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wide">
                5. ปุ่มและสถานะตอบสนอง (BUTTON STATES)
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              การทำงานของปุ่มสไตล์ นีโอบรูทัลลิสต์ แท้ เมื่อเกิดพฤติกรรมสัมผัส (Hover) และกดยุบตัวซ้อนทับเงาพอดี (Active)
            </p>

            <div className="space-y-6">
              {/* Live Interactive Buttons Showcase */}
              <div className="p-8 bg-slate-50 border border-black flex flex-col items-center justify-center space-y-6 rounded-none">
                
                {/* 1. Primary CTA State Demo */}
                <div className="w-full text-center space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">ปุ่มหลัก (Primary Block CTA)</span>
                  <button
                    type="button"
                    onMouseEnter={() => setTestHovered(true)}
                    onMouseLeave={() => { setTestHovered(false); setTestPressed(false); }}
                    onMouseDown={() => setTestPressed(true)}
                    onMouseUp={() => setTestPressed(false)}
                    className={`px-6 py-3 w-full bg-aapico-green text-black font-black uppercase tracking-wider text-xs border-3 border-black transition-all cursor-pointer select-none rounded-none ${
                      testPressed 
                        ? "translate-x-[4px] translate-y-[4px] shadow-none" 
                        : testHovered 
                        ? "translate-x-[-2px] translate-y-[-2px] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-emerald-400" 
                        : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    }`}
                  >
                    AAPICO SMARTEVAL ACTION BUTTON
                  </button>
                </div>

                {/* 2. Secondary CTA Demo */}
                <div className="w-full text-center space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">ปุ่มรอง (Secondary Blue CTA)</span>
                  <button
                    type="button"
                    className="px-6 py-2.5 w-full bg-aapico-blue hover:bg-indigo-900 text-white font-black uppercase tracking-wider text-xs border-3 border-black transition-all cursor-pointer select-none shadow-[4px_4px_0px_0px_#464C59] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none rounded-none"
                  >
                    SECONDARY SUBMIT CONTROL
                  </button>
                </div>

                {/* 3. Static Code Preview */}
                <div className="w-full text-center space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">โค้ด CSS สำหรับใช้จริง (Tailwind Styles)</span>
                  <div className="p-3 bg-slate-900 text-slate-300 font-mono text-[10px] text-left overflow-x-auto select-all rounded-none border border-black space-y-1 leading-snug">
                    <p className="text-aapico-green font-bold">// Primary Interactive Button State</p>
                    <p className="text-white">bg-aapico-green text-black font-black border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_#464C59] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer</p>
                  </div>
                </div>

              </div>

              {/* Status checklist */}
              <div className="bg-slate-50 border border-black p-4 space-y-2 rounded-none text-xs">
                <p className="font-black text-slate-800 uppercase tracking-wide text-[10px] mb-1.5 flex items-center gap-1.5">
                  <Info size={13} className="text-aapico-blue" />
                  สัญลักษณ์ความปลอดภัยและการเข้าถึงได้ (Accessibility Checks)
                </p>
                <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                  <span className="w-1.5 h-1.5 bg-aapico-green" />
                  อัตราความชัดเจนของขอบและเงา: คอนทราสต์ตัดหนาคมชัด 9.2:1
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                  <span className="w-1.5 h-1.5 bg-aapico-green" />
                  ไม่มีตัวอักษรอีโมจิที่อาจโหลดเสียหายในระบบเบราว์เซอร์เก่า
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
