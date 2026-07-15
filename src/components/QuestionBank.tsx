import React, { useState, useEffect, useRef } from "react";
import { QuestionBankItem } from "../types";
import { 
  Plus, Search, Edit2, Trash2, Upload, FileCode, CheckCircle2, 
  AlertTriangle, Clipboard, ClipboardCheck, Filter, Layers, HelpCircle,
  ArrowLeft, BookOpen, Clock, AlertCircle
} from "lucide-react";
import { showSuccess, showError, showWarning, showConfirm } from "../lib/swal";

interface ExamPacket {
  id: string;
  name: string;
  createdAt: string;
}

export default function QuestionBank() {
  const [packets, setPackets] = useState<ExamPacket[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Navigation & Packet focus
  const [currentPacket, setCurrentPacket] = useState<ExamPacket | null>(null);
  
  // Create Packet State
  const [newPacketName, setNewPacketName] = useState("");
  const [creatingPacket, setCreatingPacket] = useState(false);

  // Question Create / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null);
  
  // Form fields
  const [formText, setFormText] = useState("");
  const [formOptions, setFormOptions] = useState<string[]>(["", "", "", ""]);
  const [formCorrectIndex, setFormCorrectIndex] = useState(0);
  const [formExplanation, setFormExplanation] = useState("");

  // Bulk Import state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<any[] | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Packets
      const packetRes = await fetch("/api/packets");
      if (!packetRes.ok) throw new Error("Failed to fetch packets");
      const packetData = await packetRes.json();
      setPackets(packetData);

      // Fetch Questions
      const qRes = await fetch("/api/questions");
      if (!qRes.ok) throw new Error("Failed to fetch questions");
      const qData = await qRes.json();
      setQuestions(qData);
    } catch (err: any) {
      showError("เกิดข้อผิดพลาด", "ไม่สามารถดึงข้อมูลคลังข้อสอบได้: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create Exam Packet
  const handleCreatePacket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPacketName.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณากรอกชื่อชุดข้อสอบ");
      return;
    }

    try {
      setCreatingPacket(true);
      const res = await fetch("/api/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPacketName.trim() })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "สร้างชุดข้อสอบไม่สำเร็จ");
      }

      const newP = await res.json();
      showSuccess("สร้างสำเร็จ", "สร้างชุดข้อสอบแยกเฉพาะเรียบร้อยแล้ว");
      setNewPacketName("");
      await fetchData();
      
      // Focus into the newly created packet immediately
      if (newP.id) {
        setCurrentPacket({ id: newP.id, name: newP.name, createdAt: new Date().toISOString() });
      }
    } catch (err: any) {
      showError("สร้างไม่สำเร็จ", err.message);
    } finally {
      setCreatingPacket(false);
    }
  };

  // Delete Exam Packet
  const handleDeletePacket = async (packet: ExamPacket) => {
    const isConfirmed = await showConfirm(
      `คุณต้องการลบชุดข้อสอบ "${packet.name}" หรือไม่?`,
      "ข้อมูลข้อสอบทั้งหมดที่อยู่ภายในชุดนี้จะถูกลบออกอย่างถาวรและไม่สามารถกู้คืนได้ เพื่อความเป็นอิสระและเด็ดขาดของแต่ละชุดข้อสอบ"
    );

    if (isConfirmed) {
      try {
        const res = await fetch(`/api/packets/${packet.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("ไม่สามารถลบชุดข้อสอบได้");
        showSuccess("ลบสำเร็จ", "ลบชุดข้อสอบและคำถามทั้งหมดเรียบร้อยแล้ว");
        if (currentPacket?.id === packet.id) {
          setCurrentPacket(null);
        }
        await fetchData();
      } catch (err: any) {
        showError("เกิดข้อผิดพลาด", err.message);
      }
    }
  };

  const resetForm = () => {
    setFormText("");
    setFormOptions(["", "", "", ""]);
    setFormCorrectIndex(0);
    setFormExplanation("");
    setEditingQuestion(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (q: QuestionBankItem) => {
    setEditingQuestion(q);
    setFormText(q.text);
    setFormOptions(q.options.length > 0 ? [...q.options] : ["", "", "", ""]);
    setFormCorrectIndex(q.correctIndex);
    setFormExplanation(q.explanation);
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPacket) return;

    if (!formText.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณากรอกหัวข้อคำถาม");
      return;
    }

    const filteredOptions = formOptions.map(o => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      showWarning("ข้อมูลไม่ครบถ้วน", "ข้อสอบต้องมีอย่างน้อย 2 ตัวเลือกขึ้นไป");
      return;
    }

    if (formCorrectIndex < 0 || formCorrectIndex >= filteredOptions.length) {
      showWarning("ระบุข้อถูกผิดพลาด", "ตำแหน่งข้อที่ถูกต้องต้องสัมพันธ์กับจำนวนตัวเลือก");
      return;
    }

    const payload = {
      text: formText.trim(),
      options: filteredOptions,
      correctIndex: formCorrectIndex,
      explanation: formExplanation.trim(),
      packetId: currentPacket.id
    };

    try {
      const url = editingQuestion ? `/api/questions/${editingQuestion.id}` : "/api/questions";
      const method = editingQuestion ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("บันทึกข้อมูลไม่สำเร็จ");
      
      showSuccess("บันทึกสำเร็จ", "จัดเก็บข้อมูลข้อสอบในชุดข้อสอบเรียบร้อยแล้ว");
      setIsModalOpen(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      showError("เกิดข้อผิดพลาด", err.message);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    const isConfirmed = await showConfirm(
      "คุณแน่ใจหรือไม่?",
      "การลบข้อสอบนี้จะทำให้ข้อสอบหลุดออกจากชุดข้อสอบ และไม่สามารถกู้คืนได้"
    );

    if (isConfirmed) {
      try {
        const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("ไม่สามารถลบข้อสอบได้");
        showSuccess("ลบสำเร็จ", "ลบข้อสอบออกจากชุดข้อสอบเรียบร้อยแล้ว");
        await fetchData();
      } catch (err: any) {
        showError("เกิดข้อผิดพลาด", err.message);
      }
    }
  };

  // Bulk uploads validation
  const sampleSchema = [
    {
      text: "ภาษาใดใช้สำหรับเขียนสไตล์ตกแต่งเว็บเพจให้สวยงาม?",
      options: ["CSS", "HTML", "JavaScript", "SQL"],
      correctIndex: 0,
      explanation: "CSS (Cascading Style Sheets) ใช้สำหรับการระบุสไตล์ เลย์เอาต์ และตกแต่ง"
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
      setBulkError(null);
      if (!text.trim()) {
        setParsedQuestions(null);
        return;
      }

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error("โครงสร้าง JSON ต้องเป็น Array ของรายการคำถาม");
      }

      const validated: any[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (typeof item.text !== "string" || !item.text.trim()) {
          throw new Error(`ข้อที่ ${i + 1}: จำเป็นต้องระบุ 'text' เป็นข้อความคำถาม`);
        }
        if (!Array.isArray(item.options) || item.options.length < 2) {
          throw new Error(`ข้อที่ ${i + 1}: 'options' ต้องเป็น Array ของตัวเลือก มีอย่างน้อย 2 ตัวเลือกขึ้นไป`);
        }
        if (typeof item.correctIndex !== "number" || item.correctIndex < 0 || item.correctIndex >= item.options.length) {
          throw new Error(`ข้อที่ ${i + 1}: 'correctIndex' ต้องเป็นตำแหน่งตัวเลือกที่ถูกต้อง (0 ถึง ${item.options.length - 1})`);
        }
        validated.push({
          text: item.text.trim(),
          options: item.options.map((o: any) => String(o).trim()),
          correctIndex: item.correctIndex,
          explanation: typeof item.explanation === "string" ? item.explanation.trim() : ""
        });
      }

      setParsedQuestions(validated);
    } catch (err: any) {
      setBulkError(err.message || "รูปแบบ JSON ไม่ถูกต้อง");
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

  const executeBulkImport = async () => {
    if (!parsedQuestions || !currentPacket) return;
    try {
      const res = await fetch("/api/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          questions: parsedQuestions,
          packetId: currentPacket.id 
        })
      });

      if (!res.ok) throw new Error("นำเข้ารายการคำถามไม่สำเร็จ");
      
      showSuccess("นำเข้าสำเร็จ", `นำเข้าข้อสอบใหม่สำเร็จทั้งหมด ${parsedQuestions.length} ข้อในชุดข้อสอบนี้`);

      setJsonText("");
      setParsedQuestions(null);
      setIsBulkOpen(false);
      await fetchData();
    } catch (err: any) {
      showError("เกิดข้อผิดพลาด", err.message);
    }
  };

  // Group questions by packetId to count
  const getQuestionCount = (packetId: string) => {
    return questions.filter(q => q.packetId === packetId).length;
  };

  // Filtered questions inside current active packet
  const activePacketQuestions = questions.filter(q => {
    if (!currentPacket) return false;
    if (q.packetId !== currentPacket.id) return false;
    
    return q.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (q.explanation || "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 overflow-hidden text-left">
      {/* 1. Packets Selection View */}
      {!currentPacket ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b-3 border-black">
            <div>
              <h2 className="text-xl font-black text-aapico-blue font-sans uppercase tracking-tight">คลังข้อสอบส่วนกลาง (Central Question Bank)</h2>
              <p className="text-xs text-slate-500 font-medium">จัดการข้อสอบเป็นรายชุดข้อสอบแยกอิสระจากกันอย่างเด็ดขาด</p>
            </div>
          </div>

          {/* Create Packet Form */}
          <div className="bg-slate-50 p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59]">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">สร้างชุดข้อสอบใหม่ (Exam Packet)</h3>
            <form onSubmit={handleCreatePacket} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="กรอกชื่อชุดข้อสอบ เช่น ชุดข้อสอบพื้นฐาน HTML, ชุดสอบปฏิบัติการระบบเครือข่าย..."
                value={newPacketName}
                onChange={(e) => setNewPacketName(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border-3 border-black rounded-none text-xs font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                required
              />
              <button
                type="submit"
                disabled={creatingPacket}
                className="px-6 py-3 bg-aapico-green hover:bg-emerald-400 text-black rounded-none text-xs font-black uppercase tracking-wider border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus size={14} />
                สร้างชุดข้อสอบ
              </button>
            </form>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">
              * ระบบแยกแยะคลังข้อสอบตามชุดข้อสอบอย่างชัดเจน คุณต้องสร้างชุดข้อสอบก่อนจึงจะเริ่มเพิ่มรายข้อได้
            </p>
          </div>

          {/* Packets Grid */}
          {loading ? (
            <div className="py-12 text-center text-xs font-black text-slate-500 uppercase tracking-widest font-mono">กำลังโหลดชุดข้อสอบ...</div>
          ) : packets.length === 0 ? (
            <div className="py-16 text-center border-3 border-dashed border-black rounded-none bg-slate-50">
              <Layers className="mx-auto text-slate-400 mb-3" size={32} />
              <p className="text-sm font-black text-slate-800">ยังไม่มีชุดข้อสอบในระบบ</p>
              <p className="text-xs text-slate-400 mt-1">กรุณากรอกชื่อด้านบนแล้วกด "สร้างชุดข้อสอบ" เพื่อเริ่มใช้งาน</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-black text-slate-500 uppercase tracking-wider font-mono">
                ชุดข้อสอบอิสระในระบบ ({packets.length} ชุด)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packets.map((p) => {
                  const qCount = getQuestionCount(p.id);
                  return (
                    <div 
                      key={p.id} 
                      className="p-5 bg-white border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex flex-col justify-between gap-4 hover:translate-y-[-1px] transition-all"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-aapico-blue">
                          <Layers size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest font-mono">INDEPENDENT EXAM PACKET</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-950 leading-snug">{p.name}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                          <span>จำนวนโจทย์:</span>
                          <span className="px-2 py-0.5 bg-slate-100 border border-black rounded-none text-slate-800 text-[10px] font-black font-mono">
                            {qCount} ข้อ
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t-3 border-dashed border-black pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm("");
                            setCurrentPacket(p);
                          }}
                          className="flex-1 py-2.5 bg-aapico-blue hover:bg-indigo-900 text-white rounded-none text-[11px] font-black uppercase tracking-wider border-3 border-black shadow-[3px_3px_0px_0px_#464C59] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer text-center"
                        >
                          ดู / จัดการข้อสอบ ({qCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePacket(p)}
                          className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-none border-3 border-black transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                          title="ลบชุดข้อสอบทั้งหมด"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 2. Questions Management inside Chosen Packet */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b-3 border-black">
            <div className="space-y-1">
              <button
                onClick={() => setCurrentPacket(null)}
                className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-aapico-blue hover:text-indigo-900 tracking-wider transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                กลับหน้าชุดข้อสอบทั้งหมด
              </button>
              <h2 className="text-lg sm:text-xl font-black text-slate-950 font-sans tracking-tight uppercase flex items-center gap-2 mt-1">
                <Layers className="text-aapico-blue" size={20} />
                {currentPacket.name}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                จัดการรายการโจทย์และอิมพอร์ตข้อสอบเฉพาะชุดนี้อย่างอิสระ ไม่ปะปนกับชุดข้อสอบอื่น
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                onClick={() => setIsBulkOpen(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#464C59] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Upload size={14} />
                Bulk Import
              </button>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2.5 bg-aapico-green hover:bg-emerald-400 text-black border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} />
                เพิ่มข้อสอบใหม่
              </button>
            </div>
          </div>

          {/* Search Bar inside Packet */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="ค้นหาโจทย์ หรือคำอธิบายข้อสอบในชุดนี้..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border-3 border-black rounded-none text-xs font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue"
            />
          </div>

          {/* Questions List */}
          {activePacketQuestions.length === 0 ? (
            <div className="py-16 text-center border-3 border-dashed border-black rounded-none bg-slate-50">
              <HelpCircle className="mx-auto text-slate-400 mb-2" size={32} />
              <p className="text-sm font-black text-slate-800">ยังไม่มีโจทย์ข้อสอบในชุดนี้</p>
              <p className="text-xs text-slate-400 mt-1">
                คลิกปุ่ม "เพิ่มข้อสอบใหม่" หรือใช้ "Bulk Import" เพื่อเพิ่มโจทย์ข้อสอบเฉพาะลงในชุดนี้
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-black text-slate-500 uppercase tracking-wider font-mono">
                รายการข้อสอบในชุดนี้ ({activePacketQuestions.length} ข้อ)
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {activePacketQuestions.map((q, idx) => (
                  <div 
                    key={q.id} 
                    className="p-5 bg-white border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:translate-y-[-1px] transition-all"
                  >
                    <div className="space-y-2.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-900 text-white border border-black rounded-none text-[10px] font-mono font-black">
                          ข้อที่ #{idx + 1}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-950 leading-snug">{q.text}</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 font-bold">
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = oIdx === q.correctIndex;
                          return (
                            <div key={oIdx} className={`flex items-start gap-1.5 ${isCorrect ? "text-emerald-700" : ""}`}>
                              <span className={`shrink-0 w-4 h-4 rounded-none flex items-center justify-center text-[9px] font-mono border mt-0.5 ${
                                isCorrect 
                                  ? "bg-aapico-green text-black border-black font-black" 
                                  : "bg-slate-100 text-slate-500 border-slate-300"
                              }`}>
                                {oIdx + 1}
                              </span>
                              <span className={isCorrect ? "underline decoration-2 font-black" : ""}>{opt}</span>
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-none border border-black mt-2">
                          <span className="font-black text-slate-700 uppercase">เฉลย/คำอธิบาย:</span> {q.explanation}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center pt-2 md:pt-0">
                      <button
                        onClick={() => handleOpenEditModal(q)}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-3 border-black rounded-none transition-all cursor-pointer shadow-[2px_2px_0px_0px_#464C59] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                        title="แก้ไขข้อความ"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border-3 border-black rounded-none transition-all cursor-pointer shadow-[2px_2px_0px_0px_#464C59] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                        title="ลบข้อสอบ"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. CRUD Create / Edit Question Modal */}
      {isModalOpen && currentPacket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto p-4 flex justify-center items-start sm:items-center text-left">
          {/* Backdrop click to close */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative my-auto bg-white border-4 border-black rounded-none w-full max-w-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center pb-4 border-b-3 border-black mb-6">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-slate-950 font-sans uppercase tracking-tight">
                  {editingQuestion ? "แก้ไขคำถาม" : "เพิ่มข้อสอบใหม่"}
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  เข้าสู่ชุดข้อสอบ: {currentPacket.name}
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-xs font-black uppercase tracking-wider font-mono"
              >
                [ ปิด ]
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-5">
              {/* Text */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 font-mono">โจทย์คำถาม</label>
                <textarea
                  rows={3}
                  placeholder="พิมพ์หัวข้อคำถาม หรือโจทย์สำหรับการทดสอบ..."
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-3 border-black rounded-none text-xs font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                  required
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 font-mono">รายการตัวเลือกคำตอบ</label>
                <div className="space-y-2">
                  {formOptions.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setFormCorrectIndex(oIdx)}
                        className={`w-8 h-8 rounded-none border-3 border-black flex items-center justify-center font-mono font-black text-xs transition-all cursor-pointer ${
                          formCorrectIndex === oIdx 
                            ? "bg-aapico-green text-black" 
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                        }`}
                        title={formCorrectIndex === oIdx ? "ตัวเลือกนี้เป็นข้อที่ถูก" : "ตั้งเป็นข้อที่ถูก"}
                      >
                        {oIdx + 1}
                      </button>
                      <input
                        type="text"
                        placeholder={`ระบุข้อความตัวเลือกที่ ${oIdx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...formOptions];
                          updated[oIdx] = e.target.value;
                          setFormOptions(updated);
                        }}
                        className="flex-1 px-3 py-2 bg-white border-3 border-black rounded-none text-xs font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                        required={oIdx < 2} // At least 2 options are required
                      />
                      {formOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formOptions.filter((_, i) => i !== oIdx);
                            setFormOptions(updated);
                            if (formCorrectIndex >= updated.length) {
                              setFormCorrectIndex(0);
                            }
                          }}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-none text-xs font-black cursor-pointer"
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {formOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setFormOptions([...formOptions, ""])}
                    className="mt-1 text-xs font-black uppercase text-aapico-blue hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    เพิ่มตัวเลือกข้อคำตอบ
                  </button>
                )}
              </div>

              {/* Explanation */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 font-mono">คำอธิบายเพิ่มเติมเมื่อเฉลยข้อสอบ (Explanation)</label>
                <textarea
                  rows={2}
                  placeholder="ระบุข้อความเฉลย หรือหลักคิดที่อธิบายว่าทำไมตัวเลือกนี้ถึงถูกต้อง (ไม่บังคับ)"
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-3 border-black rounded-none text-xs font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t-3 border-black">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border-3 border-black rounded-none text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-aapico-green hover:bg-emerald-400 text-black border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  บันทึกข้อสอบ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. BULK IMPORT MODAL */}
      {isBulkOpen && currentPacket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto p-4 flex justify-center items-start sm:items-center text-left">
          {/* Backdrop click to close */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsBulkOpen(false)} />
          
          <div className="relative my-auto bg-white border-4 border-black rounded-none w-full max-w-4xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center pb-4 border-b-3 border-black mb-6">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-slate-950 font-sans uppercase tracking-tight">
                  Bulk Import นำเข้าข้อสอบผ่าน JSON
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  นำเข้าสู่ชุดข้อสอบ: {currentPacket.name}
                </span>
              </div>
              <button
                onClick={() => setIsBulkOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-xs font-black uppercase tracking-wider font-mono"
              >
                [ ปิด ]
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Side */}
              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 font-mono">อัปโหลดไฟล์ หรือวางโค้ด JSON</label>
                
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
                  <Upload className={`mb-2 text-slate-800 ${dragActive ? "animate-bounce" : ""}`} size={28} />
                  <p className="text-xs text-slate-900 font-black text-center uppercase tracking-tight">
                    ลากและวางไฟล์ .json ที่นี่ หรือ <span className="text-aapico-blue underline">คลิกเพื่อเลือกไฟล์</span>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <textarea
                  rows={8}
                  placeholder={`วาง JSON ของคุณที่นี่...
ตัวอย่าง:
[
  {
    "text": "ข้อสอบข้อที่ 1...",
    "options": ["ก", "ข", "ค", "ง"],
    "correctIndex": 0,
    "explanation": "เฉลยอธิบาย..."
  }
]`}
                  value={jsonText}
                  onChange={handleTextChange}
                  className="w-full px-4 py-3 bg-slate-950 text-slate-100 rounded-none border-3 border-black font-mono text-xs focus:outline-none no-scrollbar resize-none"
                />
              </div>

              {/* Right Side */}
              <div className="space-y-4">
                <div className="p-4 bg-white border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">ตัวอย่างโครงสร้างข้อสอบ</span>
                    <button
                      type="button"
                      onClick={copySample}
                      className="inline-flex items-center gap-1 text-xs font-black uppercase text-aapico-blue hover:text-indigo-900 transition-colors cursor-pointer"
                    >
                      {copied ? <ClipboardCheck size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
                      {copied ? "คัดลอกแล้ว" : "คัดลอกโค้ด"}
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-50 text-[10px] font-mono text-slate-700 rounded-none overflow-x-auto max-h-36 border-3 border-black no-scrollbar">
                    {sampleString}
                  </pre>
                </div>

                {bulkError && (
                  <div className="flex gap-3 p-4 bg-rose-50 border-3 border-black text-rose-850 rounded-none text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <AlertTriangle className="text-rose-600 shrink-0" size={18} />
                    <div>
                      <p className="font-bold uppercase tracking-tight">ข้อผิดพลาดโครงสร้าง JSON</p>
                      <p className="text-[11px] text-rose-600 mt-1 font-mono leading-relaxed font-bold">{bulkError}</p>
                    </div>
                  </div>
                )}

                {parsedQuestions && (
                  <div className="flex flex-col p-4 bg-emerald-50 border-3 border-black text-emerald-950 rounded-none text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex gap-3">
                      <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />
                      <div>
                        <p className="font-black uppercase tracking-tight">ตรวจสอบข้อสอบเสร็จสิ้น</p>
                        <p className="text-[11px] text-emerald-700 mt-1 font-semibold">
                          พร้อมอิมพอร์ตข้อสอบทั้งหมด <span className="font-bold text-slate-950 underline">{parsedQuestions.length}</span> ข้อเข้าชุดข้อสอบนี้
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={executeBulkImport}
                      className="w-full mt-4 py-2.5 bg-aapico-green hover:bg-emerald-500 text-black border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                    >
                      ยืนยันการนำเข้าข้อสอบในชุดนี้
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
