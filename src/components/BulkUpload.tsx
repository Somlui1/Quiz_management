import React, { useState, useRef } from "react";
import { Question } from "../types";
import { Upload, FileCode, CheckCircle2, AlertTriangle, Clipboard, ClipboardCheck } from "lucide-react";

interface BulkUploadProps {
  onImport: (questions: Question[], mode: "append" | "replace") => void;
}

export default function BulkUpload({ onImport }: BulkUploadProps) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<Question[] | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const sampleSchema = [
    {
      text: "พระอาทิตย์ขึ้นทางทิศใด?",
      options: ["ทิศเหนือ", "ทิศใต้", "ทิศตะวันออก", "ทิศตะวันตก"],
      correctIndex: 2,
      explanation: "เพราะโลกหมุนรอบตัวเองจากทิศตะวันตกไปทิศตะวันออก ทำให้เรามองเห็นพระอาทิตย์ขึ้นทางทิศตะวันออก"
    },
    {
      text: "เมืองหลวงของประเทศไทยคือเมืองใด?",
      options: ["เชียงใหม่", "กรุงเทพมหานคร", "ภูเก็ต", "ขอนแก่น"],
      correctIndex: 1,
      explanation: "กรุงเทพมหานครเป็นเมืองหลวงและศูนย์กลางการปกครองของประเทศไทย"
    }
  ];

  const sampleString = JSON.stringify(sampleSchema, null, 2);

  const copySample = () => {
    navigator.clipboard.writeText(sampleString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateAndParse = (text: string) => {
    try {
      setError(null);
      if (!text.trim()) {
        setParsedQuestions(null);
        return;
      }

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error("โครงสร้าง JSON ต้องเป็น Array (รายการของข้อสอบ)");
      }

      const validatedQuestions: Question[] = [];

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (typeof item.text !== "string" || !item.text.trim()) {
          throw new Error(`ข้อที่ ${i + 1}: จำเป็นต้องระบุ 'text' เป็นข้อความคำถาม`);
        }
        if (!Array.isArray(item.options) || item.options.length < 2) {
          throw new Error(`ข้อที่ ${i + 1}: 'options' ต้องเป็น Array ของตัวเลือก และมีอย่างน้อย 2 ตัวเลือกขึ้นไป`);
        }
        for (let j = 0; j < item.options.length; j++) {
          if (typeof item.options[j] !== "string" || !item.options[j].trim()) {
            throw new Error(`ข้อที่ ${i + 1} ตัวเลือกที่ ${j + 1}: ตัวเลือกใน options ต้องเป็นข้อความที่ไม่ว่างเปล่า`);
          }
        }
        if (typeof item.correctIndex !== "number" || item.correctIndex < 0 || item.correctIndex >= item.options.length) {
          throw new Error(`ข้อที่ ${i + 1}: 'correctIndex' ต้องเป็นตัวเลขระบุตำแหน่งข้อที่ถูก (ตั้งแต่ 0 ถึง ${item.options.length - 1})`);
        }

        validatedQuestions.push({
          id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9) + "_" + i,
          text: item.text.trim(),
          options: item.options.map((o: string) => o.trim()),
          correctIndex: item.correctIndex,
          explanation: typeof item.explanation === "string" ? item.explanation.trim() : ""
        });
      }

      setParsedQuestions(validatedQuestions);
      setError(null);
    } catch (err: any) {
      setError(err.message || "รูปแบบ JSON ไม่ถูกต้อง");
      setParsedQuestions(null);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonText(val);
    validateAndParse(val);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setJsonText(result);
      validateAndParse(result);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setJsonText(result);
        validateAndParse(result);
      };
      reader.readAsText(file);
    }
  };

  const executeImport = (mode: "append" | "replace") => {
    if (!parsedQuestions) return;
    onImport(parsedQuestions, mode);
    setJsonText("");
    setParsedQuestions(null);
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h3 className="text-sm font-black text-slate-900 font-sans uppercase tracking-tight">นำเข้าข้อสอบผ่าน JSON Schema</h3>
        <p className="text-xs text-slate-500 font-medium">คุณสามารถอัปโหลดไฟล์ .json หรือคัดลอก JSON โครงสร้างด้านล่างมาวางเพื่อนำเข้าข้อสอบทีละมากๆ ได้ทันที</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Upload / Paste */}
        <div className="space-y-4">
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-650 font-mono">อัปโหลดไฟล์ หรือวางโค้ด JSON</label>
          
          {/* Drag & Drop Box */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center p-6 border-3 border-dashed rounded-none transition-all cursor-pointer ${
              dragActive
                ? "border-aapico-blue bg-indigo-50/20"
                : "border-black bg-slate-50 hover:bg-slate-100"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`mb-2 ${dragActive ? "text-aapico-blue animate-bounce" : "text-slate-850"}`} size={28} />
            <p className="text-xs text-slate-900 font-black text-center uppercase tracking-tight">
              ลากและวางไฟล์ .json ที่นี่ หรือ <span className="text-aapico-blue underline">คลิกเพื่อเลือกไฟล์</span>
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">ขนาดสูงสุด 5MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Paste JSON Text Area */}
          <div className="relative">
            <textarea
              rows={12}
              placeholder={`วาง JSON ของคุณที่นี่...
ตัวอย่าง:
[
  {
    "text": "ข้อสอบข้อที่ 1...",
    "options": ["ก", "ข", "ค"],
    "correctIndex": 0
  }
]`}
              value={jsonText}
              onChange={handleTextChange}
              className="w-full px-4 py-3 bg-white text-slate-950 rounded-none border-3 border-black font-mono text-xs focus:outline-none focus:ring-2 focus:ring-aapico-blue no-scrollbar resize-none placeholder-slate-400"
            />
          </div>
        </div>

        {/* Right Side: Sample & Validation Feedback */}
        <div className="space-y-4">
          <div className="p-4 bg-white border-3 border-black rounded-none shadow-[3px_3px_0px_0px_#464C59]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">โครงสร้างแบบตัวอย่าง (JSON Schema)</span>
              <button
                type="button"
                onClick={copySample}
                className="inline-flex items-center gap-1 text-xs font-black uppercase text-aapico-blue hover:text-indigo-900 transition-colors cursor-pointer font-mono"
              >
                {copied ? <ClipboardCheck size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
                {copied ? "คัดลอกแล้ว" : "คัดลอกโค้ด"}
              </button>
            </div>
            <pre className="p-3 bg-slate-50 text-[11px] font-mono text-slate-700 rounded-none overflow-x-auto max-h-56 border-3 border-black no-scrollbar">
              {sampleString}
            </pre>
          </div>

          {/* Feedbacks */}
          {error && (
            <div className="flex gap-3 p-4 bg-rose-50 border-3 border-black text-rose-850 rounded-none text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <AlertTriangle className="text-rose-600 shrink-0" size={18} />
              <div>
                <p className="font-bold uppercase tracking-tight">ตรวจสอบความถูกต้องล้มเหลว</p>
                <p className="text-xs text-rose-600 mt-1 font-mono leading-relaxed font-bold">{error}</p>
              </div>
            </div>
          )}

          {parsedQuestions && (
            <div className="flex flex-col p-4 bg-emerald-50 border-3 border-black text-emerald-950 rounded-none text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
                <div>
                  <p className="font-black uppercase tracking-tight">ตรวจสอบเสร็จสมบูรณ์!</p>
                  <p className="text-xs text-emerald-700 mt-1 font-semibold">
                    พบข้อสอบที่ถูกต้องทั้งหมด <span className="font-bold text-slate-950 underline">{parsedQuestions.length}</span> ข้อ
                  </p>
                </div>
              </div>

              {/* Import Actions */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t-3 border-black">
                <button
                  type="button"
                  onClick={() => executeImport("append")}
                  className="flex-1 px-3 py-2 bg-aapico-green hover:bg-emerald-400 text-black border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                >
                  เพิ่มต่อจากของเดิม
                </button>
                <button
                  type="button"
                  onClick={() => executeImport("replace")}
                  className="flex-1 px-3 py-2 bg-aapico-blue hover:bg-indigo-900 text-white border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                >
                  เขียนทับทั้งหมด
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
