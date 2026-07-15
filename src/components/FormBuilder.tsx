import React, { useState } from "react";
import { Question } from "../types";
import { Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

interface FormBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

export default function FormBuilder({ questions, onChange }: FormBuilderProps) {
  const addQuestion = () => {
    const newQuestion: Question = {
      id: "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      text: "",
      options: ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"],
      correctIndex: 0,
    };
    onChange([...questions, newQuestion]);
  };

  const removeQuestion = (qIndex: number) => {
    const updated = questions.filter((_, idx) => idx !== qIndex);
    onChange(updated);
  };

  const updateQuestionText = (qIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], text };
    onChange(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    const opts = [...updated[qIndex].options];
    opts.push(`ตัวเลือกที่ ${opts.length + 1}`);
    updated[qIndex] = { ...updated[qIndex], options: opts };
    onChange(updated);
  };

  const removeOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    const opts = updated[qIndex].options.filter((_, idx) => idx !== optIndex);
    
    // Adjust correctIndex if needed
    let correctIdx = updated[qIndex].correctIndex;
    if (correctIdx >= opts.length) {
      correctIdx = Math.max(0, opts.length - 1);
    }

    updated[qIndex] = { ...updated[qIndex], options: opts, correctIndex: correctIdx };
    onChange(updated);
  };

  const updateOptionText = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    const opts = [...updated[qIndex].options];
    opts[optIndex] = text;
    updated[qIndex] = { ...updated[qIndex], options: opts };
    onChange(updated);
  };

  const setCorrectOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], correctIndex: optIndex };
    onChange(updated);
  };

  const updateExplanation = (qIndex: number, explanation: string) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], explanation };
    onChange(updated);
  };

  const applyPreset = (qIndex: number, type: "4-choices" | "true-false" | "yes-no") => {
    const updated = [...questions];
    let options: string[] = [];
    if (type === "4-choices") {
      options = ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2", "ตัวเลือกที่ 3", "ตัวเลือกที่ 4"];
    } else if (type === "true-false") {
      options = ["ถูกต้อง", "ไม่ถูกต้อง"];
    } else if (type === "yes-no") {
      options = ["ใช่", "ไม่ใช่"];
    }
    updated[qIndex] = { ...updated[qIndex], options, correctIndex: 0 };
    onChange(updated);
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between border-b-3 border-black pb-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 font-sans uppercase tracking-tight">คำถามและตัวเลือก</h3>
          <p className="text-xs text-slate-500 font-medium">สร้างโจทย์คำถาม เพิ่มตัวเลือก และกำหนดคำตอบที่ถูกต้อง</p>
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-aapico-green hover:bg-emerald-400 border-3 border-black text-black rounded-none text-xs font-black uppercase tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer font-sans"
        >
          <Plus size={14} />
          เพิ่มข้อสอบใหม่
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 border-3 border-dashed border-black rounded-none bg-slate-50 shadow-[3px_3px_0px_0px_#464C59]">
          <AlertCircle className="text-slate-400 mb-2" size={32} />
          <p className="text-xs font-black uppercase tracking-wider text-slate-800">ยังไม่มีข้อสอบในชุดนี้</p>
          <p className="text-xs text-slate-500 mt-1 mb-4 font-semibold">กดปุ่มด้านล่างเพื่อเริ่มสร้างคำถามข้อแรก</p>
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-aapico-blue hover:bg-indigo-900 border-3 border-black text-white rounded-none text-xs font-black uppercase tracking-widest shadow-[3px_3px_0px_0px_#464C59] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
          >
            <Plus size={14} />
            สร้างข้อสอบข้อแรก
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {questions.map((question, qIdx) => (
            <div
              key={question.id}
              className="relative p-6 bg-white border-3 border-black rounded-none shadow-[3px_3px_0px_0px_#464C59] hover:shadow-[5px_5px_0px_0px_#464C59] transition-all"
            >
              {/* Question Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-none bg-slate-100 text-aapico-blue text-xs font-black font-mono border-3 border-black">
                  {qIdx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeQuestion(qIdx)}
                  className="text-slate-400 hover:text-rose-600 p-1.5 border border-transparent hover:border-black transition-colors cursor-pointer rounded-none font-bold"
                  title="ลบคำถามข้อนี้"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Question Text */}
              <div className="mb-4 text-left">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                  โจทย์คำถาม
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น พระอาทิตย์ขึ้นทางทิศใด?"
                  value={question.text}
                  onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                  className="w-full px-4 py-2.5 border-3 border-black rounded-none focus:outline-none focus:ring-2 focus:ring-aapico-blue text-slate-900 font-bold text-xs bg-white"
                />
              </div>

              {/* Options */}
              <div className="space-y-3 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-slate-100 pb-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">
                    ตัวเลือกและการเฉลยคำตอบ (กำหนดข้อที่ถูกต้อง)
                  </label>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[9px] font-black text-slate-400 font-mono uppercase">รูปแบบด่วน:</span>
                    <button
                      type="button"
                      onClick={() => applyPreset(qIdx, "4-choices")}
                      className="px-2 py-0.5 text-[9px] font-black uppercase rounded-none border border-black bg-slate-100 hover:bg-slate-200 text-aapico-blue transition-all cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none"
                    >
                      4 ตัวเลือก
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(qIdx, "true-false")}
                      className="px-2 py-0.5 text-[9px] font-black uppercase rounded-none border border-black bg-slate-100 hover:bg-slate-200 text-aapico-blue transition-all cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none"
                    >
                      ถูก/ผิด
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset(qIdx, "yes-no")}
                      className="px-2 py-0.5 text-[9px] font-black uppercase rounded-none border border-black bg-slate-100 hover:bg-slate-200 text-aapico-blue transition-all cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none"
                    >
                      ใช่/ไม่ใช่
                    </button>
                  </div>
                </div>

                {question.options.map((option, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-3">
                    {/* Correct Answer Selector */}
                    <button
                      type="button"
                      onClick={() => setCorrectOption(qIdx, optIdx)}
                      className={`p-1 transition-colors cursor-pointer rounded-none`}
                      title={question.correctIndex === optIdx ? "คำตอบที่ถูกต้อง" : "กำหนดเป็นคำตอบที่ถูก"}
                    >
                      <CheckCircle2 size={22} className={question.correctIndex === optIdx ? "text-aapico-green fill-emerald-100 stroke-black" : "text-slate-300"} />
                    </button>

                    {/* Option Text Input */}
                    <input
                      type="text"
                      required
                      placeholder={`ตัวเลือกที่ ${optIdx + 1}`}
                      value={option}
                      onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                      className={`flex-1 px-3 py-2 border-3 rounded-none text-xs font-bold focus:outline-none transition-all ${
                        question.correctIndex === optIdx
                          ? "border-black bg-emerald-50 text-slate-900 focus:ring-2 focus:ring-aapico-blue"
                          : "border-black focus:ring-2 focus:ring-aapico-blue text-slate-800"
                      }`}
                    />

                    {/* Remove Option */}
                    {question.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(qIdx, optIdx)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 border border-transparent hover:border-black transition-colors cursor-pointer rounded-none"
                        title="ลบตัวเลือกนี้"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addOption(qIdx)}
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-black uppercase tracking-wider text-black bg-aapico-green px-3 py-1.5 border-3 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer font-sans"
                >
                  <Plus size={14} />
                  เพิ่มตัวเลือก
                </button>
              </div>

              {/* Explanation section */}
              <div className="mt-4 pt-4 border-t-2 border-dashed border-black text-left">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 font-mono">
                  คำอธิบายเพิ่มเติมเฉลยข้อนี้ (Explanation)
                </label>
                <textarea
                  rows={2}
                  placeholder="ใส่เหตุผลอธิบายคำตอบที่ถูกต้องสำหรับข้อนี้ (จะปรากฏแก่ผู้เข้าสอบหลังจากทำสอบเสร็จและระบบเปิดให้ดูเฉลย)"
                  value={question.explanation || ""}
                  onChange={(e) => updateExplanation(qIdx, e.target.value)}
                  className="w-full px-3.5 py-2 border-3 border-black rounded-none focus:outline-none focus:ring-2 focus:ring-aapico-blue text-slate-800 font-semibold text-xs bg-white"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
