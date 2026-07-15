import React, { useState, useEffect, useRef } from "react";
import { Campaign, Submission, Question } from "../types";
import { Users, CheckCircle, XCircle, Award, BarChart3, ArrowUpDown, Download, Search, RefreshCw, ChevronDown, ChevronUp, Tv, Sparkles, Clock, Trophy, GraduationCap, Play, Activity, ClipboardCheck, Trash2, Upload, UserPlus, FileSpreadsheet, AlertCircle, Terminal, Wrench } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { showSuccess, showError, showConfirm } from "../lib/swal";

interface AttendanceItem {
  userIdentifier: string;
  userName?: string;
  department?: string;
  company?: string;
  addedAt: string;
}

interface CampaignAnalyticsProps {
  campaign: Campaign;
  onRefresh?: () => void;
}

export default function CampaignAnalytics({ campaign, onRefresh }: CampaignAnalyticsProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeParticipants, setActiveParticipants] = useState<any[]>([]);
  const [analyticsTab, setAnalyticsTab] = useState<"overview" | "diagnostics" | "live_lobby" | "attendance" | "sandbox">("overview");
  
  // State for Attendance & Status Tracker
  const [attendanceList, setAttendanceList] = useState<AttendanceItem[]>(() => {
    try {
      const saved = localStorage.getItem(`campaign_attendance_focus_${campaign.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [singleIdentifier, setSingleIdentifier] = useState("");
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkJsonError, setBulkJsonError] = useState<string | null>(null);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"userName" | "userIdentifier" | "score" | "submittedAt" | "durationSeconds">("submittedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterPassed, setFilterPassed] = useState<"all" | "passed" | "failed">("all");
  const [submissionGroupMode, setSubmissionGroupMode] = useState<"best" | "latest" | "all">("best");
  const [currentAnnouncement, setCurrentAnnouncement] = useState<{ userName: string; score: number } | null>(null);
  const [toastQueue, setToastQueue] = useState<{ id: string; userName: string; score: number }[]>([]);
  const [activeToasts, setActiveToasts] = useState<{ id: string; userName: string; score: number }[]>([]);
  const [burstCount, setBurstCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lobbyCardSize, setLobbyCardSize] = useState<"auto" | "large" | "medium" | "small">("auto");
  const [lobbyFilter, setLobbyFilter] = useState<"all" | "JOINED" | "PASSED" | "FAILED">("all");
  const [showMobileQR, setShowMobileQR] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const lobbyRef = useRef<HTMLDivElement>(null);

  // Real-time notifications queue & burst optimizer
  useEffect(() => {
    if (toastQueue.length === 0) {
      if (activeToasts.length > 0) {
        setActiveToasts([]);
        setBurstCount(0);
      }
      return;
    }

    // Handle burst optimization if there are more than 3 notifications
    if (toastQueue.length > 3) {
      const visible = toastQueue.slice(0, 3);
      const remainingCount = toastQueue.length - 3;
      setActiveToasts(visible);
      setBurstCount(remainingCount);
    } else {
      setActiveToasts(toastQueue);
      setBurstCount(0);
    }

    // Set a timer to automatically clear all active notifications after 6 seconds of no new updates
    const timer = setTimeout(() => {
      setActiveToasts([]);
      setBurstCount(0);
      setToastQueue([]);
    }, 6000);

    return () => clearTimeout(timer);
  }, [toastQueue]);

  const handleSimulate50 = async () => {
    try {
      setSimulating(true);
      const res = await fetch(`/api/campaigns/${campaign.id}/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      });
      if (!res.ok) {
        throw new Error("Failed to run mock simulation");
      }
      showSuccess(
        "จำลองผู้เข้าสอบ 50 คนสำเร็จแล้ว!",
        "ระบบได้จำลองผู้เข้าสอบจำนวน 50 คนเรียบร้อยแล้ว โดยกระจายสถานะเป็น กำลังสอบ 15 คน, สอบผ่าน 25 คน และสอบไม่ผ่าน 10 คน เพื่อใช้ในการทดสอบระบบ Live Lobby Board"
      );
      refreshAllData();
    } catch (err: any) {
      showError("เกิดข้อผิดพลาด", err.message || "ไม่สามารถเปิดระบบจำลองได้");
    } finally {
      setSimulating(false);
    }
  };

  const handleStressTest = async () => {
    try {
      setSimulating(true);
      const res = await fetch(`/api/campaigns/${campaign.id}/stress-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      });
      if (!res.ok) {
        throw new Error("Failed to run stress test simulation");
      }
      showSuccess(
        "เริ่มการทดสอบจำลอง Stress Test 100 คนแล้ว",
        "ระบบได้เริ่มจำลองผู้สอบ 100 คนแบบเรียลไทม์ ผู้สอบที่สอบไม่ผ่านจะเข้าสู่ลูปทำข้อสอบซ้ำโดยอัตโนมัติจนกว่าจะสอบผ่าน เพื่อตรวจสอบความเร็วและการแจ้งเตือนในระบบ"
      );
      setTimeout(() => {
        refreshAllData();
      }, 500);
    } catch (err: any) {
      showError("เกิดข้อผิดพลาด", err.message || "ไม่สามารถเริ่มระบบทดสอบจำลองได้");
    } finally {
      setSimulating(false);
    }
  };

  const resolveAttendanceDetails = (userIdentifier: string, importedName?: string, importedDept?: string, importedCompany?: string) => {
    const sub = submissions.find(s => s.userIdentifier === userIdentifier);
    if (sub) {
      return {
        userName: sub.userName || importedName || "ไม่ระบุชื่อ",
        department: sub.department || importedDept || "ไม่ระบุแผนก",
        company: sub.company || importedCompany || "ไม่ระบุบริษัท",
        matched: true
      };
    }
    
    const active = activeParticipants.find(p => p.userIdentifier === userIdentifier);
    if (active) {
      return {
        userName: active.userName || importedName || "ไม่ระบุชื่อ",
        department: active.department || importedDept || "ไม่ระบุแผนก",
        company: importedCompany || "ไม่ระบุบริษัท",
        matched: true
      };
    }
    
    return {
      userName: importedName || "ยังไม่เข้าสอบ (ไม่พบชื่อ)",
      department: importedDept || "ยังไม่เข้าสอบ (ไม่พบแผนก)",
      company: importedCompany || "ยังไม่เข้าสอบ (ไม่พบบริษัท)",
      matched: false
    };
  };

  const getAttendanceStatus = (userIdentifier: string) => {
    const active = activeParticipants.find(p => p.userIdentifier === userIdentifier);
    if (active) {
      return {
        key: "IN_PROGRESS" as const,
        label: "กำลังสอบ (In Progress)",
        colorClass: "bg-sky-100 text-sky-800 border-sky-400 font-black",
        bgClass: "bg-sky-50"
      };
    }
    
    const userSubs = submissions.filter(s => s.userIdentifier === userIdentifier);
    if (userSubs.length > 0) {
      const passed = userSubs.some(s => s.passed);
      if (passed) {
        return {
          key: "PASSED" as const,
          label: "สอบผ่าน (Passed)",
          colorClass: "bg-emerald-100 text-emerald-800 border-emerald-400 font-black",
          bgClass: "bg-emerald-50/50"
        };
      } else {
        return {
          key: "FAILED" as const,
          label: "สอบไม่ผ่าน (Failed)",
          colorClass: "bg-rose-100 text-rose-800 border-rose-400 font-black",
          bgClass: "bg-rose-50/50"
        };
      }
    }
    
    return {
      key: "NOT_STARTED" as const,
      label: "ยังไม่ได้เริ่ม (Not Started)",
      colorClass: "bg-slate-100 text-slate-500 border-slate-300 font-bold",
      bgClass: "bg-white"
    };
  };

  const handleAddSingleAttendance = () => {
    const trimmed = singleIdentifier.trim();
    if (!trimmed) return;
    
    if (attendanceList.some(item => item.userIdentifier === trimmed)) {
      showError("ข้อมูลซ้ำซ้อน", `รหัสพนักงาน ${trimmed} มีอยู่แล้วในสมุดเช็คชื่อ`);
      return;
    }
    
    const resolved = resolveAttendanceDetails(trimmed);
    const newItem: AttendanceItem = {
      userIdentifier: trimmed,
      userName: resolved.userName !== "ยังไม่เข้าสอบ (ไม่พบชื่อ)" ? resolved.userName : undefined,
      department: resolved.department !== "ยังไม่เข้าสอบ (ไม่พบแผนก)" ? resolved.department : undefined,
      company: resolved.company !== "ยังไม่เข้าสอบ (ไม่พบบริษัท)" ? resolved.company : undefined,
      addedAt: new Date().toISOString()
    };
    
    setAttendanceList(prev => [newItem, ...prev]);
    setSingleIdentifier("");
    showSuccess("เพิ่มรายชื่อสำเร็จ", `รหัสพนักงาน ${trimmed} ได้รับการเพิ่มเข้าสู่สมุดเช็คชื่อแล้ว`);
  };

  const handleMockStressTestEmployees = () => {
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

    const mockItems: AttendanceItem[] = [];
    let duplicateCount = 0;

    for (let i = 0; i < 100; i++) {
      const fName = thaiFirstNames[i % thaiFirstNames.length];
      const lName = thaiLastNames[(i * 7) % thaiLastNames.length];
      const fullName = `${fName} ${lName}`;
      const empId = `STRESS-${1000 + i}`;
      const dept = departments[i % departments.length];
      const comp = companies[i % companies.length];

      if (attendanceList.some(item => item.userIdentifier === empId)) {
        duplicateCount++;
        continue;
      }

      mockItems.push({
        userIdentifier: empId,
        userName: fullName,
        department: dept,
        company: comp,
        addedAt: new Date().toISOString()
      });
    }

    if (mockItems.length === 0) {
      showError("ข้อมูลซ้ำซ้อน", "มีรายชื่อจำลอง Stress Test ทั้งหมดอยู่ในสมุดเช็คชื่อแล้ว");
      return;
    }

    setAttendanceList(prev => [...mockItems, ...prev]);
    showSuccess(
      "จำลองรายชื่อสำเร็จ",
      `นำเข้ารายชื่อจำลองผู้สอบ Stress Test จำนวน ${mockItems.length} คนเข้าสู่สมุดเช็คชื่อแล้ว${duplicateCount > 0 ? ` (ข้ามข้อมูลที่ซ้ำกัน ${duplicateCount} คน)` : ""}`
    );
  };

  const handleBulkAttendanceJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        throw new Error("รูปแบบข้อมูล JSON ต้องเป็น Array ของรายการพนักงาน");
      }
      
      const newItems: AttendanceItem[] = [];
      let duplicateCount = 0;
      
      parsed.forEach((raw: any) => {
        let id = "";
        let name: string | undefined;
        let dept: string | undefined;
        let comp: string | undefined;
        
        if (typeof raw === "string") {
          id = raw.trim();
        } else if (raw && typeof raw === "object") {
          id = (raw.userIdentifier || raw.id || raw.employeeId || raw.emNo || "").toString().trim();
          name = raw.userName || raw.name || raw.fullName || raw.firstName;
          if (raw.surname || raw.lastName) {
            name = `${name || ""} ${raw.surname || raw.lastName}`.trim();
          }
          dept = raw.department || raw.dept;
          comp = raw.company || raw.comp;
        }
        
        if (!id) return;
        
        if (newItems.some(item => item.userIdentifier === id)) return;
        if (attendanceList.some(item => item.userIdentifier === id)) {
          duplicateCount++;
          return;
        }
        
        newItems.push({
          userIdentifier: id,
          userName: name,
          department: dept,
          company: comp,
          addedAt: new Date().toISOString()
        });
      });
      
      if (newItems.length === 0) {
        if (duplicateCount > 0) {
          showError("ข้อมูลซ้ำซ้อน", "รหัสพนักงานทั้งหมดที่ระบุ มีอยู่ในระบบเช็คชื่อเรียบร้อยแล้ว");
        } else {
          showError("ข้อผิดพลาดในการนำเข้า", "ไม่พบรหัสพนักงานที่ถูกต้องในไฟล์ JSON");
        }
        return;
      }
      
      setAttendanceList(prev => [...newItems, ...prev]);
      setShowBulkUploadModal(false);
      setBulkJsonError(null);
      showSuccess(
        "นำเข้าข้อมูลสำเร็จ",
        `นำเข้ารายชื่อใหม่จำนวน ${newItems.length} คนสำเร็จ${duplicateCount > 0 ? ` (ข้ามข้อมูลที่ซ้ำกัน ${duplicateCount} คน)` : ""}`
      );
    } catch (err: any) {
      setBulkJsonError(err.message || "เกิดข้อผิดพลาดในการอ่านรูปแบบ JSON");
    }
  };

  const handleAttendanceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleBulkAttendanceJson(text);
    };
    reader.onerror = () => {
      showError("ข้อผิดพลาดในการอ่านไฟล์", "ไม่สามารถเปิดหรืออ่านไฟล์นี้ได้");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRemoveAttendanceItem = (userIdentifier: string) => {
    setAttendanceList(prev => prev.filter(item => item.userIdentifier !== userIdentifier));
  };

  const handleClearAllAttendance = async () => {
    if (attendanceList.length === 0) return;
    
    const confirmClear = await showConfirm(
      "ยืนยันการล้างรายชื่อ",
      "คุณต้องการล้างรายชื่อในสมุดเช็คชื่อทั้งหมดหรือไม่?"
    );
    if (confirmClear) {
      setAttendanceList([]);
      showSuccess("เคลียร์ข้อมูลสำเร็จ", "ล้างรายชื่อพนักงานทั้งหมดในสมุดเช็คชื่อเรียบร้อยแล้ว");
    }
  };

  const exportAttendanceCSV = () => {
    if (attendanceList.length === 0) return;
    
    const headers = ["รหัสพนักงาน", "ชื่อ-นามสกุล", "แผนก (Department)", "บริษัท (Company)", "สถานะกิจกรรม", "คะแนนล่าสุด", "วันที่เพิ่มข้อมูล"];
    
    const rows = attendanceList.map(item => {
      const resolved = resolveAttendanceDetails(item.userIdentifier, item.userName, item.department, item.company);
      const statusInfo = getAttendanceStatus(item.userIdentifier);
      const userSubs = submissions.filter(s => s.userIdentifier === item.userIdentifier);
      const scoreStr = userSubs.length > 0 
        ? `${Math.max(...userSubs.map(s => s.score)).toFixed(1)}%`
        : "-";
        
      return [
        item.userIdentifier,
        resolved.userName,
        resolved.department,
        resolved.company,
        statusInfo.label,
        scoreStr,
        new Date(item.addedAt).toLocaleString("th-TH")
      ];
    });
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `สมุดเช็คชื่อ_โฟกัสกรุ๊ป_${campaign.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAttendanceJSON = () => {
    if (attendanceList.length === 0) return;
    
    const dataToExport = attendanceList.map(item => {
      const resolved = resolveAttendanceDetails(item.userIdentifier, item.userName, item.department, item.company);
      const statusInfo = getAttendanceStatus(item.userIdentifier);
      const userSubs = submissions.filter(s => s.userIdentifier === item.userIdentifier);
      const maxScore = userSubs.length > 0 ? Math.max(...userSubs.map(s => s.score)) : null;
      
      return {
        userIdentifier: item.userIdentifier,
        userName: resolved.userName,
        department: resolved.department,
        company: resolved.company,
        currentStatus: statusInfo.key,
        statusLabel: statusInfo.label,
        lastScorePercentage: maxScore,
        addedAt: item.addedAt
      };
    });
    
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `สมุดเช็คชื่อ_โฟกัสกรุ๊ป_${campaign.name}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    if (!lobbyRef.current) return;
    
    if (!document.fullscreenElement) {
      const element = lobbyRef.current;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(`campaign_attendance_focus_${campaign.id}`, JSON.stringify(attendanceList));
    } catch (e) {
      console.error("Failed to save attendance list to localStorage:", e);
    }
  }, [attendanceList, campaign.id]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/campaigns/${campaign.id}/submissions`);
      if (!res.ok) {
        throw new Error("Failed to fetch submissions");
      }
      const data = await res.json();
      setSubmissions(data);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลคะแนน");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveParticipants = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/participants`);
      if (res.ok) {
        const data = await res.json();
        setActiveParticipants(data);
      }
    } catch (err) {
      console.error("Failed to fetch active participants:", err);
    }
  };

  const refreshAllData = () => {
    fetchSubmissions();
    fetchActiveParticipants();
    if (onRefresh) onRefresh();
  };

  useEffect(() => {
    fetchSubmissions();
    fetchActiveParticipants();

    // SSE connection for real-time live board updates
    const eventSource = new EventSource(`/api/campaigns/${campaign.id}/live`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "join") {
          const newPart = data.participant;
          setActiveParticipants((prev) => {
            const exists = prev.some((p) => p.userIdentifier === newPart.userIdentifier);
            if (exists) return prev;
            return [...prev, newPart];
          });
        } else if (data.type === "submission") {
          const newSub: Submission = data.submission;
          
          // Remove from active participants since they submitted
          setActiveParticipants((prev) => prev.filter((p) => p.userIdentifier !== newSub.userIdentifier));

          // Add to current submissions array if it doesn't already exist
          setSubmissions((prev) => {
            const exists = prev.some(
              (s) =>
                s.userIdentifier === newSub.userIdentifier &&
                Math.abs(new Date(s.submittedAt).getTime() - new Date(newSub.submittedAt).getTime()) < 2000
            );
            if (exists) return prev;
            return [newSub, ...prev];
          });

          // Trigger celebratory announcement if student passed
          if (newSub.passed) {
            const toastId = `${newSub.userIdentifier}-${Date.now()}-${Math.random()}`;
            setToastQueue((prev) => [
              ...prev,
              {
                id: toastId,
                userName: newSub.userName,
                score: newSub.score
              }
            ]);
          }
        }
      } catch (err) {
        console.error("Error handling SSE event message:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("Real-time EventSource connection issue or closed, closing connection.", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [campaign.id]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Group submissions by userIdentifier if selected
  const processedSubmissions = React.useMemo(() => {
    if (submissionGroupMode === "all") {
      return submissions;
    }
    
    const groups: Record<string, Submission[]> = {};
    submissions.forEach((sub) => {
      const id = sub.userIdentifier;
      if (!groups[id]) {
        groups[id] = [];
      }
      groups[id].push(sub);
    });

    const result: Submission[] = [];
    Object.keys(groups).forEach((id) => {
      const userSubs = groups[id];
      if (submissionGroupMode === "best") {
        userSubs.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.durationSeconds !== b.durationSeconds) return a.durationSeconds - b.durationSeconds;
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        });
        result.push(userSubs[0]);
      } else { // "latest"
        userSubs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        result.push(userSubs[0]);
      }
    });

    return result;
  }, [submissions, submissionGroupMode]);

  // Calculations
  const totalAttempts = processedSubmissions.length;
  const passedCount = processedSubmissions.filter((s) => s.passed).length;
  const failedCount = totalAttempts - passedCount;
  const passRate = totalAttempts > 0 ? (passedCount / totalAttempts) * 100 : 0;
  
  const averageScore =
    totalAttempts > 0
      ? processedSubmissions.reduce((sum, s) => sum + s.score, 0) / totalAttempts
      : 0;

  // Question difficulty analysis
  const questionStats = campaign.questions.map((q) => {
    const correctText = q.options[q.correctIndex];
    let correctCount = 0;
    let totalCount = 0;

    submissions.forEach((sub) => {
      const ans = sub.answers[q.id];
      if (ans !== undefined) {
        totalCount++;
        if (ans === correctText) {
          correctCount++;
        }
      }
    });

    const correctRate = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
    return {
      id: q.id,
      text: q.text,
      correctRate,
      correctCount,
      totalCount,
    };
  });

  const filteredAttendance = attendanceList.filter(item => {
    const resolved = resolveAttendanceDetails(item.userIdentifier, item.userName, item.department, item.company);
    const statusInfo = getAttendanceStatus(item.userIdentifier);
    
    const term = attendanceSearchTerm.trim().toLowerCase();
    if (!term) return true;
    
    return (
      item.userIdentifier.toLowerCase().includes(term) ||
      resolved.userName.toLowerCase().includes(term) ||
      resolved.department.toLowerCase().includes(term) ||
      resolved.company.toLowerCase().includes(term) ||
      statusInfo.label.toLowerCase().includes(term)
    );
  });

  // Filter & Sort submissions
  const filteredSubmissions = processedSubmissions
    .filter((sub) => {
      const matchSearch =
        sub.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.userIdentifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.department && sub.department.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchPass =
        filterPassed === "all" ||
        (filterPassed === "passed" && sub.passed) ||
        (filterPassed === "failed" && !sub.passed);

      return matchSearch && matchPass;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "score" || sortField === "durationSeconds") {
        comparison = a[sortField] - b[sortField];
      } else {
        comparison = String(a[sortField]).localeCompare(String(b[sortField]));
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // CSV Export function
  const exportToCSV = () => {
    const headers = [
      "ชื่อผู้สอบ",
      "บริษัท (Company)",
      "แผนก/ฝ่าย",
      "รหัสผู้เรียน/อีเมล",
      "คะแนน (%)",
      "ข้อสอบทั้งหมด",
      "ตอบถูก (ข้อ)",
      "ผลประเมิน",
      "เวลาทำข้อสอบ (วินาที)",
      "วันที่ส่งข้อสอบ"
    ];

    const rows = processedSubmissions.map((sub) => [
      sub.userName,
      sub.company || "-",
      sub.department || "-",
      sub.userIdentifier,
      sub.score.toFixed(1),
      sub.totalQuestions,
      sub.correctAnswers,
      sub.passed ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์",
      sub.durationSeconds,
      new Date(sub.submittedAt).toLocaleString("th-TH")
    ]);

    const csvContent =
      "\uFEFF" + // BOM to support Thai in Excel
      [headers.join(","), ...rows.map((e) => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `รายงานผลสอบ_${campaign.name}_${campaign.groupName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(processedSubmissions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `รายงานผลสอบ_${campaign.name}_${campaign.groupName}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")} นาที`;
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-black pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 font-sans uppercase tracking-tight">แดชบอร์ดสถิติ & ผลการสอบ</h2>
          <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1">
            {campaign.name} — {campaign.groupName}
          </p>
        </div>
        <div className="flex flex-row items-center gap-2.5 w-full sm:w-auto justify-start sm:justify-end">
          <button
            type="button"
            onClick={exportToCSV}
            disabled={submissions.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2.5 sm:px-5 sm:py-3 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 rounded-none text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border-3 border-black shadow-[4px_4px_0px_0px_#464C59] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
          >
            EXPORT CSV
          </button>
          <button
            type="button"
            onClick={exportToJSON}
            disabled={submissions.length === 0}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2.5 sm:px-5 sm:py-3 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 rounded-none text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border-3 border-black shadow-[4px_4px_0px_0px_#464C59] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
          >
            EXPORT JSON
          </button>
          <button
            type="button"
            onClick={refreshAllData}
            className="inline-flex items-center justify-center p-2.5 text-slate-950 hover:bg-slate-50 rounded-none transition-all cursor-pointer border-3 border-black bg-white shadow-[4px_4px_0px_0px_#464C59] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none h-[38px] sm:h-[44px] w-[38px] sm:w-[44px]"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-row gap-2 max-w-full overflow-x-auto pb-2 scrollbar-none sm:scrollbar-thin">
        <button
          type="button"
          onClick={() => setAnalyticsTab("overview")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-5 sm:py-3 text-[11px] sm:text-xs font-black rounded-none border-3 border-black shadow-[4px_4px_0px_0px_#464C59] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer whitespace-nowrap ${
            analyticsTab === "overview"
              ? "bg-[#2DC84D] text-black"
              : "bg-white text-slate-700 hover:text-slate-950"
          }`}
        >
          <BarChart3 size={13} />
          <span>แดชบอร์ดสถิติ & ผลการสอบ</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsTab("diagnostics")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-5 sm:py-3 text-[11px] sm:text-xs font-black rounded-none border-3 border-black shadow-[4px_4px_0px_0px_#464C59] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer whitespace-nowrap ${
            analyticsTab === "diagnostics"
              ? "bg-[#2DC84D] text-black"
              : "bg-white text-slate-700 hover:text-slate-950"
          }`}
        >
          <Sparkles size={13} />
          <span>วิเคราะห์ความยากง่ายข้อสอบ</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsTab("live_lobby")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-5 sm:py-3 text-[11px] sm:text-xs font-black rounded-none border-3 border-black shadow-[4px_4px_0px_0px_#464C59] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer whitespace-nowrap ${
            analyticsTab === "live_lobby"
              ? "bg-[#2DC84D] text-black"
              : "bg-white text-slate-700 hover:text-slate-950"
          }`}
        >
          <Tv size={13} />
          <span>Live Lobby Board</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsTab("attendance")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-5 sm:py-3 text-[11px] sm:text-xs font-black rounded-none border-3 border-black shadow-[4px_4px_0px_0px_#464C59] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer whitespace-nowrap ${
            analyticsTab === "attendance"
              ? "bg-[#2DC84D] text-black"
              : "bg-white text-slate-700 hover:text-slate-950"
          }`}
        >
          <ClipboardCheck size={13} />
          <span>สมุดเช็คชื่อ (Attendance)</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsTab("sandbox")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-5 sm:py-3 text-[11px] sm:text-xs font-black rounded-none border-3 border-black shadow-[4px_4px_0px_0px_#464C59] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer whitespace-nowrap ${
            analyticsTab === "sandbox"
              ? "bg-[#2DC84D] text-black"
              : "bg-white text-slate-700 hover:text-slate-950"
          }`}
        >
          <Terminal size={13} />
          <span>Developer Sandbox</span>
        </button>
      </div>

      {loading && submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="text-aapico-blue animate-spin mb-4" size={32} />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">กำลังคำนวณสถิติและวิเคราะห์ข้อมูล...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border-3 border-black text-rose-800 rounded-none text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-bold uppercase">ไม่สามารถดึงข้อมูลสถิติได้</p>
          <p className="text-xs text-rose-600 mt-1 font-mono">{error}</p>
        </div>
      ) : (
        <div className="space-y-6 text-left">
          {/* OVERVIEW TAB CONTENT */}
          {analyticsTab === "overview" && (
            totalAttempts === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border-3 border-dashed border-black rounded-none bg-slate-50 shadow-[4px_4px_0px_0px_#464C59]">
                <Users className="text-slate-400 mb-2" size={36} />
                <p className="text-slate-950 font-black text-base uppercase">ยังไม่มีผู้ส่งคำตอบ</p>
                <p className="text-xs text-slate-500 mt-2 max-w-sm font-medium leading-relaxed">
                  เมื่อมีผู้ทำข้อสอบในห้องสอบส่งข้อมูลเข้ามา แดชบอร์ดวิเคราะห์สถิติจะแสดงที่นี่โดยอัตโนมัติ หรือท่านสามารถเปิดหน้าจอ <strong>Live Lobby Board</strong> เพื่อติดตามพนักงานที่กำลังทดสอบอยู่ได้ครับ
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300 text-left">
                {/* Processing Mode Selector Bar */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 bg-slate-50 border-3 border-black rounded-none">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">การประมวลผลผลการสอบรายบุคคล (Individual Evaluation Mode)</span>
                    <p className="text-xs font-bold text-slate-600 mt-0.5">ในกรณีที่มีผู้สอบส่งข้อสอบหลายครั้ง ระบบจะเลือกประมวลผลตามตัวเลือกด้านขวา</p>
                  </div>
                  <div className="flex gap-2 w-full lg:w-auto">
                    {(["best", "latest", "all"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSubmissionGroupMode(mode)}
                        className={`flex-1 lg:flex-none px-2.5 py-2 border-3 rounded-none text-[10px] sm:text-xs font-black transition-all cursor-pointer ${
                          submissionGroupMode === mode
                            ? "bg-[#2DC84D] border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-white border-black text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {mode === "best" ? (
                          <span className="inline-flex items-center gap-1">
                            <Trophy size={13} /> ดีสุด (Best)
                          </span>
                        ) : mode === "latest" ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={13} /> ล่าสุด (Latest)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Users size={13} /> ทั้งหมด (All)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Metrics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-3.5 sm:p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-slate-100 text-slate-950 border-3 border-black rounded-none shrink-0">
                      <Users size={16} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono truncate">ผู้สอบทั้งหมด</p>
                      <p className="text-lg sm:text-2xl font-black font-mono text-slate-900 mt-0.5">{totalAttempts} <span className="text-[10px] sm:text-xs font-bold text-slate-400">คน</span></p>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-emerald-100 text-slate-950 border-3 border-black rounded-none shrink-0">
                      <Award size={16} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono truncate">อัตราผ่านเกณฑ์</p>
                      <p className="text-lg sm:text-2xl font-black font-mono text-emerald-600 mt-0.5">{passRate.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-blue-100 text-slate-950 border-3 border-black rounded-none shrink-0">
                      <BarChart3 size={16} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono truncate">คะแนนเฉลี่ย</p>
                      <p className="text-lg sm:text-2xl font-black font-mono text-blue-600 mt-0.5">{averageScore.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 sm:p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-amber-100 text-slate-950 border-3 border-black rounded-none shrink-0 flex items-center justify-center font-bold text-[9px] sm:text-xs font-mono">
                      <span>P/F</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono truncate">ผ่าน / ไม่ผ่าน</p>
                      <p className="text-lg sm:text-2xl font-black font-mono text-slate-900 mt-0.5">
                        <span className="text-emerald-600">{passedCount}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-rose-600">{failedCount}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submissions List */}
                <div className="bg-white border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] overflow-hidden text-left">
                  <div className="p-5 border-b-3 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest font-mono">
                      ตารางสรุปรายบุคคล ({filteredSubmissions.length} รายการ)
                    </h3>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                          <Search size={14} />
                        </span>
                        <input
                          type="text"
                          placeholder="ค้นหาชื่อหรือรหัส..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 pr-4 py-1.5 border-3 border-black rounded-none text-xs font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue w-44 bg-white"
                        />
                      </div>

                      <select
                        value={filterPassed}
                        onChange={(e) => setFilterPassed(e.target.value as any)}
                        className="px-3 py-1.5 border-3 border-black rounded-none text-xs font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white cursor-pointer"
                      >
                        <option value="all">ทั้งหมด</option>
                        <option value="passed">ผ่านเกณฑ์</option>
                        <option value="failed">ไม่ผ่านเกณฑ์</option>
                      </select>
                    </div>
                  </div>

                  {filteredSubmissions.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-xs font-semibold">
                      ไม่พบคะแนนผู้สอบตามเงื่อนไขค้นหา
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b-3 border-black text-slate-700 font-black text-xs uppercase font-mono">
                            <th className="py-3 px-5 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => toggleSort("userName")}>
                              <div className="flex items-center gap-1.5">
                                ชื่อผู้สอบ <ArrowUpDown size={12} />
                              </div>
                            </th>
                            <th className="py-3 px-5">แผนก/ฝ่าย</th>
                            <th className="py-3 px-5 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => toggleSort("userIdentifier")}>
                              <div className="flex items-center gap-1.5">
                                รหัสประจำตัว/อีเมล <ArrowUpDown size={12} />
                              </div>
                            </th>
                            <th className="py-3 px-5 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => toggleSort("score")}>
                              <div className="flex items-center gap-1.5">
                                เปอร์เซ็นต์คะแนน <ArrowUpDown size={12} />
                              </div>
                            </th>
                            <th className="py-3 px-5">สรุปผลสอบ</th>
                            <th className="py-3 px-5 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => toggleSort("durationSeconds")}>
                              <div className="flex items-center gap-1.5">
                                เวลาทำข้อสอบ <ArrowUpDown size={12} />
                              </div>
                            </th>
                            <th className="py-3 px-5 cursor-pointer hover:bg-slate-200 transition-colors text-right" onClick={() => toggleSort("submittedAt")}>
                              <div className="flex items-center justify-end gap-1.5">
                                ส่งข้อสอบเมื่อ <ArrowUpDown size={12} />
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y-3 divide-slate-100 text-slate-700 text-xs font-medium">
                          {filteredSubmissions.map((sub, sIdx) => (
                            <tr key={sub.id || sIdx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3.5 px-5 font-bold text-slate-900">{sub.userName}</td>
                              <td className="py-3.5 px-5 text-slate-600 font-semibold">{sub.department || "-"}</td>
                              <td className="py-3.5 px-5 text-slate-500 font-mono font-bold">{sub.userIdentifier}</td>
                              <td className="py-3.5 px-5 font-black font-mono text-slate-900 text-sm">
                                {sub.score.toFixed(1)}%{" "}
                                <span className="text-[10px] font-bold text-slate-400">
                                  ({sub.correctAnswers}/{sub.totalQuestions} ข้อ)
                                </span>
                              </td>
                              <td className="py-3.5 px-5">
                                {sub.passed ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none border-2 border-black bg-emerald-50 text-emerald-800 font-bold font-mono text-[10px] uppercase">
                                    <CheckCircle size={12} />
                                    ผ่านเกณฑ์
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none border-2 border-black bg-rose-50 text-rose-800 font-bold font-mono text-[10px] uppercase">
                                    <XCircle size={12} />
                                    ไม่ผ่านเกณฑ์
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-slate-500 font-mono font-bold">{formatTime(sub.durationSeconds)}</td>
                              <td className="py-3.5 px-5 text-slate-400 font-mono text-right font-bold">
                                {new Date(sub.submittedAt).toLocaleTimeString("th-TH")}
                                <span className="block text-[10px] text-slate-400 font-medium">
                                  {new Date(sub.submittedAt).toLocaleDateString("th-TH")}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* DIAGNOSTICS TAB CONTENT */}
          {analyticsTab === "diagnostics" && (
            totalAttempts === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border-3 border-dashed border-black rounded-none bg-slate-50 shadow-[4px_4px_0px_0px_#464C59]">
                <BarChart3 className="text-slate-400 mb-2" size={36} />
                <p className="text-slate-950 font-black text-base uppercase">ยังไม่มีข้อมูลวิเคราะห์ข้อสอบ</p>
                <p className="text-xs text-slate-500 mt-2 max-w-sm font-medium leading-relaxed">
                  สถิติความยากรายข้อจะวิเคราะห์โดยอัตโนมัติทันทีที่มีพนักงานสอบส่งข้อคำตอบกลับมาครับ
                </p>
              </div>
            ) : (
              <div className="bg-white p-6 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] animate-in fade-in duration-300">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 border-b-3 border-black pb-3 font-mono">
                  <BarChart3 size={15} className="text-aapico-blue" />
                  วิเคราะห์ความยากง่ายของข้อสอบ (Question Diagnostics)
                </h3>
                <div className="space-y-3">
                  {questionStats.map((q, idx) => {
                    const isHard = q.correctRate < 50;
                    return (
                      <div key={q.id} className="p-4 border-3 border-black bg-slate-50/50 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="space-y-1 max-w-2xl text-left">
                          <div className="flex items-start gap-2.5">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-none bg-slate-900 text-white text-xs font-black font-mono border-2 border-black shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <p className="font-bold text-slate-900 text-xs sm:text-sm">{q.text}</p>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold font-mono uppercase pl-8">
                            ตอบถูก {q.correctCount} จาก {q.totalCount} คน
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 pl-8 sm:pl-0 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="w-24 xs:w-28 bg-slate-200 border-2 border-black h-3 rounded-none overflow-hidden shrink-0">
                              <div
                                className={`h-full rounded-none ${isHard ? "bg-amber-400" : "bg-[#2DC84D]"}`}
                                style={{ width: `${q.correctRate}%` }}
                              />
                            </div>
                            <span className={`text-xs font-black font-mono w-14 text-right shrink-0 ${isHard ? "text-amber-600" : "text-[#2DC84D]"}`}>
                              {q.correctRate.toFixed(0)}% ถูก
                            </span>
                          </div>
                          {isHard && (
                            <span className="px-2 py-0.5 bg-amber-450 text-slate-950 text-[9px] font-black rounded-none uppercase tracking-widest border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] shrink-0">
                              ยาก
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* LIVE VIEW LOBBY DASHBOARD */}
          {analyticsTab === "live_lobby" && (() => {
            const lobbyMap = new Map<string, any>();

            for (let i = submissions.length - 1; i >= 0; i--) {
              const s = submissions[i];
              lobbyMap.set(s.userIdentifier, {
                userIdentifier: s.userIdentifier,
                userName: s.userName,
                department: s.department || "",
                status: s.passed ? "PASSED" : "FAILED",
                score: s.score,
                correctAnswers: s.correctAnswers,
                totalQuestions: s.totalQuestions,
                submittedAt: s.submittedAt
              });
            }

            activeParticipants.forEach((p) => {
              lobbyMap.set(p.userIdentifier, {
                userIdentifier: p.userIdentifier,
                userName: p.userName,
                department: p.department || "",
                status: "JOINED",
                score: 0,
                correctAnswers: 0,
                totalQuestions: 0,
                submittedAt: null
              });
            });

            const lobbyList = Array.from(lobbyMap.values());

            const activeJoinedCount = lobbyList.filter((p) => p.status === "JOINED").length;
            const livePassedCount = lobbyList.filter((p) => p.status === "PASSED").length;
            const liveFailedCount = lobbyList.filter((p) => p.status === "FAILED").length;

            const focusGroupUserIds = new Set(attendanceList.map((item) => item.userIdentifier));
            const focusGroupCheckedInList = lobbyList.filter((p) => focusGroupUserIds.has(p.userIdentifier));
            const focusGroupCheckedInCount = focusGroupCheckedInList.length;
            const focusGroupPassedCount = focusGroupCheckedInList.filter((p) => p.status === "PASSED").length;
            const focusGroupFailedCount = focusGroupCheckedInList.filter((p) => p.status === "FAILED").length;
            const focusGroupInProgressCount = focusGroupCheckedInList.filter((p) => p.status === "JOINED").length;

            return (
              <div 
                ref={lobbyRef} 
                className={`${
                  isFullscreen 
                    ? "fixed inset-0 z-50 bg-[#FFFFFF] p-4 sm:p-10 h-screen w-screen flex flex-col overflow-hidden gap-4 sm:gap-6" 
                    : "space-y-4 sm:space-y-6 animate-in fade-in duration-300"
                }`}
              >
                {/* Lobby Monitor Banner Header */}
                <div className="rounded-none border-3 border-black shadow-[4px_4px_0px_0px_#464C59] flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3.5 bg-slate-950 shrink-0 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#2DC84D] text-black px-2.5 py-1.5 rounded-none border-2 border-black flex items-center gap-2 font-black text-xs font-sans uppercase tracking-tight select-none shrink-0 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <span>LIVE</span>
                    </div>

                    <div className="text-left min-w-0">
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white font-sans truncate">
                        ระบบติดตามสถานะ (LOBBY) — <span className="text-[#2DC84D]">{campaign.name}</span>
                      </h3>
                    </div>
                  </div>

                  {/* Right Actions Block */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="flex flex-row items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 font-mono uppercase hidden xs:block">ขนาด</span>
                      <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-none">
                        {(["auto", "large", "medium", "small"] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setLobbyCardSize(sz)}
                            className={`px-2 py-1 rounded-none text-[9px] font-black uppercase transition-all cursor-pointer ${
                              lobbyCardSize === sz
                                ? "bg-[#2DC84D] text-black shadow-[1px_1px_0px_0px_rgba(255,255,255,0.15)]"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {sz === "auto" ? "Auto" : sz === "large" ? "ใหญ่" : sz === "medium" ? "กลาง" : "เล็ก"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="flex items-center gap-1.5 py-2 px-3 bg-aapico-blue hover:bg-indigo-900 text-white border-3 border-black rounded-none text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#464C59] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer font-sans"
                    >
                      <Tv size={12} />
                      <span className="hidden sm:inline">{isFullscreen ? "ย่อหน้าจอ" : "FULLSCREEN"}</span>
                    </button>
                  </div>
                </div>

                {/* Color Status Legend */}
                <div className={`flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch ${isFullscreen ? "flex-1 min-h-0 overflow-hidden" : ""}`}>
                  
                  {/* Left Column: Filters and QR */}
                  <div className="w-full md:w-48 shrink-0 flex flex-col gap-3">
                    <div className="flex items-center justify-between pl-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                        ตัวกรองสถานะ (STATUS FILTER)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowMobileQR(!showMobileQR)}
                        className="md:hidden text-[10px] font-black uppercase text-aapico-blue hover:underline flex items-center gap-1"
                      >
                        {showMobileQR ? "ซ่อน QR Code" : "แสดง QR Code"}
                      </button>
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none shrink-0 text-left">
                      <button
                        type="button"
                        onClick={() => setLobbyFilter("all")}
                        className={`px-3 py-2 border-3 rounded-none flex items-center justify-between font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all cursor-pointer h-10 md:h-11 select-none shrink-0 md:shrink-1 ${
                          lobbyFilter === "all"
                            ? "bg-slate-950 text-white border-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-[#FFFFFF] text-slate-700 border-black shadow-[1px_1px_0px_0px_#464C59] hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-none bg-slate-400 border border-black shrink-0" />
                          <span className="font-sans truncate">ALL</span>
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-none shrink-0 ml-2 ${
                          lobbyFilter === "all" ? "bg-white text-slate-950 font-black" : "bg-slate-200 text-slate-800 font-bold"
                        }`}>
                          {lobbyList.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLobbyFilter("JOINED")}
                        className={`px-3 py-2 border-3 rounded-none flex items-center justify-between font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all cursor-pointer h-10 md:h-11 select-none shrink-0 md:shrink-1 ${
                          lobbyFilter === "JOINED"
                            ? "bg-sky-400 text-slate-950 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-[#FFFFFF] text-slate-600 border-black hover:bg-sky-50 shadow-[1px_1px_0px_0px_#464C59]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-none bg-sky-500 border border-black shrink-0" />
                          <span className="font-sans truncate">JOINED</span>
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-none shrink-0 ml-2 ${
                          lobbyFilter === "JOINED" ? "bg-slate-950 text-white font-black" : "bg-sky-100 text-sky-850 font-bold"
                        }`}>
                          {activeJoinedCount}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLobbyFilter("PASSED")}
                        className={`px-3 py-2 border-3 rounded-none flex items-center justify-between font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all cursor-pointer h-10 md:h-11 select-none shrink-0 md:shrink-1 ${
                          lobbyFilter === "PASSED"
                            ? "bg-[#2DC84D] text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-[#FFFFFF] text-slate-600 border-black hover:bg-emerald-50 shadow-[1px_1px_0px_0px_#464C59]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-none bg-[#2DC84D] border border-black shrink-0" />
                          <span className="font-sans truncate">PASSED</span>
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-none shrink-0 ml-2 ${
                          lobbyFilter === "PASSED" ? "bg-slate-950 text-white font-black" : "bg-emerald-100 text-emerald-850 font-bold"
                        }`}>
                          {livePassedCount}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLobbyFilter("FAILED")}
                        className={`px-3 py-2 border-3 rounded-none flex items-center justify-between font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all cursor-pointer h-10 md:h-11 select-none shrink-0 md:shrink-1 ${
                          lobbyFilter === "FAILED"
                            ? "bg-rose-400 text-slate-950 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-[#FFFFFF] text-slate-600 border-black hover:bg-rose-50 shadow-[1px_1px_0px_0px_#464C59]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-none bg-rose-500 border border-black shrink-0" />
                          <span className="font-sans truncate">FAILED</span>
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-none shrink-0 ml-2 ${
                          lobbyFilter === "FAILED" ? "bg-slate-950 text-white font-black" : "bg-rose-100 text-rose-850 font-bold"
                        }`}>
                          {liveFailedCount}
                        </span>
                      </button>
                    </div>

                    {/* QR Code Section */}
                    <div className={`${showMobileQR ? "flex animate-in slide-in-from-top-2 duration-200" : "hidden"} md:flex mt-1 p-3 bg-white border-3 border-black rounded-none shadow-[3px_3px_0px_0px_#464C59] flex-col items-center justify-center text-center select-none gap-2 shrink-0`}>
                      <span className="text-[10px] font-black text-slate-950 uppercase tracking-wider font-sans leading-none">
                        สแกนเข้าสอบ
                      </span>
                      <div className="bg-slate-100 p-1.5 rounded-none border-3 border-black flex items-center justify-center w-full aspect-square max-w-[120px] mx-auto">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.origin + "?campaignId=" + campaign.id)}`}
                          alt="Campaign QR Code"
                          className="w-full h-full object-contain font-bold"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 w-full">
                        <span className="text-[8px] font-bold text-slate-500 font-mono uppercase tracking-widest leading-none">
                          ROOM ID
                        </span>
                        <span className="text-[10px] font-black text-slate-950 font-mono select-all hover:text-aapico-blue transition-colors break-all mt-0.5">
                          {campaign.id}
                        </span>
                      </div>
                    </div>

                    {/* Focus Group Verification Status Card */}
                    <div className="mt-1 p-3 bg-slate-950 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_#464C59] flex flex-col gap-2 shrink-0 text-left">
                      <div className="text-[9px] font-black uppercase tracking-wider font-sans text-[#2DC84D] flex items-center gap-1.5">
                        <ClipboardCheck size={12} className="shrink-0" />
                        <span>ตรงกับสมุดเช็คชื่อ (Focus Group)</span>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[9px] text-slate-300 font-medium leading-normal font-sans">
                          จำนวนพนักงานในกลุ่มเป้าหมาย (สมุดเช็คชื่อ) ที่ระบบตรวจพบว่าเข้าห้องสอบหรือส่งคำสอบเรียบร้อยแล้ว:
                        </p>
                        <div className="flex items-baseline justify-between">
                          <span className="text-lg font-black text-white font-mono leading-none">
                            {focusGroupCheckedInCount} <span className="text-[10px] text-slate-400 font-bold font-sans">/ {attendanceList.length} คน</span>
                          </span>
                          <span className="text-[10px] font-bold text-[#2DC84D] font-mono">
                            {attendanceList.length > 0 ? Math.round((focusGroupCheckedInCount / attendanceList.length) * 100) : 0}%
                          </span>
                        </div>
                        {attendanceList.length > 0 && focusGroupCheckedInCount > 0 && (
                          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-800 text-[8px] font-black text-slate-400 text-center font-sans">
                            <div className="p-1 bg-slate-900 rounded-none border border-slate-800">
                              <span className="text-sky-400 block font-mono text-xs">{focusGroupInProgressCount}</span>
                              กำลังสอบ
                            </div>
                            <div className="p-1 bg-slate-900 rounded-none border border-slate-800">
                              <span className="text-emerald-400 block font-mono text-xs">{focusGroupPassedCount}</span>
                              ผ่าน
                            </div>
                            <div className="p-1 bg-slate-900 rounded-none border border-slate-800">
                              <span className="text-rose-400 block font-mono text-xs">{focusGroupFailedCount}</span>
                              ไม่ผ่าน
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Main Cards Board Container */}
                  <div className={`flex-1 p-4 sm:p-6 border-3 border-black bg-slate-100/60 rounded-none shadow-[4px_4px_0px_0px_#464C59] overflow-y-auto ${isFullscreen ? "h-full" : "min-h-[280px] sm:min-h-[380px]"}`}>
                    {lobbyList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 min-h-full justify-center">
                        <div className="w-12 h-12 rounded-none border-3 border-dashed border-black animate-spin flex items-center justify-center">
                          <Tv size={20} className="text-black" />
                        </div>
                        <div>
                          <p className="text-slate-950 font-black text-xs uppercase font-sans">กำลังรอพนักงานเชื่อมต่อเข้าห้องสอบ...</p>
                          <p className="text-[10px] text-slate-500 mt-1 max-w-sm font-semibold">
                            เมื่อมีพนักงานเปิดหน้าระบบ ยืนยันสิทธิ์ และกด 'เริ่มทำแบบทดสอบ' รายชื่อพนักงานจะขึ้นมาบนบอร์ดนี้แบบเรียลไทม์ทันทีครับ
                          </p>
                        </div>
                      </div>
                    ) : (() => {
                      const filteredLobbyList = lobbyFilter === "all"
                        ? lobbyList
                        : lobbyList.filter((p) => p.status === lobbyFilter);

                      if (filteredLobbyList.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 text-center h-full min-h-[180px] justify-center">
                            <div className="w-11 h-11 rounded-none border-3 border-dashed border-slate-400 flex items-center justify-center mb-3">
                              <Search size={18} className="text-slate-400" />
                            </div>
                            <p className="text-slate-900 font-black text-xs uppercase font-sans">ไม่พบผู้เข้าสอบในสถานะ "{lobbyFilter}"</p>
                            <p className="text-[10px] text-slate-500 mt-1 max-w-xs font-semibold">
                              ยังไม่มีพนักงานที่มีสถานะตรงตามที่เลือก คุณสามารถสลับตัวกรองอื่นหรือดูทั้งหมดได้ครับ
                            </p>
                            <button
                              type="button"
                              onClick={() => setLobbyFilter("all")}
                              className="mt-4 px-3 py-1.5 bg-slate-950 hover:bg-slate-850 text-white text-[10px] font-black uppercase rounded-none border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] transition-all cursor-pointer font-sans"
                            >
                              แสดงรายชื่อทั้งหมด
                            </button>
                          </div>
                        );
                      }

                      const effectiveSize = lobbyCardSize !== "auto" 
                        ? lobbyCardSize 
                        : filteredLobbyList.length > 60 
                          ? "small" 
                          : filteredLobbyList.length > 24 
                            ? "medium" 
                            : "large";

                      const shouldCenterVertically = filteredLobbyList.length <= 16;

                      return (
                        <div className={`w-full min-h-full flex flex-col ${shouldCenterVertically ? "justify-center" : "justify-start"} items-center py-2`}>
                          <motion.div 
                            className="flex flex-wrap-reverse justify-center items-center content-center animate-in fade-in duration-300 w-full"
                            style={{
                              gap: effectiveSize === "large" ? "12px" : effectiveSize === "medium" ? "10px" : "8px",
                            }}
                          >
                            {filteredLobbyList.map((p, idx) => {
                              const isJoined = p.status === "JOINED";
                              const isPassed = p.status === "PASSED";
                              const isFailed = p.status === "FAILED";

                              let cardBg = "bg-sky-450 text-slate-950";
                              if (isJoined) {
                                cardBg = "bg-sky-300 text-black";
                              }
                              let statusText = "กำลังสอบ...";
                              let scoreDisplay = "";

                              if (isPassed) {
                                cardBg = "bg-[#2DC84D] text-black";
                                statusText = "ผ่าน";
                                scoreDisplay = `${p.score.toFixed(0)}%`;
                              } else if (isFailed) {
                                cardBg = "bg-rose-400 text-slate-950";
                                statusText = "ไม่ผ่าน";
                                scoreDisplay = `${p.score.toFixed(0)}%`;
                              }

                              // Sizing specs
                              let cardHeight = "h-24 sm:h-28 p-3 sm:p-4";
                              let cardWidth = "w-[140px]";
                              let idTextSize = "text-[10px] sm:text-[11px]";
                              let nameTextSize = "text-xs sm:text-sm mt-0.5 sm:mt-1";
                              let statusTextSize = "text-[7.5px] sm:text-[8px] px-1.5 py-0.5";
                              let scoreTextSize = "text-sm sm:text-md";

                              if (effectiveSize === "medium") {
                                cardHeight = "h-22 sm:h-24 p-2.5 sm:p-3";
                                cardWidth = "w-[110px]";
                                idTextSize = "text-[9px] sm:text-[10px]";
                                nameTextSize = "text-[11px] sm:text-xs mt-0.5 leading-tight";
                                statusTextSize = "text-[7px] sm:text-[7.5px] px-1 py-0.5";
                                scoreTextSize = "text-xs sm:text-sm";
                              } else if (effectiveSize === "small") {
                                cardHeight = "h-18 sm:h-20 p-2";
                                cardWidth = "w-[85px]";
                                idTextSize = "text-[8px] sm:text-[9px]";
                                nameTextSize = "text-[10px] sm:text-[11px] mt-0.5 leading-none";
                                statusTextSize = "text-[6.5px] sm:text-[7px] px-1 py-0.2";
                                scoreTextSize = "text-[11px] sm:text-xs font-bold";
                              }

                              return (
                                <motion.div
                                  key={p.userIdentifier}
                                  layout
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className={`border-3 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between relative overflow-hidden transition-colors duration-300 ${cardHeight} ${cardWidth} ${cardBg} shrink-0`}
                                >
                                {isJoined && (
                                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
                                )}

                                <div>
                                  <div className="flex items-start justify-between gap-1">
                                    <span className={`font-black uppercase tracking-wider block font-mono truncate ${idTextSize}`}>
                                      {p.userIdentifier}
                                    </span>
                                    {isJoined && (
                                      <span className="flex h-1.5 w-1.5 relative shrink-0 mt-0.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-950"></span>
                                      </span>
                                    )}
                                  </div>
                                  <h4 className={`font-black line-clamp-1 leading-tight ${nameTextSize}`}>{p.userName}</h4>
                                  {effectiveSize !== "small" && (
                                    <p className="text-[8px] sm:text-[9px] font-bold opacity-80 line-clamp-1">{p.department || "-"}</p>
                                  )}
                                </div>

                                <div className="flex items-end justify-between gap-1 z-10">
                                  <span className={`font-black uppercase tracking-widest block font-mono bg-black/10 rounded-none ${statusTextSize}`}>
                                    {statusText}
                                  </span>
                                  {scoreDisplay && (
                                    <span className={`font-black font-mono leading-none tracking-tighter shrink-0 ${scoreTextSize}`}>
                                      {scoreDisplay}
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </div>
                    );
                  })()}
                  </div>
                </div>

                {/* Footer Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
                  <div className="bg-sky-200 p-3 sm:p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center justify-between gap-2 select-none">
                    <div className="text-left min-w-0">
                      <span className="text-[10px] sm:text-xs font-black text-slate-950 block leading-tight truncate">กำลังสอบ</span>
                      <span className="text-[8px] sm:text-[10px] font-black font-mono text-slate-800 uppercase block mt-0.5 sm:mt-1">(ACTIVE)</span>
                    </div>
                    <span className="text-3xl sm:text-5xl lg:text-6xl font-black font-mono text-slate-950 leading-none shrink-0">{activeJoinedCount}</span>
                  </div>

                  <div className="bg-[#2DC84D] p-3 sm:p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center justify-between gap-2 select-none">
                    <div className="text-left min-w-0">
                      <span className="text-[10px] sm:text-xs font-black text-slate-950 block leading-tight truncate">สอบผ่าน</span>
                      <span className="text-[8px] sm:text-[10px] font-black font-mono text-slate-800 uppercase block mt-0.5 sm:mt-1">(PASSED)</span>
                    </div>
                    <span className="text-3xl sm:text-5xl lg:text-6xl font-black font-mono text-slate-950 leading-none shrink-0">{livePassedCount}</span>
                  </div>

                  <div className="bg-rose-450 bg-rose-400 p-3 sm:p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center justify-between gap-2 select-none">
                    <div className="text-left min-w-0">
                      <span className="text-[10px] sm:text-xs font-black text-slate-950 block leading-tight truncate">ไม่ผ่าน</span>
                      <span className="text-[8px] sm:text-[10px] font-black font-mono text-slate-800 uppercase block mt-0.5 sm:mt-1">(FAILED)</span>
                    </div>
                    <span className="text-3xl sm:text-5xl lg:text-6xl font-black font-mono text-slate-950 leading-none shrink-0">{liveFailedCount}</span>
                  </div>

                  <div className="bg-sky-400 p-3 sm:p-5 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center justify-between gap-2 select-none">
                    <div className="text-left min-w-0">
                      <span className="text-[10px] sm:text-xs font-black text-slate-950 block leading-tight truncate">ผู้เข้าสอบทั้งหมด</span>
                      <span className="text-[8px] sm:text-[10px] font-black font-mono text-slate-800 uppercase block mt-0.5 sm:mt-1">(ALL)</span>
                    </div>
                    <span className="text-3xl sm:text-5xl lg:text-6xl font-black font-mono text-slate-950 leading-none shrink-0">{lobbyList.length}</span>
                  </div>
                </div>

                {/* Toast Notifications Overlay for Real-Time Celebration (Full-Screen compatible) */}
                <AnimatePresence>
                  {activeToasts.length > 0 && (
                    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-md pointer-events-none flex flex-col gap-3.5 items-center">
                      {activeToasts.map((toast) => (
                        <motion.div
                          key={toast.id}
                          initial={{ opacity: 0, scale: 0.85, y: -40 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: -20 }}
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                          className="w-full bg-[#2DC84D] border-3 border-black p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-4 rounded-none pointer-events-auto"
                        >
                          <div className="flex items-center gap-3 text-black min-w-0">
                            <div className="p-2 bg-white border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                              <Trophy className="text-[#2DC84D] shrink-0" size={18} />
                            </div>
                            <div className="text-left min-w-0">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 block font-sans">
                                สอบผ่านเกณฑ์ความรู้!
                              </span>
                              <span className="text-xs sm:text-sm font-black text-black block leading-snug truncate">
                                คุณ {toast.userName}
                              </span>
                            </div>
                          </div>
                          <div className="px-3 py-1.5 bg-white border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0 flex flex-col items-center font-mono">
                            <span className="text-[7.5px] font-black uppercase text-slate-500 tracking-widest leading-none">คะแนน</span>
                            <span className="text-xs sm:text-sm font-black text-[#2DC84D] leading-none mt-1">
                              {toast.score.toFixed(1)}%
                            </span>
                          </div>
                        </motion.div>
                      ))}

                      {burstCount > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="bg-amber-400 border-3 border-black px-4 py-2.5 text-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-none pointer-events-auto flex items-center gap-2"
                        >
                          <Sparkles size={14} className="text-black animate-spin shrink-0" />
                          <span className="text-xs font-black text-black font-sans uppercase">
                            และผู้เข้าสอบผ่านท่านอื่นอีก {burstCount} คนในระบบ!
                          </span>
                        </motion.div>
                      )}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}

          {/* DEVELOPER SANDBOX TAB CONTENT */}
          {analyticsTab === "sandbox" && (
            <div className="space-y-6 animate-in fade-in duration-300 text-left">
              {/* Sandbox Header / Info Banner */}
              <div className="bg-slate-950 border-3 border-black p-5 text-white shadow-[4px_4px_0px_0px_#2DC84D] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-none">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Terminal className="text-[#2DC84D] shrink-0" size={20} />
                    <h3 className="text-lg font-black uppercase tracking-tight font-sans text-white">Developer Sandbox</h3>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    ศูนย์รวมเครื่องมือทดสอบ จำลองโหลดพนักงาน และบัญชีทดสอบระบบความเสถียรแบบ Real-time (ห้ามนำมาแสดงในส่วนฝั่งผู้ใช้จริง)
                  </p>
                </div>
              </div>

              {/* Bento Grid layout for Sandbox modules */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Module 1: Attendance Test Tools */}
                <div className="bg-white border-3 border-black rounded-none p-5 shadow-[4px_4px_0px_0px_#464C59] flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-black">
                      <ClipboardCheck size={18} className="text-amber-500 shrink-0" />
                      <h4 className="text-sm font-black uppercase tracking-tight text-slate-950 font-sans">Attendance Test Tools</h4>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed font-sans">
                      กลุ่มเครื่องมือสำหรับทดสอบสมุดเช็คชื่อ โดยจะจำลองพนักงาน 100 คนที่มีรหัสพนักงานขึ้นต้นด้วย <span className="font-mono bg-slate-100 px-1 py-0.5 border border-slate-300 font-bold">STRESS-</span> เข้าสู่สมุดเช็คชื่อเพื่อยืนยันระบบการจับคู่ผู้สอบจริง
                    </p>
                  </div>
                  <div className="pt-5 border-t border-slate-100 mt-4">
                    <button
                      type="button"
                      onClick={handleMockStressTestEmployees}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-3 px-4 bg-amber-400 hover:bg-amber-500 text-slate-950 border-3 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer font-sans"
                    >
                      <Sparkles size={13} className="shrink-0" />
                      <span>จำลอง Stress Test (100 คน)</span>
                    </button>
                  </div>
                </div>

                {/* Module 2: Live Lobby Simulation */}
                <div className="bg-white border-3 border-black rounded-none p-5 shadow-[4px_4px_0px_0px_#464C59] flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-black">
                      <Tv size={18} className="text-aapico-blue shrink-0" />
                      <h4 className="text-sm font-black uppercase tracking-tight text-slate-950 font-sans">Live Lobby Simulation</h4>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed font-sans">
                      กลุ่มทดสอบและจำลองผู้เข้าสอบแบบ Static (นิ่ง 50 คน) หรือจำลองโหลดปริมาณการส่งคำตอบพร้อมกันแบบทันที (Real-time Stress Test 100 คน) เพื่อติดตามการแสดงผลและการคำนวณสถิติ
                    </p>
                  </div>
                  <div className="space-y-3.5 pt-5 border-t border-slate-100 mt-4">
                    {/* Simulator Button 1 */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 font-mono uppercase">แบบที่ 1: ข้อมูลนิ่ง 50 คน</span>
                      <button
                        type="button"
                        onClick={handleSimulate50}
                        disabled={simulating}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-400 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 border-3 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer font-sans"
                      >
                        {simulating ? (
                          <>
                            <RefreshCw size={13} className="animate-spin shrink-0" />
                            <span>กำลังประมวลผล...</span>
                          </>
                        ) : (
                          <>
                            <Play size={10} fill="currentColor" className="shrink-0" />
                            <span>จำลองผู้เข้าสอบ 50 คน แบบ Static</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Simulator Button 2 */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-amber-500 font-mono uppercase">แบบที่ 2: เรียลไทม์ 100 คน</span>
                      <button
                        type="button"
                        onClick={handleStressTest}
                        disabled={simulating}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 border-3 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer font-sans"
                      >
                        {simulating ? (
                          <>
                            <RefreshCw size={13} className="animate-spin shrink-0" />
                            <span>กำลังประมวลผล...</span>
                          </>
                        ) : (
                          <>
                            <Activity size={13} className="shrink-0" />
                            <span>เริ่มจำลอง Stress Test 100 คน แบบ Real-time</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Module 3: QuizTaker Simulation */}
                <div className="bg-white border-3 border-black rounded-none p-5 shadow-[4px_4px_0px_0px_#464C59] flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-black">
                      <Users size={18} className="text-indigo-500 shrink-0" />
                      <h4 className="text-sm font-black uppercase tracking-tight text-slate-950 font-sans">QuizTaker Simulation</h4>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed font-sans">
                      รายชื่อบัญชีพนักงานจำลองของระบบ (Mock ESS Accounts) สำหรับการเข้าร่วมทำสอบจริง เพื่อตรวจสอบประวัติสถิติและความปลอดภัยของฐานข้อมูลแยกส่วน
                    </p>
                    
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {[
                        { id: "AH10002898", name: "วจีประดิษฐ์ พรมพันธุ์", dept: "IT-96-Indirect (แผนกไอที)" },
                        { id: "AH10002900", name: "สมนึก รักดี", dept: "HR-01-Direct (ฝ่ายบุคคล)" },
                        { id: "AH10003500", name: "ใจเด็ด รักษาสัตย์", dept: "PROD-02-Indirect (ฝ่ายผลิต)" }
                      ].map((mock) => (
                        <div
                          key={mock.id}
                          className="p-2 bg-slate-50 border-2 border-black flex flex-col gap-0.5"
                        >
                          <div className="text-xs font-black text-slate-900 font-sans">{mock.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono font-bold">EM ID: {mock.id}</div>
                          <div className="text-[9px] text-slate-400 font-sans font-semibold">{mock.dept}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 mt-2">
                    <div className="p-2 bg-indigo-50 border border-black text-[9px] text-indigo-950 font-bold leading-normal font-sans">
                      หมายเหตุ: สามารถเข้าสู่ห้องสอบจากหน้านักเรียนด้วยรหัสห้องสอบ และกรอกรหัสพนักงานด้านบนร่วมกับรหัสผ่าน "123456" เพื่อทำข้อสอบจริง
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ATTENDANCE & STATUS TRACKER TAB CONTENT */}
          {analyticsTab === "attendance" && (
            <div className="space-y-6 animate-in fade-in duration-300 text-left">
              {/* Header card / Banner */}
              <div className="bg-slate-950 border-3 border-black p-5 text-white shadow-[4px_4px_0px_0px_#2DC84D] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-none">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="text-[#2DC84D] shrink-0" size={20} />
                    <h3 className="text-lg font-black uppercase tracking-tight font-sans text-white">สมุดเช็คชื่อพนักงาน (Attendance & Status Tracker)</h3>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    ระบุกลุ่มรายชื่อพนักงานที่ท่านต้องการ Focus เป็นพิเศษ เพื่อติดตามสถานะและวิเคราะห์สถิติความก้าวหน้าแบบ Real-time
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkUploadModal(true)}
                    className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-white hover:bg-slate-50 text-slate-950 border-2 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>นำเข้าแบบกลุ่ม (Bulk Upload JSON)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllAttendance}
                    disabled={attendanceList.length === 0}
                    className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-800 text-white border-2 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>ล้างรายชื่อทั้งหมด</span>
                  </button>
                </div>
              </div>

              {/* Add Single / Input Section */}
              <div className="bg-white border-3 border-black p-4 shadow-[4px_4px_0px_0px_#464C59] rounded-none flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:max-w-md">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono block mb-1.5">
                    ค้นหาและระบุรายบุคคล (Add Individual by Employee ID)
                  </label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddSingleAttendance();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      placeholder="เช่น AH10002898"
                      value={singleIdentifier}
                      onChange={(e) => setSingleIdentifier(e.target.value)}
                      className="flex-1 px-3 py-2 border-3 border-black rounded-none text-xs font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-[#2DC84D] hover:bg-green-600 text-black border-2 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer whitespace-nowrap"
                    >
                      <UserPlus size={13} />
                      <span>เพิ่มรายชื่อ</span>
                    </button>
                  </form>
                </div>

                <div className="flex flex-wrap gap-2 justify-end items-center">
                  <button
                    type="button"
                    onClick={exportAttendanceCSV}
                    disabled={attendanceList.length === 0}
                    className="inline-flex items-center gap-1.5 py-2 px-4 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 border-2 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                  >
                    <FileSpreadsheet size={13} />
                    <span>EXPORT CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportAttendanceJSON}
                    disabled={attendanceList.length === 0}
                    className="inline-flex items-center gap-1.5 py-2 px-4 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 border-2 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                  >
                    <Download size={13} />
                    <span>EXPORT JSON</span>
                  </button>
                </div>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
                <div className="bg-white p-3 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2">
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">ทั้งหมดใน Focus</span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-slate-950">{attendanceList.length}</span>
                  </div>
                  <Users size={16} className="text-slate-400 shrink-0" />
                </div>
                <div className="bg-sky-50 p-3 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2">
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-sky-600 block">กำลังสอบ</span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-sky-800">
                      {attendanceList.filter(item => getAttendanceStatus(item.userIdentifier).key === "IN_PROGRESS").length}
                    </span>
                  </div>
                  <Activity size={16} className="text-sky-500 animate-pulse shrink-0" />
                </div>
                <div className="bg-emerald-50 p-3 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2">
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block">สอบผ่าน</span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-emerald-800">
                      {attendanceList.filter(item => getAttendanceStatus(item.userIdentifier).key === "PASSED").length}
                    </span>
                  </div>
                  <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                </div>
                <div className="bg-rose-50 p-3 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2">
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 block">สอบไม่ผ่าน</span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-rose-800">
                      {attendanceList.filter(item => getAttendanceStatus(item.userIdentifier).key === "FAILED").length}
                    </span>
                  </div>
                  <XCircle size={16} className="text-rose-500 shrink-0" />
                </div>
                <div className="bg-slate-50 p-3 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between gap-2 col-span-2 sm:col-span-1">
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">ยังไม่ได้เริ่ม</span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-slate-700">
                      {attendanceList.filter(item => getAttendanceStatus(item.userIdentifier).key === "NOT_STARTED").length}
                    </span>
                  </div>
                  <Clock size={16} className="text-slate-400 shrink-0" />
                </div>
              </div>

              {/* Search Bar / Table Container */}
              <div className="bg-white border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] overflow-hidden text-left">
                <div className="p-4 border-b-3 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider font-sans text-slate-950">รายชื่อในกลุ่มเฝ้าติดตามพิเศษ ({filteredAttendance.length})</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">ระบบจะเชื่อมโยงรายละเอียด (ชื่อ แผนก บริษัท) จากฐานข้อมูลและแบบเรียลไทม์ทันทีเมื่อมีข้อมูล</p>
                  </div>
                  <div className="relative w-full sm:w-64 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                    <input
                      type="text"
                      placeholder="ค้นหารหัสพนักงาน ชื่อ แผนก..."
                      value={attendanceSearchTerm}
                      onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 border-3 border-black rounded-none text-xs font-bold focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white"
                    />
                  </div>
                </div>

                {filteredAttendance.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center justify-center">
                    <ClipboardCheck className="text-slate-300 mb-2" size={36} />
                    <p className="text-slate-950 font-black text-sm uppercase">ไม่พบข้อมูลผู้เข้าสอบใน Focus Group</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs font-medium leading-relaxed">
                      กรุณาป้อนรหัสพนักงานรายบุคคล หรือนำเข้าไฟล์ JSON เพื่อเริ่มต้นการติดตาม
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-100 border-b-3 border-black text-slate-700 font-black text-xs uppercase font-mono">
                          <th className="py-3 px-4 border-r-2 border-black w-32">รหัสพนักงาน</th>
                          <th className="py-3 px-4 border-r-2 border-black">ชื่อ-นามสกุล</th>
                          <th className="py-3 px-4 border-r-2 border-black">แผนก (Department)</th>
                          <th className="py-3 px-4 border-r-2 border-black">บริษัท (Company)</th>
                          <th className="py-3 px-4 border-r-2 border-black w-48">สถานะการทำกิจกรรม</th>
                          <th className="py-3 px-4 border-r-2 border-black w-24 text-center">คะแนนล่าสุด</th>
                          <th className="py-3 px-4 w-16 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.map((item) => {
                          const resolved = resolveAttendanceDetails(item.userIdentifier, item.userName, item.department, item.company);
                          const statusInfo = getAttendanceStatus(item.userIdentifier);
                          const userSubs = submissions.filter(s => s.userIdentifier === item.userIdentifier);
                          const maxScore = userSubs.length > 0 ? Math.max(...userSubs.map(s => s.score)) : null;

                          return (
                            <tr
                              key={item.userIdentifier}
                              className={`border-b-2 border-black hover:bg-slate-50/50 transition-colors ${statusInfo.bgClass}`}
                            >
                              <td className="py-2.5 px-4 font-mono text-xs font-black text-slate-950 border-r-2 border-black">
                                {item.userIdentifier}
                              </td>
                              <td className="py-2.5 px-4 text-xs font-black text-slate-950 border-r-2 border-black">
                                {resolved.userName}
                              </td>
                              <td className="py-2.5 px-4 text-xs font-bold text-slate-700 border-r-2 border-black">
                                {resolved.department}
                              </td>
                              <td className="py-2.5 px-4 text-xs font-bold text-slate-700 border-r-2 border-black">
                                {resolved.company}
                              </td>
                              <td className="py-2.5 px-4 border-r-2 border-black">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono border-2 border-black rounded-none shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${statusInfo.colorClass}`}>
                                  {statusInfo.key === "IN_PROGRESS" && (
                                    <span className="w-1.5 h-1.5 bg-sky-600 rounded-full animate-ping shrink-0" />
                                  )}
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-xs font-mono font-black text-center border-r-2 border-black">
                                {maxScore !== null ? (
                                  <span className={maxScore >= (campaign.passingPercentage || 60) ? "text-emerald-600" : "text-rose-600"}>
                                    {maxScore.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttendanceItem(item.userIdentifier)}
                                  className="p-1 text-slate-400 hover:text-rose-600 border-2 border-transparent hover:border-black rounded-none transition-all cursor-pointer"
                                  title="ลบออกจากกลุ่ม"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bulk JSON Upload Modal */}
          <AnimatePresence>
            {showBulkUploadModal && (
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[9999] overflow-y-auto p-4 sm:p-10 flex justify-center items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="relative w-full max-w-xl bg-white border-3 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-slate-950 flex flex-col gap-4 text-left rounded-none"
                >
                  <div className="flex items-center justify-between border-b-2 border-black pb-3">
                    <div className="flex items-center gap-2">
                      <Upload className="text-slate-950 shrink-0" size={18} />
                      <h4 className="text-base font-black uppercase tracking-tight font-sans">นำเข้าข้อมูลกลุ่มพนักงาน (Bulk JSON Upload)</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkUploadModal(false);
                        setBulkJsonError(null);
                      }}
                      className="text-slate-500 hover:text-slate-950 font-black text-sm cursor-pointer"
                    >
                      ปิด [X]
                    </button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-700">
                      เลือกอัปโหลดไฟล์ไฟล์ .json หรือวางข้อมูลในกล่องด้านล่าง เพื่อนำเข้ารายชื่อหลายรายการพร้อมกัน
                    </p>

                    {/* File Drop / Select Area */}
                    <div className="border-3 border-dashed border-black p-4 bg-slate-50 text-center flex flex-col items-center justify-center hover:bg-slate-100/80 transition-colors relative">
                      <Upload className="text-slate-400 mb-2" size={24} />
                      <span className="text-xs font-black uppercase text-slate-900 mb-1">ลากไฟล์ JSON มาวาง หรือคลิกเพื่ออัปโหลด</span>
                      <span className="text-[10px] text-slate-500 font-medium">รองรับเฉพาะไฟล์ .json</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleAttendanceFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-slate-500 my-1">
                      <div className="flex-1 h-[1.5px] bg-slate-300" />
                      <span className="text-[9px] font-black uppercase font-mono tracking-widest text-slate-400 shrink-0">หรือวางข้อความ JSON</span>
                      <div className="flex-1 h-[1.5px] bg-slate-300" />
                    </div>

                    {/* Textarea Area */}
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono block mb-1">ข้อมูลในรูปแบบ JSON Array</span>
                      <textarea
                        placeholder={`[
  "AH10002898",
  "AH10002899",
  {
    "userIdentifier": "AH10002900",
    "userName": "สมศักดิ์ รักไทย",
    "department": "Engineering",
    "company": "Aapico Hitech"
  }
]`}
                        rows={6}
                        id="bulk-attendance-textarea"
                        className="w-full p-2 border-3 border-black rounded-none text-xs font-mono focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white"
                      />
                    </div>

                    {bulkJsonError && (
                      <div className="p-3 bg-rose-50 border-2 border-black text-rose-800 rounded-none text-xs flex items-start gap-2">
                        <AlertCircle className="shrink-0 text-rose-600" size={14} />
                        <span className="font-bold leading-tight">{bulkJsonError}</span>
                      </div>
                    )}

                    <div className="border-t-2 border-black pt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBulkUploadModal(false);
                          setBulkJsonError(null);
                        }}
                        className="py-2 px-4 bg-white hover:bg-slate-100 text-slate-950 border-2 border-black font-black text-xs uppercase tracking-wider rounded-none cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const val = (document.getElementById("bulk-attendance-textarea") as HTMLTextAreaElement)?.value || "";
                          handleBulkAttendanceJson(val);
                        }}
                        className="py-2 px-4 bg-[#2DC84D] hover:bg-green-600 text-black border-2 border-black font-black text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
                      >
                        นำเข้ารายชื่อ (Import)
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
