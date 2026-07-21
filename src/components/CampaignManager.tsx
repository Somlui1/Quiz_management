import React, { useState, useEffect, useRef } from "react";
import { Campaign, Question } from "../types";
import FormBuilder from "./FormBuilder";
import BulkUpload from "./BulkUpload";
import CampaignAnalytics from "./CampaignAnalytics";
import { showSuccess, showError, showWarning, showConfirm, showPrompt } from "../lib/swal";
import { 
  Play, Square, Trash2, Edit, BarChart3, Plus, 
  Link2, Calendar, Clock, CheckCircle, ShieldAlert, 
  Copy, Check, FileText, ChevronRight, ArrowLeft, ArrowRight, Eye, HelpCircle, AlertCircle, Award, RotateCcw, Settings, Search, Layers,
  ShoppingCart, ShoppingBag, X, Filter, MoreVertical, GripVertical
} from "lucide-react";

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation states
  const [view, setView] = useState<"list" | "create" | "edit" | "analytics">("list");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Form states
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formGroupName, setFormGroupName] = useState("");
  const [formPassingPercentage, setFormPassingPercentage] = useState<number>(60);
  const [formTimeLimitMinutes, setFormTimeLimitMinutes] = useState<number>(30);
  const [formIsUntimed, setFormIsUntimed] = useState<boolean>(false);
  const [formTotalQuestionsToTest, setFormTotalQuestionsToTest] = useState<number>(0);
  const [formMaxAttempts, setFormMaxAttempts] = useState<number>(0);
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formResultsDisplayMode, setFormResultsDisplayMode] = useState<string>("full");
  const [formRandomizationMode, setFormRandomizationMode] = useState<string>("static");
  const [formQuestions, setFormQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState<"builder" | "bulk">("builder");

  // Share Dialog Overlay
  const [shareCampaign, setShareCampaign] = useState<Campaign | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copiedCampaignId, setCopiedCampaignId] = useState<string | null>(null);

  // Dropdown states for admin operations
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Drag and drop state for campaigns reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragEnabled, setDragEnabled] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (openDropdownId) {
        const target = e.target as HTMLElement;
        if (!target.closest(".admin-dropdown-container")) {
          setOpenDropdownId(null);
        }
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [openDropdownId]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (view !== "list") return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newCampaigns = [...campaigns];
    const draggedItem = newCampaigns[draggedIndex];
    
    newCampaigns.splice(draggedIndex, 1);
    newCampaigns.splice(index, 0, draggedItem);
    
    setCampaigns(newCampaigns);

    try {
      const ids = newCampaigns.map(c => c.id);
      const res = await fetch("/api/campaigns/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) {
        throw new Error("Failed to save reordered campaigns");
      }
    } catch (err: any) {
      console.error("Reorder failed:", err);
      fetchCampaigns(true);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleCopyCampaignId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedCampaignId(id);
    setTimeout(() => {
      setCopiedCampaignId(null);
    }, 2000);
  };

  // Central Question Bank States
  const [formQuestionSelectionMode, setFormQuestionSelectionMode] = useState<"manual" | "random">("manual");
  const [formManualQuestionIds, setFormManualQuestionIds] = useState<string[]>([]);
  const [formTargetBooklet, setFormTargetBooklet] = useState<string>("");
  const [formRuleCount, setFormRuleCount] = useState<number>(10);
  const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false);
  
  // Modal Scrolling & Skip Button states
  const modalScrollContainerRef = useRef<HTMLDivElement>(null);
  const modalFooterRef = useRef<HTMLDivElement>(null);
  const [showModalScrollBtn, setShowModalScrollBtn] = useState(true);

  useEffect(() => {
    if (isSelectorModalOpen) {
      setShowModalScrollBtn(true);
    }
  }, [isSelectorModalOpen]);
  
  // Loaded Question Bank items and Packets
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [packets, setPackets] = useState<any[]>([]);
  const [bankSearchTerm, setBankSearchTerm] = useState("");

  // Sync manual question selections to formQuestions
  useEffect(() => {
    if (formQuestionSelectionMode === "manual") {
      const selected = bankQuestions.filter(q => formManualQuestionIds.includes(q.id));
      setFormQuestions(selected);
    }
  }, [formManualQuestionIds, bankQuestions, formQuestionSelectionMode]);

  useEffect(() => {
    fetchCampaigns();
    fetchBankQuestions();
    fetchPackets();
  }, []);

  // Subscribe to real-time campaign list updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      const token = localStorage.getItem("authenticated_admin_token") || "";
      console.log("[SSE] Connecting to Campaign Updates stream...");
      eventSource = new EventSource(`/api/campaigns/updates-sse?token=${encodeURIComponent(token)}`);

      eventSource.onopen = () => {
        console.log("[SSE] Campaign Updates connection established successfully.");
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[SSE] Received campaign event:", data);
          if (data.type === "campaigns-changed") {
            console.log("[SSE] Campaigns updated on server. Reloading list silently...");
            fetchCampaigns(true); // Silent reload
          }
        } catch (e) {
          console.error("[SSE] Error parsing campaign update message:", e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("[SSE] Campaign updates stream disconnected or errored. Reconnecting in 3 seconds...", err);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  // Tour Step Synchronizer for Proctor Dashboard
  useEffect(() => {
    const applyStep7State = () => {
      const mockCamp = {
        id: "tour-demo-quiz",
        name: "ควิซสาธิตระบบ (Demo Quiz)",
        groupName: "กลุ่มทดสอบ (Web Guided Tour)",
        passingPercentage: 60,
        timeLimitMinutes: 5,
        questions: [],
        resultsDisplayMode: "full",
        randomizationMode: "question_choice",
        createdAt: new Date().toISOString()
      } as any;
      setSelectedCampaign(mockCamp);
      setView("analytics");
    };

    // 1. Instantly check localStorage on mount
    try {
      const savedTourActive = localStorage.getItem("aapico_tour_active") === "true";
      const savedTourStep = localStorage.getItem("aapico_tour_step");
      if (savedTourActive && savedTourStep === "7") {
        applyStep7State();
      }
    } catch (_) {}

    // 2. Fallback Event Listener
    const handleTourStepChange = (e: CustomEvent) => {
      const step = e.detail.step;
      if (step === 7) {
        applyStep7State();
      }
    };
    window.addEventListener("tour-step-changed", handleTourStepChange as any);
    return () => {
      window.removeEventListener("tour-step-changed", handleTourStepChange as any);
    };
  }, []);

  const fetchPackets = async () => {
    try {
      const res = await fetch("/api/packets");
      if (res.ok) {
        const data = await res.json();
        setPackets(data);
        if (data.length > 0 && !formTargetBooklet) {
          setFormTargetBooklet(data[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to load packets:", err);
    }
  };

  const fetchBankQuestions = async () => {
    try {
      const res = await fetch("/api/questions");
      if (res.ok) {
        const data = await res.json();
        setBankQuestions(data);
      }
    } catch (err) {
      console.error("Failed to load bank questions:", err);
    }
  };

  const fetchCampaigns = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/campaigns?_ts=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to load campaigns");
      const data = await res.json();
      setCampaigns(data);
    } catch (err: any) {
      if (!silent) setError(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลห้องสอบ");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCreateNew = () => {
    // Generate simple readable unique short ID
    const shortId = "camp_" + Math.random().toString(36).substr(2, 6);
    setFormId(shortId);
    setFormName("");
    setFormGroupName("");
    setFormPassingPercentage(60);
    setFormTimeLimitMinutes(30);
    setFormIsUntimed(false);
    setFormTotalQuestionsToTest(0);
    setFormMaxAttempts(0);
    setFormStartTime("");
    setFormEndTime("");
    setFormResultsDisplayMode("full");
    setFormRandomizationMode("static");
    setFormQuestions([]);
    setFormQuestionSelectionMode("manual");
    setFormManualQuestionIds([]);
    setFormTargetBooklet(packets[0]?.name || "");
    setFormRuleCount(10);
    fetchBankQuestions();
    fetchPackets();
    setActiveTab("builder");
    setView("create");
  };

  const handleEdit = (camp: Campaign) => {
    setSelectedCampaign(camp);
    setFormId(camp.id);
    setFormName(camp.name);
    setFormGroupName(camp.groupName);
    setFormPassingPercentage(camp.passingPercentage);
    setFormTimeLimitMinutes(camp.timeLimitMinutes);
    setFormIsUntimed(camp.isUntimed || false);
    setFormTotalQuestionsToTest(camp.totalQuestionsToTest || 0);
    setFormMaxAttempts(camp.maxAttempts || 0);
    setFormStartTime(camp.startTime ? new Date(camp.startTime).toISOString().slice(0, 16) : "");
    setFormEndTime(camp.endTime ? new Date(camp.endTime).toISOString().slice(0, 16) : "");
    setFormResultsDisplayMode(camp.resultsDisplayMode || "full");
    setFormRandomizationMode(camp.randomizationMode || "static");
    setFormQuestions(camp.questions || []);
    setFormQuestionSelectionMode(camp.questionSelectionMode || "manual");
    setFormManualQuestionIds(camp.manualQuestionIds || []);
    setFormTargetBooklet(camp.targetBooklet || (packets[0]?.name || ""));
    setFormRuleCount(camp.ruleCount || 10);
    fetchBankQuestions();
    setActiveTab("builder");
    setView("edit");
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formGroupName.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (formQuestionSelectionMode === "manual" && formManualQuestionIds.length === 0) {
      showWarning("ยังไม่ได้เลือกข้อสอบ", "กรุณาเลือกข้อสอบจากคลังอย่างน้อย 1 ข้อ");
      return;
    }

    if (formQuestionSelectionMode === "random" && (!formTargetBooklet || formRuleCount <= 0)) {
      showWarning("การตั้งกฎไม่ถูกต้อง", "กรุณาเลือกชุดข้อสอบและกำหนดจำนวนข้อสอบให้ถูกต้อง");
      return;
    }

    const payload = {
      id: formId,
      name: formName.trim(),
      groupName: formGroupName.trim(),
      status: view === "edit" ? selectedCampaign?.status || "DRAFT" : "DRAFT",
      startTime: formStartTime ? new Date(formStartTime).toISOString() : null,
      endTime: formEndTime ? new Date(formEndTime).toISOString() : null,
      passingPercentage: Number(formPassingPercentage),
      timeLimitMinutes: Number(formTimeLimitMinutes),
      isUntimed: formIsUntimed,
      totalQuestionsToTest: formQuestionSelectionMode === "random" ? 0 : Number(formTotalQuestionsToTest),
      maxAttempts: Number(formMaxAttempts),
      resultsDisplayMode: formResultsDisplayMode,
      randomizationMode: formRandomizationMode,
      questions: formQuestions,
      questionSelectionMode: formQuestionSelectionMode,
      manualQuestionIds: formManualQuestionIds,
      ruleCategory: "",
      ruleDifficulty: "all",
      ruleCount: Number(formRuleCount),
      targetBooklet: formTargetBooklet,
    };

    try {
      const url = view === "edit" ? `/api/campaigns/${formId}` : "/api/campaigns";
      const method = view === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึก");
      }

      showSuccess("บันทึกห้องสอบสำเร็จ", "บันทึกรายละเอียดและข้อสอบของห้องสอบเรียบร้อยแล้ว");
      fetchCampaigns();
      setView("list");
    } catch (err: any) {
      showError("ไม่สามารถบันทึกได้", err.message);
    }
  };

  const handleDelete = async (id: string) => {
    const targetCamp = campaigns.find(c => c.id === id);
    if (targetCamp && targetCamp.status === "ACTIVE") {
      showError("ไม่สามารถลบห้องสอบได้", "ห้ามลบห้องสอบในระหว่างที่ระบบสอบเปิดใช้งานอยู่ (ACTIVE) กรุณาปิดระบบสอบก่อนการลบ");
      return;
    }

    const confirmed = await showConfirm(
      "คุณแน่ใจหรือไม่ที่จะลบห้องสอบนี้?",
      "ข้อมูลรายชื่อและคะแนนสอบทั้งหมดในห้องสอบนี้จะถูกลบอย่างถาวรและไม่สามารถกู้คืนได้"
    );
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "เกิดข้อผิดพลาดในการลบแคมเปญ");
      }
      showSuccess("ลบห้องสอบแล้ว", "ลบห้องสอบข้อสอบเสร็จสิ้น");
      fetchCampaigns();
    } catch (err: any) {
      showError("ไม่สามารถลบได้", err.message);
    }
  };

  const handleResetCampaign = async (id: string, name: string) => {
    const confirmed = await showConfirm(
      `ยืนยันการรีเซ็ตข้อมูลห้องสอบ?`,
      `ข้อมูลรายชื่อทั้งหมดในสมุดเช็คชื่อ (Focus Group) และประวัติ/คะแนนการเข้าสอบทั้งหมดเฉพาะห้องสอบ "${name}" จะถูกล้างข้อมูลทั้งหมดจนเป็นศูนย์\n\nคำเตือน: การรีเซ็ตนี้ไม่สามารถกู้คืนได้ คุณต้องการดำเนินการต่อหรือไม่?`
    );
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/campaigns/${id}/reset`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "เกิดข้อผิดพลาดในการรีเซ็ตห้องสอบ");
      }
      
      // Also clear local storage of the attendance focus group list for this specific campaign
      try {
        localStorage.removeItem(`campaign_attendance_focus_${id}`);
      } catch (e) {
        console.error("Failed to remove local storage focus key:", e);
      }

      showSuccess("รีเซ็ตห้องสอบสำเร็จ", `ล้างข้อมูลรายชื่อและคะแนนสอบทั้งหมดเฉพาะห้อง "${name}" เรียบร้อยแล้ว`);
      fetchCampaigns();
    } catch (err: any) {
      showError("ไม่สามารถรีเซ็ตห้องสอบได้", err.message);
    }
  };

  const handleCloneCampaign = async (id: string, name: string) => {
    const customId = await showPrompt(
      "คัดลอกห้องสอบ",
      `ระบบจะสร้างห้องสอบใหม่จาก "${name}"\n\nระบุรหัสห้องสอบใหม่ (เฉพาะภาษาอังกฤษ ตัวเลข ขีดกลาง - หรือขีดล่าง _ เท่านั้น หรือเว้นว่างไว้เพื่อสุ่มรหัส)`
    );

    if (customId === null) {
      // User clicked cancel
      return;
    }

    const trimmedId = customId.trim();
    if (trimmedId !== "" && !/^[a-zA-Z0-9_-]+$/.test(trimmedId)) {
      showError(
        "รหัสห้องสอบไม่ถูกต้อง",
        "รหัสห้องสอบต้องประกอบด้วยภาษาอังกฤษ ตัวเลข เครื่องหมายขีดกลาง (-) หรือเครื่องหมายขีดล่าง (_) เท่านั้น ห้ามมีช่องว่างหรือตัวอักษรพิเศษ"
      );
      return;
    }

    try {
      const res = await fetch(`/api/campaigns/${id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customId: trimmedId })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "เกิดข้อผิดพลาดในการคัดลอก");
      }
      showSuccess("คัดลอกห้องสอบสำเร็จ", "สร้างห้องสอบใหม่เรียบร้อยแล้ว");
      fetchCampaigns();
    } catch (err: any) {
      showError("ไม่สามารถคัดลอกได้", err.message);
    }
  };

  const toggleCampaignStatus = async (camp: Campaign, newStatus: "ACTIVE" | "COMPLETED" | "DRAFT") => {
    if (newStatus === "ACTIVE" && camp.questions.length === 0) {
      showWarning("ยังไม่มีข้อสอบ", "ไม่สามารถเปิดระบบสอบได้ เนื่องจากยังไม่มีข้อสอบ กรุณาแก้ไขเพื่อเพิ่มข้อสอบก่อน");
      return;
    }

    const updated = {
      ...camp,
      status: newStatus,
      resultsDisplayMode: camp.resultsDisplayMode || "full",
    };

    try {
      const res = await fetch(`/api/campaigns/${camp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      if (!res.ok) throw new Error("Failed to change status");
      
      showSuccess("เปลี่ยนสถานะแล้ว", `เปลี่ยนสถานะห้องสอบเป็น ${newStatus} เรียบร้อยแล้ว`);
      fetchCampaigns();
      
      if (newStatus === "ACTIVE") {
        setShareCampaign(camp);
      }
    } catch (err: any) {
      showError("เปลี่ยนสถานะผิดพลาด", err.message);
    }
  };

  const handleBulkImport = (newQuestions: Question[], mode: "append" | "replace") => {
    if (mode === "replace") {
      setFormQuestions(newQuestions);
    } else {
      setFormQuestions([...formQuestions, ...newQuestions]);
    }
    showSuccess("นำเข้าสำเร็จ", `นำเข้าคำถามสำเร็จแล้ว ${newQuestions.length} ข้อ!`);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleResetDatabase = async () => {
    // ตัวกรองความปลอดภัยและการตรวจสอบสถานะ ACTIVE ของห้องสอบก่อนทำการรีเซ็ต
    const activeRooms = campaigns.filter(c => c.status === "ACTIVE");
    if (activeRooms.length > 0) {
      showError(
        "ไม่สามารถรีเซ็ตฐานข้อมูลได้",
        `ตรวจพบห้องสอบที่ยังคงเปิดทำงานอยู่ (ACTIVE) จำนวน ${activeRooms.length} ห้อง ได้แก่:\n${activeRooms.map(r => `• ${r.name}`).join("\n")}\n\nกรุณาปิดสถานะการทำงานหรือบันทึกผลสอบของห้องสอบเหล่านี้ให้เรียบร้อยก่อน เพื่อความปลอดภัยของผู้สอบที่อาจกำลังเข้าสอบอยู่`
      );
      return;
    }

    const confirmed = await showConfirm(
      "รีเซ็ตฐานข้อมูลเป็นค่าเริ่มต้น?",
      "คำเตือน: การรีเซ็ตนี้จะลบห้องสอบข้อสอบและข้อมูลผู้เข้าสอบทั้งหมดอย่างถาวร (ยกเว้น Demo Tech Quiz ที่จะสร้างใหม่ให้ทันที) คุณต้องการดำเนินการต่อหรือไม่?"
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "เกิดข้อผิดพลาดในการรีเซ็ตฐานข้อมูล");
      }
      showSuccess("รีเซ็ตระบบสำเร็จ", "ล้างข้อมูลทั้งหมดและสร้างควิซเริ่มต้นเรียบร้อยแล้ว");
      fetchCampaigns();
    } catch (err: any) {
      showError("ไม่สามารถรีเซ็ตได้", err.message);
    }
  };

  return (
    <div className="relative">
      {/* 1. List View */}
      {view === "list" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 font-sans tracking-tight">ระบบจัดสร้างห้องสอบควิซและวิเคราะห์สถิติ</h1>
              <p className="text-xs text-slate-500 font-medium">สร้างฟอร์มข้อสอบ จัดระเบียบกลุ่มผู้เรียน แยกห้องสอบรายกลุ่ม และรายงานสถิติทันที</p>
            </div>
            <div className="flex flex-row items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetDatabase}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-full text-xs font-bold tracking-wide border border-rose-100/50 shadow-sm transition-all duration-200 cursor-pointer"
              >
                <RotateCcw size={14} className="shrink-0" />
                <span className="truncate">รีเซ็ตฐานข้อมูล</span>
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#1D366D] hover:bg-indigo-950 text-white rounded-full text-xs font-bold tracking-wide shadow-sm transition-all duration-200 cursor-pointer"
              >
                <Plus size={14} className="shrink-0" />
                <span className="truncate">สร้างห้องสอบใหม่</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-100 rounded-3xl shadow-sm">
              <div className="w-8 h-8 border-3 border-slate-100 border-t-[#1D366D] rounded-full animate-spin mb-4" />
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">กำลังโหลดห้องสอบ...</p>
            </div>
          ) : error ? (
            <div className="p-5 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs shadow-sm">
              <p className="font-bold">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
              <p className="text-rose-600 mt-1">{error}</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-3xl bg-white text-center p-6 shadow-sm">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
                <FileText size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">ยังไม่พบห้องสอบควิซของคุณ</h3>
              <p className="text-xs text-slate-400 mt-2 mb-6 max-w-sm font-medium leading-relaxed">
                เริ่มสร้างห้องสอบควิซชุดแรกเพื่อนำไปจัดทดสอบรายกลุ่ม กำหนดรหัสห้องสอบ ตัวเลือก แผนก และรับผลสถิติทันที
              </p>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#1D366D] hover:bg-indigo-950 text-white rounded-full text-xs font-bold tracking-wide shadow-sm transition-all duration-200 cursor-pointer"
              >
                <Plus size={14} />
                สร้างชุดข้อสอบใหม่
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {campaigns.map((camp, index) => {
                const shareUrl = `${window.location.origin}/?campaignId=${camp.id}`;
                return (
                  <div
                    key={camp.id}
                    draggable={dragEnabled && view === "list"}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={() => {
                      handleDragEnd();
                      setDragEnabled(false);
                    }}
                    onDragLeave={() => setDragOverIndex(null)}
                    className={`bg-white border rounded-2xl p-6 shadow-sm transition-all duration-300 flex flex-col justify-between ${
                      draggedIndex === index
                        ? "opacity-30 border-indigo-400 border-dashed"
                        : dragOverIndex === index
                        ? "border-indigo-400 bg-indigo-50/10 scale-[1.01]"
                        : "border-slate-100 hover:shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    <div>
                      {/* Badge and ID Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-50 pb-3">
                        <div className="flex items-center gap-1.5 max-w-full">
                          {/* Drag Handle icon */}
                          <div 
                            className="text-slate-350 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1 hover:bg-slate-50 rounded-lg shrink-0 select-none" 
                            title="Drag to reorder"
                            onMouseDown={() => setDragEnabled(true)}
                            onMouseUp={() => setDragEnabled(false)}
                            onTouchStart={() => setDragEnabled(true)}
                            onTouchEnd={() => setDragEnabled(false)}
                          >
                            <GripVertical size={14} />
                          </div>

                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 pl-2.5 pr-1.5 py-1 rounded-xl shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase shrink-0">รหัสควิซ:</span>
                          <span className="text-sm sm:text-base font-black font-mono tracking-wider text-[#1D366D] truncate select-all">
                            {camp.id.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCampaignId(camp.id, e)}
                            className="ml-1.5 inline-flex items-center justify-center p-1.5 bg-white border border-slate-200 hover:bg-[#1D366D] hover:text-white hover:border-[#1D366D] rounded-lg text-slate-500 transition-all duration-200 cursor-pointer shadow-2xs shrink-0 active:scale-95"
                            title="คัดลอกรหัสห้องสอบ"
                          >
                            {copiedCampaignId === camp.id ? (
                              <Check size={12} className="text-emerald-500 font-bold" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          {copiedCampaignId === camp.id && (
                            <span className="text-[9px] font-black text-emerald-600 animate-pulse ml-1 shrink-0">คัดลอกแล้ว!</span>
                          )}
                        </div>
                      </div>

                      <span
                          className={`text-[10px] px-2.5 py-1 font-black uppercase tracking-wider rounded-full border self-start sm:self-auto shrink-0 ${
                            camp.status === "ACTIVE"
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700 animate-pulse"
                              : camp.status === "COMPLETED"
                              ? "bg-slate-100 border-slate-200 text-slate-500"
                              : "bg-amber-50 border-amber-100 text-amber-700"
                          }`}
                        >
                          {camp.status === "ACTIVE"
                            ? "เปิดสอบอยู่"
                            : camp.status === "COMPLETED"
                            ? "ล็อกข้อสอบ"
                            : "ร่างแบบทดสอบ"}
                        </span>
                      </div>

                      {/* Info Titles */}
                      <h3 className="text-base font-bold text-slate-800 tracking-tight line-clamp-1">
                        {camp.name}
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                        <p className="text-xs text-slate-400 font-medium">
                          เป้าหมายผู้สอบ: <span className="font-semibold text-[#1D366D]">{camp.groupName}</span>
                        </p>
                        {camp.activeTakersCount !== undefined && camp.activeTakersCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider animate-pulse shadow-2xs self-start sm:self-auto shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-ping"></span>
                            <span>กำลังทำข้อสอบ {camp.activeTakersCount} คน</span>
                          </span>
                        ) : null}
                      </div>

                      {/* Parameters Grid - 2 columns on PC, 1 column on Mobile */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100/50 text-xs text-slate-500">
                        
                        {/* 1. จำนวนข้อสอบ */}
                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-100/50 rounded-xl">
                          <FileText size={14} className="text-[#1D366D] shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">จำนวนข้อสอบ</p>
                            <p className="text-slate-700 font-semibold mt-0.5 leading-snug">
                              {camp.questionSelectionMode === "random" || camp.questionSelectionMode === "rule" ? (
                                <span>ดึงสุ่ม <strong className="text-slate-800">{camp.ruleCount} ข้อ</strong> <span className="text-[10px] text-slate-400 block sm:inline sm:ml-0.5">(จากคลัง {camp.questions.length})</span></span>
                              ) : (
                                <span>มีข้อสอบ <strong className="text-slate-800">
                                  {camp.totalQuestionsToTest && camp.totalQuestionsToTest > 0 ? Math.min(camp.totalQuestionsToTest, camp.questions.length) : camp.questions.length} ข้อ
                                </strong></span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* 2. เกณฑ์การผ่าน */}
                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-100/50 rounded-xl">
                          <Award size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">เกณฑ์การผ่าน</p>
                            <p className="text-slate-700 font-semibold mt-0.5 leading-snug">
                              ได้คะแนน ≥ <strong className="text-emerald-600 font-bold">{camp.passingPercentage}%</strong>
                            </p>
                          </div>
                        </div>

                        {/* 3. สิทธิ์การทำข้อสอบ */}
                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-100/50 rounded-xl">
                          <RotateCcw size={14} className="text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">สิทธิ์การทำข้อสอบ</p>
                            <p className="text-slate-700 font-semibold mt-0.5 leading-snug">
                              {camp.maxAttempts && camp.maxAttempts > 0 ? (
                                <span>จำกัด <strong className="text-slate-800">{camp.maxAttempts} ครั้ง</strong>/คน</span>
                              ) : (
                                <span className="text-slate-500 font-semibold">ไม่จำกัดครั้ง</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* 4. เวลาทำข้อสอบ */}
                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-100/50 rounded-xl">
                          <Clock size={14} className="text-sky-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">เวลาทำข้อสอบ</p>
                            <p className="text-slate-700 font-semibold mt-0.5 leading-snug">
                              {camp.isUntimed ? (
                                <span className="text-slate-500 font-semibold">ไม่จำกัดเวลา</span>
                              ) : (
                                <span>จำกัด <strong className="text-slate-800">{camp.timeLimitMinutes} นาที</strong></span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* 5. โหมดจัดสอบ */}
                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-100/50 rounded-xl col-span-1 sm:col-span-2">
                          <Settings size={14} className="text-purple-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">โหมดจัดสอบ</p>
                            <p className="text-slate-700 font-semibold mt-0.5 leading-snug">
                              {camp.randomizationMode === "fully_random" ? (
                                <span className="text-slate-700">สุ่มทั้งหมดดึงจากคลังข้อสอบ (Random Pool)</span>
                              ) : camp.randomizationMode === "fix_random" ? (
                                <span className="text-slate-700">สุ่มสลับข้อและลำดับตัวเลือก (Shuffle Setup)</span>
                              ) : (
                                <span className="text-slate-500">จัดเรียงปกติคงเดิมตามคลัง (Static Sequence)</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* 6. การเเสดงผลคำตอบ (เฉลยหลังสอบ) */}
                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-100/50 rounded-xl col-span-1 sm:col-span-2">
                          <Eye size={14} className="text-pink-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">การแสดงผลคำตอบเฉลย</p>
                            <p className="text-slate-700 font-semibold mt-0.5 leading-snug">
                              {camp.resultsDisplayMode === "full" ? (
                                <span className="text-emerald-600">แสดงคะแนนสรุป พร้อมคำอธิบายและเฉลยรายข้อละเอียด</span>
                              ) : camp.resultsDisplayMode === "score" ? (
                                <span className="text-indigo-600">แสดงคะแนนรวมและสถานะผ่าน/ไม่ผ่านเท่านั้น (ไม่เฉลย)</span>
                              ) : (
                                <span className="text-rose-600">ซ่อนผลการสอบทันที (ไม่แสดงคะแนนและคำตอบ)</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* 7. รายละเอียดอื่นๆ เช่น ตารางเวลาเปิด/ปิด อัตโนมัติ */}
                        {(camp.startTime || camp.endTime) && (
                          <div className="flex flex-col gap-1.5 col-span-1 sm:col-span-2 p-2.5 bg-indigo-50/50 border border-indigo-100/50 rounded-xl text-[11px]">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#1D366D]">ระบบเปิด-ปิดอัตโนมัติ (Automated Schedule)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-0.5 text-slate-600 font-semibold">
                              {camp.startTime && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={12} className="text-indigo-500 shrink-0" />
                                  <span>เริ่มสอบ: {new Date(camp.startTime).toLocaleString("th-TH")}</span>
                                </div>
                              )}
                              {camp.endTime && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={12} className="text-rose-500 shrink-0" />
                                  <span>สิ้นสุด: {new Date(camp.endTime).toLocaleString("th-TH")}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Operational Toolbar */}
                    <div className="mt-6 border-t border-slate-50 pt-4 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Start Campaign */}
                        {camp.status !== "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={() => toggleCampaignStatus(camp, "ACTIVE")}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2DC84D] hover:bg-emerald-500 text-black rounded-full text-xs font-bold tracking-wide shadow-sm transition-all duration-200 cursor-pointer"
                          >
                            <Play size={13} />
                            เปิดระบบสอบ
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCampaignStatus(camp, "COMPLETED")}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-full text-xs font-bold tracking-wide border border-rose-100/50 shadow-sm transition-all duration-200 cursor-pointer"
                          >
                            <Square size={13} />
                            ปิดระบบสอบ
                          </button>
                        )}

                        {/* Share Links button */}
                        {camp.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => setShareCampaign(camp)}
                            className="inline-flex items-center justify-center p-2.5 border border-slate-150 bg-white text-[#1D366D] hover:bg-slate-50 rounded-full shadow-sm transition-all duration-200 cursor-pointer"
                            title="ดูลิงก์แชร์และ QR Code"
                          >
                            <Link2 size={15} />
                          </button>
                        )}

                        {/* View Statistics / Analytics */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCampaign(camp);
                            setView("analytics");
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-700 rounded-full text-xs font-bold tracking-wide shadow-sm transition-all duration-200 cursor-pointer"
                        >
                          <BarChart3 size={13} />
                          วิเคราะห์ผลสอบ
                        </button>
                      </div>

                      {/* Admin Operations Section (Reset, Edit, Delete) */}
                      {/* Admin Operations Section (Redesigned with Dropdown) */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            สร้างเมื่อ {new Date(camp.createdAt).toLocaleDateString("th-TH")}
                          </span>
                          
                          <div className="flex items-center gap-2 relative admin-dropdown-container">
                            {/* Primary Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleEdit(camp)}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs active:scale-[0.98]"
                              title="แก้ไขคำถาม โครงสร้างตัวเลือก และรายละเอียดแคมเปญ"
                            >
                              <Edit size={13} className="shrink-0" />
                              <span>แก้ไขห้อง</span>
                            </button>

                            {/* Dropdown Toggle Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === camp.id ? null : camp.id);
                              }}
                              className={`p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all duration-200 cursor-pointer ${
                                openDropdownId === camp.id ? "bg-slate-100 border-slate-300" : "bg-white"
                              }`}
                              title="เครื่องมือจัดการเพิ่มเติม"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {openDropdownId === camp.id && (
                              <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 origin-bottom-right">
                                {/* 1. คัดลอกห้องสอบ (Clone) */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleCloneCampaign(camp.id, camp.name);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-all cursor-pointer"
                                >
                                  <Copy size={13} className="text-slate-400 group-hover:text-indigo-500" />
                                  <span>คัดลอกห้องสอบ</span>
                                </button>

                                {/* 2. รีเซ็ตผลห้องสอบ */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleResetCampaign(camp.id, camp.name);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-amber-600 flex items-center gap-2 transition-all cursor-pointer"
                                >
                                  <RotateCcw size={13} className="text-slate-400 group-hover:text-amber-500" />
                                  <span>รีเซ็ตผลสอบ</span>
                                </button>

                                <div className="h-px bg-slate-100 my-1"></div>

                                {/* 3. ลบห้องสอบ */}
                                <button
                                  type="button"
                                  disabled={camp.status === "ACTIVE"}
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleDelete(camp.id);
                                  }}
                                  className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 transition-all ${
                                    camp.status === "ACTIVE"
                                      ? "text-slate-350 cursor-not-allowed opacity-50"
                                      : "text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  }`}
                                  title={camp.status === "ACTIVE" ? "ห้ามลบห้องสอบในระหว่างที่ระบบเปิดสอบอยู่" : "ลบห้องสอบทิ้งถาวร"}
                                >
                                  <Trash2 size={13} className={camp.status === "ACTIVE" ? "text-slate-350" : "text-rose-600"} />
                                  <span>ลบห้องสอบ</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {camp.status === "ACTIVE" && (
                          <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1.5 mt-1 px-2.5 py-1.5 bg-rose-50 border border-rose-100 rounded-lg animate-pulse">
                            <ShieldAlert size={12} className="shrink-0 text-rose-600" />
                            <span>ห้ามลบห้องสอบขณะเปิดระบบสอบ (ACTIVE) อยู่</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Create/Edit Forms Overlay / Stage */}
      {(view === "create" || view === "edit") && (
        <form onSubmit={handleSaveCampaign} className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b-2 border-black pb-4 gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("list")}
                className="p-2 border-3 border-black hover:bg-slate-100 text-slate-800 rounded-none transition-all cursor-pointer shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#000000] bg-white shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-sans tracking-tight uppercase">
                  {view === "create" ? "สร้างห้องสอบควิซใหม่" : `แก้ไขห้องสอบ: ${formName}`}
                </h1>
                <p className="text-sm text-slate-500 font-bold mt-0.5">กำหนดเกณฑ์ ความปลอดภัย และเนื้อหาคำถามของชุดสอบนี้</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => setView("list")}
                className="flex-1 md:flex-none text-center px-6 py-3.5 bg-white border-3 border-black text-slate-800 hover:bg-slate-50 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl transition-all shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000000] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 md:flex-none text-center px-6 py-3.5 bg-aapico-green hover:bg-[#25b542] text-black text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl transition-all border-3 border-black shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000000] cursor-pointer"
              >
                บันทึกห้องสอบ
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto space-y-8">
            {/* Card 1: Basic Information */}
            <div className="bg-white p-8 border-3 border-black rounded-2xl shadow-[6px_6px_0px_0px_#000000] space-y-6">
              <div className="flex items-center gap-2.5 border-b-2 border-black pb-4">
                <Settings className="text-[#1D366D]" size={20} />
                <h3 className="text-sm sm:text-base font-black text-[#1D366D] uppercase tracking-wide font-sans">
                  ข้อมูลห้องสอบพื้นฐาน (Basic Information)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Unique ID */}
                <div>
                  <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-mono">รหัสห้องสอบ (Exam Room ID / Campaign ID)</label>
                  <input
                    type="text"
                    required
                    disabled={view === "edit"}
                    pattern="^[a-zA-Z0-9_-]+$"
                    placeholder="เช่น midterm-math-m1"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    className="w-full px-4.5 py-3 border-2 border-black disabled:bg-slate-50 disabled:text-slate-400 rounded-xl text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue text-slate-950 bg-white"
                  />
                  <span className="text-xs text-slate-500 block mt-2 font-medium leading-relaxed">ใช้ภาษาอังกฤษ ตัวเลข ขีดล่าง หรือขีดกลางเท่านั้น ห้ามเว้นวรรค</span>
                </div>

                {/* Title Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-sans">ชื่อห้องสอบแบบทดสอบ (Exam Room Name)</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น สอบกลางภาควิชาคณิตศาสตร์"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-aapico-blue text-slate-950 font-bold bg-white"
                  />
                  <span className="text-xs text-slate-500 block mt-2 font-medium leading-relaxed">ชื่อเรียกห้องสอบที่ปรากฏให้ผู้เข้าสอบเห็น</span>
                </div>

                {/* Target Group */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-mono">กลุ่มผู้เข้าสอบ / กลุ่มวิชา / แผนก (Target Group)</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ม.1 ห้อง Gifted, แผนกวิศวกรรมเครือข่าย"
                    value={formGroupName}
                    onChange={(e) => setFormGroupName(e.target.value)}
                    className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue text-slate-950 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Timing & Passing Rules */}
            <div className="bg-white p-8 border-3 border-black rounded-2xl shadow-[6px_6px_0px_0px_#000000] space-y-6">
              <div className="flex items-center gap-2.5 border-b-2 border-black pb-4">
                <Clock className="text-[#1D366D]" size={20} />
                <h3 className="text-sm sm:text-base font-black text-[#1D366D] uppercase tracking-wide font-sans">
                  เกณฑ์และเงื่อนไขการเข้าสอบ (Rules & Timing Constraints)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Timed / Untimed Mode */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 font-mono uppercase tracking-wide">โหมดจำกัดเวลาการสอบ (Time Constraint Mode)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormIsUntimed(false)}
                      className={`py-3 px-5 border-2 rounded-xl text-xs sm:text-sm font-black uppercase transition-all cursor-pointer ${
                        !formIsUntimed
                          ? "bg-indigo-50 border-black text-aapico-blue shadow-[2px_2px_0px_0px_#000000]"
                          : "bg-white border-black text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Timed Mode (จำกัดเวลา)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormIsUntimed(true)}
                      className={`py-3 px-5 border-2 rounded-xl text-xs sm:text-sm font-black uppercase transition-all cursor-pointer ${
                        formIsUntimed
                          ? "bg-indigo-50 border-black text-aapico-blue shadow-[2px_2px_0px_0px_#000000]"
                          : "bg-white border-black text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Untimed Mode (ไม่จำกัด)
                    </button>
                  </div>
                </div>

                {/* Duration & Passing Score */}
                <div>
                  <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-mono">
                    เวลาสอบสอบจำกัด {!formIsUntimed ? "(หน่วยนาที)" : "(ไม่จำกัดเวลา)"}
                  </label>
                  <input
                    type="number"
                    required
                    disabled={formIsUntimed}
                    min={1}
                    max={180}
                    value={formTimeLimitMinutes}
                    onChange={(e) => setFormTimeLimitMinutes(Number(e.target.value))}
                    className="w-full px-4.5 py-3 border-2 border-black disabled:bg-slate-50 disabled:text-slate-400 rounded-xl text-sm sm:text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue text-slate-950 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-mono">เกณฑ์การสอบผ่าน (%)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={formPassingPercentage}
                    onChange={(e) => setFormPassingPercentage(Number(e.target.value))}
                    className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue text-slate-950 bg-white"
                  />
                </div>

                {/* Attempt Control */}
                <div>
                  <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 font-mono uppercase tracking-wide">
                    จำนวนครั้งสูงสุดที่สอบได้ (Max Attempts)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMaxAttempts}
                    onChange={(e) => setFormMaxAttempts(Number(e.target.value))}
                    className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white text-slate-950"
                  />
                  <span className="text-xs text-slate-500 block mt-2 font-medium leading-relaxed">
                    ใส่ <strong className="text-rose-600">1</strong> เพื่อสอบได้ครั้งเดียว, ใส่ <strong className="text-aapico-blue">0</strong> เพื่อสอบซ้ำได้ไม่จำกัด
                  </span>
                </div>

                {/* Randomized Quiz Pool limit */}
                {formQuestionSelectionMode === "manual" ? (
                  <div>
                    <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 font-mono uppercase tracking-wide">
                      จำนวนข้อสอบที่ดึงมาทำจริงต่อ Session
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={formQuestions.length}
                      value={formTotalQuestionsToTest}
                      onChange={(e) => setFormTotalQuestionsToTest(Number(e.target.value))}
                      className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white text-slate-950"
                    />
                    <span className="text-xs text-slate-500 block mt-2 font-medium leading-relaxed">
                      ใส่ <strong className="text-aapico-blue">0</strong> หรือเว้นว่าง เพื่อใช้ข้อสอบทั้งหมดที่มีอยู่ในตะกร้าคำถาม
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 font-mono uppercase tracking-wide">
                      จำนวนข้อสอบต่อ Session (สุ่มยกชุด)
                    </label>
                    <div className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-mono font-bold bg-slate-50 text-slate-500 flex items-center justify-between">
                      <span>ดึงตรงตามกฎ Sourcing:</span>
                      <span className="text-aapico-blue font-black">{formRuleCount} ข้อ</span>
                    </div>
                    <span className="text-xs text-slate-500 block mt-2 font-medium leading-relaxed">
                      ในโหมดสุ่มหยิบยกชุด จำนวนข้อสอบจะถูกกำหนดโดย <strong className="text-aapico-blue">Rule Count</strong> ในหัวข้อ Sourcing Mode ด้านล่าง
                    </span>
                  </div>
                )}

                {/* Auto opening dates */}
                <div>
                  <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 flex items-center gap-1.5 font-mono uppercase tracking-wide">
                    <Calendar size={14} className="text-[#1D366D]" /> วัน-เวลาเปิดรับสมัครสอบอัตโนมัติ (เปิดสอบ)
                  </label>
                  <input
                    type="datetime-local"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white text-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 flex items-center gap-1.5 font-mono uppercase tracking-wide">
                    <Calendar size={14} className="text-[#1D366D]" /> วัน-เวลาสิ้นสุดการจัดสอบอัตโนมัติ (ปิดสอบ)
                  </label>
                  <input
                    type="datetime-local"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white text-slate-950"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Security & Results Presentation */}
            <div className="bg-white p-8 border-3 border-black rounded-2xl shadow-[6px_6px_0px_0px_#000000] space-y-6">
              <div className="flex items-center gap-2.5 border-b-2 border-black pb-4">
                <ShieldAlert className="text-[#1D366D]" size={20} />
                <h3 className="text-sm sm:text-base font-black text-[#1D366D] uppercase tracking-wide font-sans">
                  ความปลอดภัยและการเปิดเผยผลเฉลย (Security & Feedback Delivery Mode)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Randomization mode */}
                <div>
                  <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 font-mono uppercase tracking-wide">
                    สลับสับลำดับข้อสอบและตัวเลือก (Randomization Mode)
                  </label>
                  <select
                    value={formRandomizationMode}
                    onChange={(e) => setFormRandomizationMode(e.target.value)}
                    className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white text-slate-950"
                  >
                    <option value="fully_random">Mode 1: สุ่มทั้งหมดดึงจากคลัง (Fully Randomized Pool)</option>
                    <option value="fix_random">Mode 2: สุ่มสลับเฉพาะลำดับโจทย์และลำดับตัวเลือก (Shuffle Sequence & Choices)</option>
                    <option value="static">Mode 3: เรียงคงเดิมตามปกติ (Static Sequence)</option>
                  </select>
                  <span className="text-xs text-slate-500 block mt-2 font-medium leading-relaxed">
                    กำหนดการทำงานของฟังก์ชันป้องกันการลอกข้อสอบสลับตัวเลือก
                  </span>
                </div>

                {/* Display Mode */}
                <div>
                  <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 font-mono uppercase tracking-wide">
                    การเปิดเผยผลเฉลยหลังสอบเสร็จ (Result Display Mode)
                  </label>
                  <select
                    value={formResultsDisplayMode}
                    onChange={(e) => setFormResultsDisplayMode(e.target.value)}
                    className="w-full px-4.5 py-3 border-2 border-black rounded-xl text-sm sm:text-base font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white text-slate-950"
                  >
                    <option value="full">Mode 3: แสดงทั้งคะแนน สรุปรายข้อ เฉลยและคำอธิบายละเอียด (Full Breakdown)</option>
                    <option value="score">Mode 2: แสดงผลเปอร์เซ็นต์คะแนนรวมและสรุปผ่าน/ไม่ผ่านเท่านั้น (Score Only)</option>
                    <option value="hidden">Mode 1: ซ่อนคะแนนและผลลัพธ์ทั้งหมดไม่แสดงทันที (Hidden Results)</option>
                  </select>
                  <span className="text-xs text-slate-500 block mt-2 font-medium leading-relaxed">
                    ป้องกันการส่งต่อความรู้ระหว่างสอบด้วยการซ่อนหรือปิดเฉลยเมื่อพนักงานสอบเสร็จ
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Sourcing & Shopping Basket (Main integrated block) */}
            <div className="bg-white p-8 border-3 border-black rounded-2xl shadow-[6px_6px_0px_0px_#000000] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-4">
                <div className="flex items-center gap-2.5">
                  <Layers className="text-[#1D366D]" size={20} />
                  <h3 className="text-sm sm:text-base font-black text-[#1D366D] uppercase tracking-wide font-sans">
                    วิธีการคัดเลือกเนื้อหาข้อสอบ (Question Sourcing Mode)
                  </h3>
                </div>
                
                {/* Mode Selector Tab */}
                <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-black self-start sm:self-auto shrink-0 select-none">
                  <button
                    type="button"
                    onClick={() => setFormQuestionSelectionMode("manual")}
                    className={`px-5 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      formQuestionSelectionMode === "manual"
                        ? "bg-white text-slate-950 border border-black shadow-[1px_1px_0px_0px_#000000]"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    เลือกเองทีละข้อ (UX Shopping)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormQuestionSelectionMode("random")}
                    className={`px-5 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      formQuestionSelectionMode === "random"
                        ? "bg-white text-slate-950 border border-black shadow-[1px_1px_0px_0px_#000000]"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    สุ่มหยิบยกชุด (Auto Random Pool)
                  </button>
                </div>
              </div>

              {/* Selection Blocks */}
              {formQuestionSelectionMode === "random" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-mono">1. เลือกชุดข้อสอบเป้าหมาย (Target Booklet)</label>
                      <select
                        value={formTargetBooklet}
                        onChange={(e) => setFormTargetBooklet(e.target.value)}
                        className="w-full px-4.5 py-3 bg-white border-2 border-black rounded-xl text-sm sm:text-base font-bold focus:outline-none"
                      >
                        {packets.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-mono">2. จำนวนคำถามที่ต้องการสุ่มจากชุดคำสั่งนี้ (Rule Count)</label>
                      <input
                        type="number"
                        min={1}
                        value={formRuleCount}
                        onChange={(e) => setFormRuleCount(Number(e.target.value))}
                        className="w-full px-4.5 py-3 bg-white border-2 border-black rounded-xl text-sm sm:text-base font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Estimation banner */}
                  {formTargetBooklet && (
                    <div className="p-5 bg-slate-50 border-2 border-black rounded-xl">
                      {(() => {
                        const matched = bankQuestions.filter(q => (q.booklet || "ทั่วไป") === formTargetBooklet);
                        const hasShortage = formRuleCount > matched.length;

                        return (
                          <div className="space-y-2">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wide font-mono block">การตรวจประเมินโควตาคำถามในระบบ</span>
                            <div className="text-sm font-bold text-slate-800">
                              พบข้อสอบในชุดข้อสอบคลังร่วมทั้งหมด: <span className="text-aapico-blue font-black underline text-base">{matched.length} ข้อ</span>
                            </div>

                            {hasShortage ? (
                              <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-xs sm:text-sm font-bold leading-relaxed">
                                คำเตือน: ระบบระบุให้สุ่มข้อสอบ {formRuleCount} ข้อ แต่ในคลังมีเพียง {matched.length} ข้อที่มีสิทธิ์สอบจริง (ระบบจะจำกัดหยิบเฉพาะเท่าที่คลังมีอยู่)
                              </div>
                            ) : (
                              <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs sm:text-sm font-bold leading-relaxed">
                                โครงสร้างสมบูรณ์! เมื่อผู้เข้าสอบเริ่มเข้าทำข้อสอบ ระบบจะทำการสุ่มแยกชุดสอบ {formRuleCount} ข้อจากคลังข้อมูลที่มีทั้งหมด {matched.length} ข้อ มาจัดสอบทันที
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Shopping Header Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-indigo-50/50 border-2 border-black rounded-xl">
                    <div className="space-y-1">
                      <span className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-tight block">
                        ตะกร้าข้อสอบของห้องสอบนี้ (Shopping Cart Basket)
                      </span>
                      <span className="text-xs sm:text-sm text-slate-600 font-bold block">
                        หยิบข้อสอบใส่ตะกร้าแล้ว: <strong className="text-aapico-blue font-mono text-sm sm:text-base">{formManualQuestionIds.length}</strong> ข้อ (แสดงรายการด้านล่าง)
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setFormManualQuestionIds([])}
                        className="px-6 py-3.5 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border-2 border-black text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#000000]"
                      >
                        ล้างตะกร้า (Clear Basket)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSelectorModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#4ef574] hover:bg-[#25b542] text-black border-2 border-black shadow-[4px_4px_0px_0px_#000000] text-xs sm:text-sm font-black uppercase tracking-wide rounded-xl transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000000] cursor-pointer"
                      >
                        <ShoppingCart size={18} />
                        เปิดคลังข้อสอบ (+ เลือกหยิบข้อสอบ)
                      </button>
                    </div>
                  </div>

                  {/* Selected items basket as Object Cards */}
                  {formManualQuestionIds.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-300 p-10 text-center bg-slate-50 rounded-xl">
                      <ShoppingBag className="text-slate-300 mx-auto mb-3" size={48} />
                      <p className="text-sm font-black text-slate-500 uppercase">ตะกร้าข้อสอบยังว่างเปล่า</p>
                      <p className="text-xs text-slate-400 font-bold mt-2 max-w-sm mx-auto leading-normal">
                        กรุณากดปุ่มสีเขียวด้านบนเพื่อเปิดคลังข้อสอบส่วนกลาง และเลือกหยิบข้อสอบที่คุณต้องการนำไปบรรจุลงในห้องสอบควิซนี้
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {bankQuestions
                        .filter(bq => formManualQuestionIds.includes(bq.id))
                        .map((q, idx) => (
                          <div 
                            key={q.id} 
                            className="p-5 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_#000000] hover:translate-x-[-1.5px] hover:translate-y-[-1.5px] hover:shadow-[5.5px_5.5px_0px_0px_#000000] transition-all flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2 py-1 bg-slate-100 border border-slate-300 text-slate-700 font-mono text-[10px] font-black rounded-lg">
                                  ITEM #{idx + 1}
                                </span>
                                <span className="text-[10px] font-black uppercase bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg text-aapico-blue">
                                  {q.booklet || "ทั่วไป"}
                                </span>
                              </div>
                              <p className="text-sm sm:text-base font-bold text-slate-800 leading-snug line-clamp-3">{q.text}</p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                              <span>{q.options.length} ตัวเลือก</span>
                              <button
                                type="button"
                                onClick={() => setFormManualQuestionIds(formManualQuestionIds.filter(id => id !== q.id))}
                                className="text-xs font-black uppercase text-rose-600 hover:text-rose-800 inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 size={14} /> เอาออกจากตะกร้า
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* 3. Analytics View */}
      {view === "analytics" && selectedCampaign && (
        <div className="space-y-5">
          <button
            onClick={() => {
              setView("list");
              setSelectedCampaign(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-aapico-blue bg-white px-4 py-2 border-2 border-black rounded-none transition-all shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#000000] cursor-pointer"
          >
            <ArrowLeft size={14} />
            กลับหน้ารายการห้องสอบ
          </button>
          <CampaignAnalytics campaign={selectedCampaign} />
        </div>
      )}

      {/* Sharing Details Overlay (Modal) */}
      {shareCampaign && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 overflow-y-auto p-4 flex justify-center items-start sm:items-center">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setShareCampaign(null)} />
          <div className="relative my-auto bg-white rounded-none shadow-[6px_6px_0px_0px_#000000] border-3 border-black max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
              <h3 className="text-base font-black text-slate-950 font-sans uppercase tracking-tight">แชร์ห้องสอบควิซ</h3>
              <button
                onClick={() => setShareCampaign(null)}
                className="text-xs font-black uppercase text-slate-500 hover:text-slate-900 border-2 border-black rounded-none px-2 py-1 bg-slate-50 hover:bg-slate-100 shadow-[1px_1px_0px_0px_#000000]"
              >
                ปิด
              </button>
            </div>

            <div className="space-y-4 text-center">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                สแกนคิวอาร์โค้ดด้านล่าง หรือคัดลอกลิงก์ส่งไปให้ผู้เข้าสอบกลุ่ม{" "}
                <span className="font-black text-slate-950">{shareCampaign.groupName}</span> ทำสอบได้ทันที
              </p>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-black rounded-none shadow-[3px_3px_0px_0px_#000000]">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    `${window.location.origin}/?campaignId=${shareCampaign.id}`
                  )}`}
                  alt="คิวอาร์โค้ดห้องสอบ"
                  referrerPolicy="no-referrer"
                  className="w-44 h-44 bg-white border-2 border-black p-2 shadow-sm rounded-none"
                />
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                    `${window.location.origin}/?campaignId=${shareCampaign.id}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-aapico-blue hover:underline mt-3"
                >
                  <Eye size={12} />
                  เปิดภาพ QR Code ขนาดใหญ่
                </a>
              </div>

              {/* Copier link block */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/?campaignId=${shareCampaign.id}`}
                  className="flex-1 px-3 py-2 bg-slate-50 border-2 border-black rounded-none text-xs font-mono font-bold text-slate-700 focus:outline-none"
                />
                <button
                  onClick={() => handleCopyLink(`${window.location.origin}/?campaignId=${shareCampaign.id}`)}
                  className="inline-flex items-center justify-center p-2.5 bg-aapico-green hover:bg-[#25b542] border-2 border-black rounded-none shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#000000] text-black cursor-pointer transition-all"
                  title="คัดลอกลิงก์สอบ"
                >
                  {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              {linkCopied && (
                <p className="text-xs font-black text-emerald-600">คัดลอกลิงก์ไปยังคลิปบอร์ดเสร็จสิ้น!</p>
              )}

              <div className="pt-2 border-t-2 border-slate-100 flex justify-end">
                <button
                  onClick={() => setShareCampaign(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border-2 border-black text-white text-xs font-black uppercase tracking-widest rounded-none shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#000000] transition-all cursor-pointer"
                >
                  รับทราบ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Question Selector Modal (UX Shopping style) */}
      {isSelectorModalOpen && (
        <div 
          ref={modalScrollContainerRef}
          onScroll={(e) => {
            const target = e.currentTarget;
            if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) {
              setShowModalScrollBtn(false);
            } else {
              setShowModalScrollBtn(true);
            }
          }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999] overflow-y-auto p-4 sm:p-10 flex justify-center items-start sm:items-center"
        >
          {/* Background click to close */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsSelectorModalOpen(false)} />
          
          <div className="relative bg-white border-3 border-black rounded-2xl w-full max-w-5xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000000] my-auto space-y-6">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-3 border-black pb-4 gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-sans tracking-tight uppercase flex items-center gap-2">
                  <ShoppingBag className="text-[#1D366D]" size={24} />
                  เลือกข้อสอบจากคลัง (Question Catalog)
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-bold">เลือกคลิกหยิบข้อสอบที่ต้องการไปใส่ในตะกร้าข้อสอบของแคมเปญนี้</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 bg-indigo-50 border-2 border-black rounded-xl text-xs sm:text-sm font-black text-aapico-blue font-mono shadow-[2px_2px_0px_0px_#000000]">
                  เลือกแล้ว: {formManualQuestionIds.length} ข้อ
                </span>
                <button
                  type="button"
                  onClick={() => setIsSelectorModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl border-2 border-black transition-all cursor-pointer bg-white active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Filters (Catalog sections) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-mono">1. เลือกประเภทชุดข้อสอบ (Filter by Booklet)</label>
                <select
                  value={formTargetBooklet}
                  onChange={(e) => setFormTargetBooklet(e.target.value)}
                  className="w-full px-4.5 py-3 bg-white border-2 border-black rounded-xl text-sm sm:text-base font-bold focus:outline-none"
                >
                  {packets.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-slate-700 mb-2 font-mono">2. ค้นหาข้อความคำถาม (Search Question)</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="ค้นหาตามโจทย์คำถาม..."
                    value={bankSearchTerm}
                    onChange={(e) => setBankSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4.5 py-3 bg-white border-2 border-black rounded-xl text-sm sm:text-base font-bold focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Catalog items Grid (UX Shopping style) */}
            <div className="space-y-3">
              <span className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-wide block font-mono">รายการข้อสอบที่มีในคลัง (Central Catalog Items)</span>
              
              {(() => {
                const filteredList = bankQuestions.filter(bq => {
                  const matchesSearch = bq.text.toLowerCase().includes(bankSearchTerm.toLowerCase());
                  const matchesBooklet = (bq.booklet || "ทั่วไป") === formTargetBooklet;
                  return matchesSearch && matchesBooklet;
                });

                if (filteredList.length === 0) {
                  return (
                    <div className="p-10 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                      <p className="text-sm text-slate-400 font-bold">ไม่พบข้อสอบอื่นในชุดข้อสอบ "{formTargetBooklet}" ที่ตรงกับคำค้นหาของคุณ</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredList.map((bq, idx) => {
                      const isSelected = formManualQuestionIds.includes(bq.id);
                      return (
                        <div
                          key={bq.id}
                          onClick={() => {
                            if (isSelected) {
                              setFormManualQuestionIds(formManualQuestionIds.filter(id => id !== bq.id));
                            } else {
                              setFormManualQuestionIds([...formManualQuestionIds, bq.id]);
                            }
                          }}
                          className={`p-5 border-2 rounded-xl transition-all cursor-pointer flex flex-col justify-between select-none ${
                            isSelected
                              ? "border-black bg-indigo-50/40 shadow-[4px_4px_0px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                              : "border-black bg-white hover:bg-slate-50 shadow-[3px_3px_0px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1.5px_1.5px_0px_0px_#000000]"
                          }`}
                        >
                          <div className="space-y-3.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-600 font-mono text-[10px] font-black rounded-lg">
                                ID: {bq.id.toUpperCase()}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-amber-700">
                                  {bq.booklet || "ทั่วไป"}
                                </span>
                                <div className={`w-5 h-5 rounded-lg border-2 border-black flex items-center justify-center ${
                                  isSelected ? "bg-[#4ef574]" : "bg-white"
                                }`}>
                                  {isSelected && <Check className="text-black" size={12} strokeWidth={4} />}
                                </div>
                              </div>
                            </div>
                            <p className="text-sm sm:text-base font-bold text-slate-800 leading-snug">{bq.text}</p>
                            <div className="space-y-1.5 pt-1">
                              {bq.options.map((opt, oIdx) => (
                                <div key={oIdx} className="text-xs sm:text-sm text-slate-600 font-semibold flex items-start gap-1.5">
                                  <span className="text-slate-400 font-mono">{oIdx + 1})</span>
                                  <span className={oIdx === bq.correctIndex ? "text-[#1fa43a] font-bold" : ""}>{opt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-dashed border-slate-100 flex items-center justify-between text-xs text-slate-400 font-bold">
                            <span>คำอธิบายเฉลย: {bq.explanation ? "มี" : "ไม่มี"}</span>
                            <span className={isSelected ? "text-aapico-blue font-black" : "text-slate-500 font-bold"}>
                              {isSelected ? "หยิบใส่ตะกร้าแล้ว" : "คลิกเพื่อเลือก"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Done Button Footer */}
            <div ref={modalFooterRef} className="border-t-3 border-black pt-5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                type="button"
                onClick={() => setFormManualQuestionIds([])}
                className="w-full sm:w-auto px-6 py-3.5 border-2 border-black bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl transition-all shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#000000] cursor-pointer"
              >
                ล้างตะกร้าข้อสอบทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setIsSelectorModalOpen(false)}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#4ef574] hover:bg-[#25b542] border-2 border-black text-black text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl transition-all shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000000] cursor-pointer"
              >
                ตกลงและบันทึกใส่ตะกร้า ({formManualQuestionIds.length})
              </button>
            </div>

            {/* Floating Skip/Scroll down button with smooth transitions */}
            <div 
              className={`fixed bottom-6 right-6 sm:bottom-12 sm:right-12 z-[1000] pointer-events-auto transition-all duration-300 transform ${
                showModalScrollBtn 
                  ? "opacity-100 translate-y-0 scale-100" 
                  : "opacity-0 translate-y-4 scale-95 pointer-events-none"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  modalFooterRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 px-5 py-3.5 bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000000] transition-all cursor-pointer animate-pulse"
              >
                <ArrowRight className="rotate-90 shrink-0 animate-bounce" size={16} />
                <span>ข้ามไปปุ่มบันทึกด้านล่าง (Skip to Save)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
