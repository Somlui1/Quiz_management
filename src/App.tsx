import React, { useState, useEffect } from "react";
import CampaignManager from "./components/CampaignManager";
import QuizTaker from "./components/QuizTaker";
import QuestionBank from "./components/QuestionBank";
import AAPICOSmartEvalLogo from "./components/AAPICOSmartEvalLogo";
import BrandingGuidelines from "./components/BrandingGuidelines";
import AdminRolesManager from "./components/AdminRolesManager";
import { 
  ShieldCheck, 
  ArrowRight, 
  BookOpen, 
  Clock, 
  BarChart3, 
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Palette,
  Lock,
  User,
  LogIn,
  LogOut,
  Database,
  Users
} from "lucide-react";
import { CustomAlertOptions } from "./types";
import { showSuccess, showError, showWarning } from "./lib/swal";

export default function App() {
  // Read query parameters
  const [urlCampaignId, setUrlCampaignId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"student" | "admin">("student");
  const [adminMenu, setAdminMenu] = useState<"bank" | "campaigns" | "branding" | "roles">("bank");
  const [inputCampaignId, setInputCampaignId] = useState("");

  // System Admin & Teacher authentication states
  const [adminUser, setAdminUser] = useState<{ name: string; department: string; emNo: string } | null>(() => {
    try {
      const saved = localStorage.getItem("authenticated_admin_profile");
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);

  // Global custom dialog states for alert, confirm, and prompt
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: "alert" | "confirm" | "prompt";
    alertType: "info" | "success" | "error" | "warning";
    title: string;
    message: string;
    defaultValue?: string;
    inputValue?: string;
    resolvePromise?: (value: any) => void;
  }>({
    isOpen: false,
    type: "alert",
    alertType: "info",
    title: "",
    message: "",
    defaultValue: "",
    inputValue: ""
  });

  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;

    window.showCustomAlert = (options: string | CustomAlertOptions) => {
      return new Promise<void>((resolve) => {
        let title = "แจ้งเตือนจากระบบ";
        let message = "";
        let type: "info" | "success" | "error" | "warning" = "info";
        let onCloseCallback: (() => void) | undefined;

        if (typeof options === "string") {
          message = options;
          const msg = options.toLowerCase();
          if (
            msg.includes("สำเร็จ") || 
            msg.includes("นำเข้าสำเร็จ") || 
            msg.includes("success") || 
            msg.includes("ผ่าน") ||
            msg.includes("บันทึกแคมเปญ")
          ) {
            type = "success";
            title = "ดำเนินการสำเร็จ";
          } else if (
            msg.includes("ผิดพลาด") || 
            msg.includes("error") || 
            msg.includes("ล้มเหลว") || 
            msg.includes("ไม่สามารถ") || 
            msg.includes("ขออภัย") || 
            msg.includes("กรุณา") ||
            msg.includes("หมดเวลา")
          ) {
            type = "warning";
            title = "คำเตือน";
          }
        } else {
          message = options.message;
          title = options.title || "แจ้งเตือนจากระบบ";
          type = options.type || "info";
          onCloseCallback = options.onClose;
        }

        setDialogState({
          isOpen: true,
          type: "alert",
          alertType: type,
          title,
          message,
          resolvePromise: () => {
            if (onCloseCallback) onCloseCallback();
            resolve();
          }
        });
      });
    };

    window.showCustomConfirm = (title: string, message: string) => {
      return new Promise<boolean>((resolve) => {
        setDialogState({
          isOpen: true,
          type: "confirm",
          alertType: "warning",
          title,
          message,
          resolvePromise: (val) => {
            resolve(!!val);
          }
        });
      });
    };

    window.showCustomPrompt = (message: string, defaultValue = "") => {
      return new Promise<string | null>((resolve) => {
        setDialogState({
          isOpen: true,
          type: "prompt",
          alertType: "info",
          title: "ระบุข้อมูลเพิ่มเติม",
          message,
          defaultValue,
          inputValue: defaultValue,
          resolvePromise: (val) => {
            resolve(val === null ? null : String(val));
          }
        });
      });
    };

    // Override native browser alert with our beautiful custom alert
    window.alert = (msg: string) => {
      window.showCustomAlert?.(msg);
    };

    (window as any).confirm = (msg: string) => {
      return window.showCustomConfirm?.("ยืนยันการทำรายการ", msg);
    };

    (window as any).prompt = (msg: string, def?: string) => {
      return window.showCustomPrompt?.(msg, def || "");
    };

    return () => {
      window.alert = originalAlert;
      (window as any).confirm = originalConfirm;
      (window as any).prompt = originalPrompt;
      delete window.showCustomAlert;
      delete window.showCustomConfirm;
      delete window.showCustomPrompt;
    };
  }, []);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("campaignId");
    if (id) {
      setUrlCampaignId(id);
    }
  }, []);

  const handleJoinExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCampaignId.trim()) return;
    
    // Set query parameter and reload/refresh state so it enters the exam room
    const cleanId = inputCampaignId.trim().toLowerCase();
    window.history.pushState({}, "", `?campaignId=${cleanId}`);
    setUrlCampaignId(cleanId);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId.trim() || !adminPassword.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณากรอก รหัสพนักงาน (EM No) และรหัสผ่าน");
      return;
    }

    try {
      setAdminLoginLoading(true);
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: adminId.trim(),
          password: adminPassword.trim(),
          isAdminLogin: true
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Username หรือ Password ไม่ถูกต้อง");
      }

      const data = await res.json();
      const userObj = data.user || data;
      const fetchedName = userObj.name || userObj.firstName || userObj.username || adminId.trim();
      const fetchedSurname = userObj.surname || userObj.lastName || "";
      const fetchedEmNo = userObj["em No"] || userObj.emNo || userObj.em_no || userObj.employeeNumber || adminId.trim();
      const fetchedDepartment = userObj.department || userObj.dept || "";

      const profile = {
        name: fetchedName + " " + fetchedSurname,
        department: fetchedDepartment,
        emNo: fetchedEmNo
      };

      setAdminUser(profile);
      localStorage.setItem("authenticated_admin_profile", JSON.stringify(profile));
      showSuccess("เข้าสู่ระบบผู้ดูแลสำเร็จ", `ยินดีต้อนรับอาจารย์ ${profile.name} เข้าสู่ระบบจัดการข้อสอบ`);
      setAdminId("");
      setAdminPassword("");
    } catch (err: any) {
      showError("เข้าสู่ระบบไม่สำเร็จ", err.message || "เกิดข้อผิดพลาดในการตรวจสอบบัญชีผู้ใช้");
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    localStorage.removeItem("authenticated_admin_profile");
    showSuccess("ลงชื่อออกสำเร็จ", "คุณได้ลงชื่อออกจากระบบผู้ดูแลเรียบร้อยแล้ว");
  };

  const handleQuitExam = () => {
    // Clear query parameter and return to home page
    window.history.pushState({}, "", window.location.pathname);
    setUrlCampaignId(null);
    setActiveTab("student");
  };

  // Render direct Student Exam Room
  if (urlCampaignId) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
        {/* Simple navbar for the exam room */}
        <header className="bg-white border-b-3 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-0 md:h-18 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AAPICOSmartEvalLogo size={36} />
              <div>
                <span className="font-black text-slate-950 uppercase tracking-tighter text-base font-sans block leading-none">AAPICO SmartEval</span>
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block font-mono mt-0.5">E-Testing Room</span>
              </div>
            </div>
            <button
              onClick={handleQuitExam}
              className="text-xs font-black text-slate-950 uppercase tracking-wider transition-all cursor-pointer border-3 border-black px-4 py-2 rounded-none bg-white hover:bg-slate-50 shadow-[3px_3px_0px_0px_#464C59] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              ออกจากการสอบ / กลับหน้าหลัก
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <QuizTaker campaignId={urlCampaignId} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans text-slate-900 flex flex-col justify-between">
      {/* BEGIN: TopHeader */}
      <header className="bg-white border-b-3 border-black w-full" data-purpose="main-site-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 w-full">
          <div className="flex items-center gap-4">
            <AAPICOSmartEvalLogo size={42} />
            <div className="text-left">
              <h1 className="font-bold text-xl leading-tight">AAPICO SMARTEVAL</h1>
              <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">Digital Evaluation & Testing Platform</p>
            </div>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <button 
              onClick={() => setActiveTab("student")}
              className={`px-4 py-2 neo-border-2 flex items-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === "student"
                  ? "bg-brand-accent-blue text-white shadow-[2px_2px_0px_0px_#000]"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              สำหรับผู้สอบ
            </button>
            <button 
              onClick={() => setActiveTab("admin")}
              className={`px-4 py-2 neo-border-2 flex items-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === "admin"
                  ? "bg-brand-accent-blue text-white shadow-[2px_2px_0px_0px_#000]"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              ผู้ดูแลระบบ / อาจารย์
            </button>
          </div>
        </div>
      </header>
      {/* END: TopHeader */}

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex-1 flex flex-col justify-between">
        {/* Main Workspace */}
        <main className="flex-1 w-full py-8 flex flex-col justify-center">
        {activeTab === "student" ? (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-6 w-full">
            {/* Left promo graphics column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left pr-0 lg:pr-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border-2 border-black rounded-none text-[10px] font-black text-aapico-blue uppercase tracking-widest font-mono">
                SECURE ANTI-FRAUD ENGINE ACTIVE
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tighter leading-none font-sans uppercase">
                ระบบจัดสอบความรู้ <br />
                <span className="text-aapico-blue">และวิเคราะห์สถิติแม่นยำ</span>
              </h1>
              <p className="text-sm text-slate-500 max-w-lg leading-relaxed mx-auto lg:mx-0 font-medium">
                ยินดีต้อนรับเข้าสู่ระบบจัดการและประเมินผลทักษะความรู้ดิจิทัล มั่นคงสูงด้วยระบบคลังคำถามและชุดสอบแยกฐานข้อมูลตามกลุ่ม มั่นใจด้วยการสลับสับสุ่มข้อสอบ ป้องกันทุจริตแบบทันที
              </p>

              {/* USP Row - Bento boxes - strictly 90-degree angles and hard shadows */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-5 bg-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2 text-left">
                  <div className="p-2 bg-slate-100 border border-black rounded-none w-9 h-9 flex items-center justify-center">
                    <Clock size={16} className="text-aapico-blue" />
                  </div>
                  <p className="text-xs font-black text-slate-950 uppercase tracking-tight">ระบบจับเวลา</p>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">ส่งผลการทดสอบทันทีที่สิ้นสุดเวลาเพื่อความเที่ยงตรง</p>
                </div>
                <div className="p-5 bg-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2 text-left">
                  <div className="p-2 bg-slate-100 border border-black rounded-none w-9 h-9 flex items-center justify-center">
                    <AAPICOSmartEvalLogo size={20} />
                  </div>
                  <p className="text-xs font-black text-slate-950 uppercase tracking-tight">สุ่มสลับโจทย์</p>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">สลับสับเปลี่ยนข้อสอบและตัวเลือกสำหรับผู้ทำสอบแต่ละคน</p>
                </div>
                <div className="p-5 bg-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2 text-left">
                  <div className="p-2 bg-slate-100 border border-black rounded-none w-9 h-9 flex items-center justify-center">
                    <BarChart3 size={16} className="text-aapico-blue" />
                  </div>
                  <p className="text-xs font-black text-slate-950 uppercase tracking-tight">วิเคราะห์เรียลไทม์</p>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">วิเคราะห์สถิติคะแนน ความยากข้อสอบ และอัตราผ่านอย่างละเอียด</p>
                </div>
              </div>
            </div>

            {/* Right student Join input column */}
            <div className="lg:col-span-5 bg-white border-3 border-black rounded-none p-6 sm:p-8 shadow-[5px_5px_0px_0px_#464C59]">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center p-3.5 bg-slate-100 text-aapico-blue rounded-none mb-3 border-3 border-black shadow-[3px_3px_0px_0px_#464C59]">
                  <BookOpen size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-900 font-sans tracking-tight uppercase">เข้าสู่ห้องสอบ E-Exam</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">กรอกรหัสห้องสอบควิซที่ได้รับจากอาจารย์ผู้คุมสอบเพื่อเข้าห้องสอบ</p>
              </div>

              <form onSubmit={handleJoinExam} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">
                    รหัสห้องสอบควิซ (Exam Room ID / Campaign ID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น midterm-math-m1"
                    value={inputCampaignId}
                    onChange={(e) => setInputCampaignId(e.target.value)}
                    className="w-full px-4 py-3 border-3 border-black rounded-none text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue focus:border-aapico-blue"
                  />
                  <span className="text-[10px] text-slate-400 block mt-2 leading-normal">
                    * รหัสนี้จะได้รับเป็นลิงก์เฉพาะ หรือสแกน QR Code จากอาจารย์ผู้คุมสอบเพื่อทำสอบในกลุ่มฐานข้อมูลแยกเฉพาะ
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-3.5 bg-aapico-green hover:bg-emerald-400 text-black rounded-none text-xs font-black uppercase tracking-widest border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  เข้าสู่ระบบเพื่อทำข้อสอบ
                  <ArrowRight size={14} />
                </button>

                <div className="border-t-3 border-black pt-5 mt-4 text-center">
                  <p className="text-xs text-slate-500 font-bold mb-2 font-mono uppercase tracking-wider">หรือทดลองจำลองครบ Loop ของระบบทันที:</p>
                  <button
                    type="button"
                    onClick={() => {
                      setInputCampaignId("demo-quiz");
                      window.history.pushState({}, "", "?campaignId=demo-quiz");
                      setUrlCampaignId("demo-quiz");
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-aapico-blue hover:bg-indigo-900 text-white rounded-none text-[11px] font-black uppercase tracking-wider border-3 border-black shadow-[3px_3px_0px_0px_#464C59] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                  >
                    เข้าสู่ห้องสอบสาธิต (Demo Exam Room ID: demo-quiz)
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : !adminUser ? (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-6 w-full animate-in fade-in duration-350">
            {/* Left promo graphics column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left pr-0 lg:pr-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#eef2f6] border-2 border-black rounded-none text-[10px] font-black text-aapico-blue uppercase tracking-widest font-mono">
                SECURE ADMIN PANEL AUTHORIZATION
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tighter leading-none font-sans uppercase text-left">
                ระบบจัดการทดสอบ <br />
                <span className="text-aapico-blue">และประเมินผลความรู้ระดับองค์กร</span>
              </h1>
              <p className="text-sm text-slate-500 max-w-lg leading-relaxed mx-auto lg:mx-0 font-medium text-left">
                ยินดีต้อนรับอาจารย์และเจ้าหน้าที่ผู้ประเมิน เข้าสู่ศูนย์กลางบริหารคลังข้อสอบและวิเคราะห์ผลการทดสอบดิจิทัล ปลอดภัย รวดเร็ว และประเมินผลได้ทันที
              </p>

              {/* USP Row - Bento boxes - strictly 90-degree angles and hard shadows */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-5 bg-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2 text-left">
                  <div className="p-2 bg-slate-100 border border-black rounded-none w-9 h-9 flex items-center justify-center">
                    <Database size={16} className="text-aapico-blue" />
                  </div>
                  <p className="text-xs font-black text-slate-950 uppercase tracking-tight">ระบบคลังข้อสอบ</p>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">สร้าง จัดการ และจัดหมวดหมู่คลังคำถามได้ไม่จำกัดจำนวน</p>
                </div>
                <div className="p-5 bg-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2 text-left">
                  <div className="p-2 bg-slate-100 border border-black rounded-none w-9 h-9 flex items-center justify-center">
                    <Users size={16} className="text-aapico-blue" />
                  </div>
                  <p className="text-xs font-black text-slate-950 uppercase tracking-tight">จัดการห้องสอบ</p>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">คุมสอบ ติดตามความคืบหน้า และประมวลผลคะแนนอัตโนมัติ</p>
                </div>
                <div className="p-5 bg-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-2 text-left">
                  <div className="p-2 bg-slate-100 border border-black rounded-none w-9 h-9 flex items-center justify-center">
                    <ShieldCheck size={16} className="text-aapico-blue" />
                  </div>
                  <p className="text-xs font-black text-slate-950 uppercase tracking-tight">ความปลอดภัยสูง</p>
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">ควบคุมการสลับข้อสอบ และระบบยืนยันตัวตนระดับองค์กร</p>
                </div>
              </div>
            </div>

            {/* Right admin input column */}
            <div className="lg:col-span-5 bg-white border-3 border-black rounded-none p-6 sm:p-8 shadow-[5px_5px_0px_0px_#464C59] w-full">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center p-3.5 bg-aapico-blue text-white rounded-none mb-3 border-3 border-black shadow-[3px_3px_0px_0px_#464C59]">
                  <ShieldCheck size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-900 font-sans tracking-tight uppercase text-center">ลงชื่อเข้าสู่ระบบผู้ดูแล / อาจารย์</h2>
                <p className="text-xs text-slate-500 font-medium mt-1 text-center">ยืนยันตัวตนผ่านระบบตรวจสอบประวัติการทำงาน ESS (Employee Self-Service)</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-5 text-left">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">
                    รหัสพนักงาน (EM ID / Username)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User size={14} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="เช่น AH10002898"
                      value={adminId}
                      onChange={(e) => setAdminId(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border-3 border-black rounded-none text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">
                    รหัสผ่าน (Password)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Lock size={14} />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="รหัสผ่านเข้าสู่ระบบ"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border-3 border-black rounded-none text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={adminLoginLoading}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-3.5 bg-aapico-blue text-white hover:bg-[#132448] disabled:bg-slate-200 disabled:text-slate-400 rounded-none text-xs font-black uppercase tracking-widest border-3 border-black shadow-[4px_4px_0px_0px_#464C59] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer font-sans"
                >
                  {adminLoginLoading ? (
                    <span>กำลังตรวจสอบ...</span>
                  ) : (
                    <>
                      <span>เข้าสู่ระบบจัดการ</span>
                      <LogIn size={14} className="shrink-0" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* BEGIN: RedesignedStatusNotification */}
            <section className="relative" data-purpose="status-bar">
              <div className="text-white neo-border-3 neo-shadow-black p-5 flex flex-col md:flex-row items-center justify-between gap-6 bg-brand-accent-blue">
                {/* Identity & Status Info */}
                <div className="flex items-center gap-6">
                  {/* Status Icon with Neo-Brutalism style wrapper */}
                  <div className="bg-neo-green p-3 neo-border-2 border-white">
                    <ShieldCheck className="w-8 h-8 text-black" />
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-neo-green font-bold text-sm tracking-widest uppercase">Authorized Access</span>
                      <div className="h-1 w-8 bg-neo-green"></div>
                    </div>
                    <h2 className="text-xl font-bold">ระบบผู้ดูแลระบบที่ผ่านการตรวจสอบสิทธิ์</h2>
                    <p className="text-gray-300 font-medium">
                      อาจารย์ {adminUser.name} <span className="text-neo-green font-bold ml-2">({adminUser.department || adminUser.emNo || "IT-96-Indirect"})</span>
                    </p>
                  </div>
                </div>
                {/* Action Area */}
                <div className="flex items-center">
                  <button 
                    onClick={handleAdminLogout}
                    className="bg-neo-red text-white font-bold py-3 px-8 neo-border-2 border-white neo-shadow-black neo-button-hover neo-button-active flex items-center gap-3 group transition-all cursor-pointer"
                  >
                    <span className="text-lg">ลงชื่อออก</span>
                    <LogOut className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </section>
            {/* END: RedesignedStatusNotification */}

            {/* BEGIN: MainContentTabs */}
            <nav className="flex flex-wrap gap-0" data-purpose="tab-navigation">
              <button 
                onClick={() => setAdminMenu("bank")}
                className={`px-6 py-4 neo-border-2 border-r-0 font-bold text-sm hover:bg-gray-100 uppercase tracking-tighter cursor-pointer transition-all ${
                  adminMenu === "bank"
                    ? "bg-brand-accent-blue text-white shadow-[4px_4px_0px_0px_#000]"
                    : "bg-white text-slate-800"
                }`}
              >
                คลังข้อสอบ (QUESTION BANK)
              </button>
              <button 
                onClick={() => setAdminMenu("campaigns")}
                className={`px-6 py-4 neo-border-2 border-r-0 font-bold text-sm hover:bg-gray-100 uppercase tracking-tighter cursor-pointer transition-all ${
                  adminMenu === "campaigns"
                    ? "bg-brand-accent-blue text-white shadow-[4px_4px_0px_0px_#000]"
                    : "bg-white text-slate-800"
                }`}
              >
                จัดการห้องสอบ (EXAM ROOMS)
              </button>
              <button 
                onClick={() => setAdminMenu("branding")}
                className={`px-6 py-4 neo-border-2 border-r-0 font-bold text-sm hover:bg-gray-100 flex items-center gap-2 uppercase tracking-tighter cursor-pointer transition-all ${
                  adminMenu === "branding"
                    ? "bg-brand-accent-blue text-white shadow-[4px_4px_0px_0px_#000]"
                    : "bg-white text-slate-800"
                }`}
              >
                <Palette className="w-4 h-4" />
                คู่มือแบรนด์ (CI BOOK)
              </button>
              <button 
                onClick={() => setAdminMenu("roles")}
                className={`px-6 py-4 neo-border-2 font-bold text-sm hover:bg-gray-100 flex items-center gap-2 uppercase tracking-tighter cursor-pointer transition-all ${
                  adminMenu === "roles"
                    ? "bg-brand-accent-blue text-white shadow-[4px_4px_0px_0px_#000]"
                    : "bg-white text-slate-800"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                จัดการสิทธิ์ (ADMIN ROLES)
              </button>
            </nav>
            {/* END: MainContentTabs */}

            {/* BEGIN: MainContentArea */}
            <main className="bg-white neo-border-2 neo-shadow-black p-4 md:p-8 min-h-[600px]" data-purpose="content-display">
              {adminMenu === "bank" ? (
                <QuestionBank />
              ) : adminMenu === "campaigns" ? (
                <CampaignManager />
              ) : adminMenu === "branding" ? (
                <BrandingGuidelines />
              ) : (
                <AdminRolesManager />
              )}
            </main>
            {/* END: MainContentArea */}
          </div>
        )}
      </main>

      {/* Elegant, humble and clean Footer */}
      <footer className="bg-white border-t-3 border-black py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono gap-2">
          <span>AAPICO SmartEval — Secure Isolated Session Database Powered on SQLite (WAL Mode)</span>
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse border border-slate-900" />
            <span>SQLite WAL Active</span>
          </div>
        </div>
      </footer>

      {/* Neo-Brutalist Custom Dialog Modal Overlay */}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex justify-center items-start sm:items-center bg-slate-950/60 backdrop-blur-sm">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 transition-opacity cursor-pointer"
            onClick={() => {
              const resolve = dialogState.resolvePromise;
              setDialogState(prev => ({ ...prev, isOpen: false }));
              if (resolve) {
                if (dialogState.type === "alert") resolve(undefined);
                else if (dialogState.type === "confirm") resolve(false);
                else if (dialogState.type === "prompt") resolve(null);
              }
            }}
          />
          
          {/* Dialog Card Container */}
          <div 
            className="relative my-auto w-full max-w-md bg-white border-4 border-slate-900 rounded-3xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transition-all animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Header banner based on alert/dialog type */}
            <div className={`px-5 py-4 border-b-4 border-slate-900 flex items-center justify-between ${
              dialogState.type === "confirm" ? "bg-amber-400" :
              dialogState.type === "prompt" ? "bg-cyan-400" :
              dialogState.alertType === "success" ? "bg-emerald-400" :
              dialogState.alertType === "error" ? "bg-rose-400" :
              dialogState.alertType === "warning" ? "bg-amber-400" : "bg-cyan-400"
            }`}>
              <div className="flex items-center gap-2.5">
                {dialogState.type === "confirm" && <AlertTriangle className="text-slate-900 shrink-0" size={20} />}
                {dialogState.type === "prompt" && <HelpCircle className="text-slate-900 shrink-0" size={20} />}
                {dialogState.type === "alert" && (
                  <>
                    {dialogState.alertType === "success" && <CheckCircle2 className="text-slate-900 shrink-0" size={20} />}
                    {dialogState.alertType === "error" && <AlertCircle className="text-slate-900 shrink-0" size={20} />}
                    {dialogState.alertType === "warning" && <AlertTriangle className="text-slate-900 shrink-0" size={20} />}
                    {dialogState.alertType === "info" && <Info className="text-slate-900 shrink-0" size={20} />}
                  </>
                )}
                
                <h3 className="font-black text-slate-950 uppercase tracking-tight text-xs sm:text-sm font-sans">
                  {dialogState.title}
                </h3>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  const resolve = dialogState.resolvePromise;
                  setDialogState(prev => ({ ...prev, isOpen: false }));
                  if (resolve) {
                    if (dialogState.type === "alert") resolve(undefined);
                    else if (dialogState.type === "confirm") resolve(false);
                    else if (dialogState.type === "prompt") resolve(null);
                  }
                }}
                className="p-1 hover:bg-slate-950/10 active:translate-y-[1px] transition-all rounded-lg border border-transparent hover:border-slate-900 cursor-pointer text-slate-950"
              >
                <X size={16} />
              </button>
            </div>

            {/* Dialog Message Body */}
            <div className="p-6 space-y-5 bg-white">
              <p className="text-slate-900 font-bold text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {dialogState.message}
              </p>

              {/* Text Input for Prompt */}
              {dialogState.type === "prompt" && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={dialogState.inputValue || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDialogState(prev => ({ ...prev, inputValue: val }));
                    }}
                    autoFocus
                    placeholder="พิมพ์ข้อมูลตอบกลับที่นี่..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const resolve = dialogState.resolvePromise;
                        const val = dialogState.inputValue;
                        setDialogState(prev => ({ ...prev, isOpen: false }));
                        if (resolve) resolve(val);
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Action Buttons layout */}
              <div className="flex justify-end gap-3 pt-1">
                {/* Cancel Button (for Confirm and Prompt) */}
                {dialogState.type !== "alert" && (
                  <button
                    type="button"
                    onClick={() => {
                      const resolve = dialogState.resolvePromise;
                      setDialogState(prev => ({ ...prev, isOpen: false }));
                      if (resolve) {
                        if (dialogState.type === "confirm") resolve(false);
                        else if (dialogState.type === "prompt") resolve(null);
                      }
                    }}
                    className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-black uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer text-[11px]"
                  >
                    ยกเลิก / Cancel
                  </button>
                )}

                {/* Submit/Acknowledge Button */}
                <button
                  type="button"
                  autoFocus={dialogState.type !== "prompt"}
                  onClick={() => {
                    const resolve = dialogState.resolvePromise;
                    const val = dialogState.type === "prompt" ? dialogState.inputValue : true;
                    setDialogState(prev => ({ ...prev, isOpen: false }));
                    if (resolve) resolve(val);
                  }}
                  className={`px-5 py-2.5 border-2 border-slate-900 text-slate-950 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer ${
                    dialogState.type === "confirm" ? "bg-amber-400 hover:bg-amber-500" :
                    dialogState.type === "prompt" ? "bg-cyan-400 hover:bg-cyan-500" :
                    dialogState.alertType === "success" ? "bg-emerald-400 hover:bg-emerald-500" :
                    dialogState.alertType === "error" ? "bg-rose-400 hover:bg-rose-500" :
                    dialogState.alertType === "warning" ? "bg-amber-400 hover:bg-amber-500" : "bg-cyan-400 hover:bg-cyan-500"
                  }`}
                >
                  {dialogState.type === "confirm" ? "ยืนยัน / Confirm" :
                   dialogState.type === "prompt" ? "ตกลง / Submit" : "ตกลง / OK"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

