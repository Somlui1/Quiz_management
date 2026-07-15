import React, { useState, useEffect, useRef } from "react";
import { 
  ChevronLeft, ChevronRight, Clock, AlertCircle, CheckCircle, 
  XCircle, Send, FileText, User, Hash, Award, Lock, KeyRound, 
  ShieldCheck, Mail, Briefcase, Fingerprint, LogOut, Building 
} from "lucide-react";
import { showSuccess, showError, showWarning, showConfirm } from "../lib/swal";

interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
}

interface QuizCampaign {
  id: string;
  name: string;
  groupName: string;
  timeLimitMinutes: number;
  passingPercentage: number;
  totalQuestionsToTest?: number;
  maxAttempts?: number;
  resultsDisplayMode?: string;
  isUntimed?: boolean;
  questions: QuizQuestion[];
  updatedAt?: string;
  updated_at?: string;
}

interface QuizTakerProps {
  campaignId: string;
}

interface EvaluationResult {
  scorePercent: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
  passingCriteria: number;
  answersEvaluation: Array<{
    questionId: string;
    questionText: string;
    correctAnswer: string;
    selectedAnswer: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
}

export default function QuizTaker({ campaignId }: QuizTakerProps) {
  const [campaign, setCampaign] = useState<QuizCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Registration
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasAcceptedInstruction, setHasAcceptedInstruction] = useState(false);
  const [userName, setUserName] = useState("");
  const [userIdentifier, setUserIdentifier] = useState("");
  const [department, setDepartment] = useState("");

  // Authentication & Profile States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [userProfile, setUserProfile] = useState<{
    name: string;
    surname: string;
    emNo: string;
    department: string;
    companyEmail: string;
    company: string;
    jwt: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Exam state
  const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // maps question ID -> selected option text
  const [timeRemaining, setTimeRemaining] = useState<number>(0); // in seconds
  const [isExamActive, setIsExamActive] = useState(false);
  const [attemptId, setAttemptId] = useState<string>("");
  const [durationUsed, setDurationUsed] = useState<number>(0);
  const [layoutMode, setLayoutMode] = useState<"slider" | "scroll">("slider");
  
  // Submit evaluation result
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Storage local keys
  const storageKey = `quiz_progress_${campaignId}`;

  // Log out and clear all states and persisted cache
  const handleLogout = () => {
    localStorage.removeItem("authenticated_user_profile");
    localStorage.removeItem(storageKey);
    setIsAuthenticated(false);
    setUserProfile(null);
    setPassword("");
    setHasAcceptedInstruction(false);
    setIsRegistered(false);
    setShuffledQuestions([]);
    setAnswers({});
    setCurrentIdx(0);
    setIsExamActive(false);
    setResult(null);
    showSuccess("ออกจากระบบสำเร็จ", "ระบบได้ทำการเคลียร์ข้อมูลค้างและออกจากระบบให้เรียบร้อยแล้ว");
  };

  // Timer Ref to count duration used
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch campaign details on load
  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/campaigns/${campaignId}/student`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "เกิดข้อผิดพลาดในการโหลดข้อสอบ");
        }
        const data = await res.json();
        setCampaign(data);

        // Try to recover progress from LocalStorage
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.campaignId === campaignId) {
              const serverUpdatedAt = data.updatedAt || data.updated_at || "";
              const cachedUpdatedAt = parsed.updatedAt || "";
              
              if (serverUpdatedAt && cachedUpdatedAt && serverUpdatedAt !== cachedUpdatedAt) {
                // The campaign was updated or started anew on the server! Clean up stale progress.
                localStorage.removeItem(storageKey);
                setIsRegistered(false);
                setHasAcceptedInstruction(false);
                setShuffledQuestions([]);
                setAnswers({});
                setCurrentIdx(0);
                setIsExamActive(false);
              } else {
                setUserName(parsed.userName);
                setUserIdentifier(parsed.userIdentifier);
                setDepartment(parsed.department || "");
                setIsRegistered(true);
                setHasAcceptedInstruction(true);
                setShuffledQuestions(parsed.shuffledQuestions);
                setAnswers(parsed.answers);
                setTimeRemaining(parsed.timeRemaining);
                setCurrentIdx(parsed.currentIdx || 0);
                setAttemptId(parsed.attemptId || "");
                setIsExamActive(true);
                
                if (parsed.userProfile) {
                  setUserProfile(parsed.userProfile);
                  setIsAuthenticated(true);
                }
              }
            }
          } catch (_) {
            // LocalStorage parsing failed, proceed as normal
          }
        }
      } catch (err: any) {
        setError(err.message || "ไม่สามารถดึงข้อมูลห้องสอบข้อสอบได้");
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  // Authentication Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdentifier.trim() || !password.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณากรอก รหัสพนักงาน (EM No) และรหัสผ่าน");
      return;
    }

    try {
      setAuthLoading(true);
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: userIdentifier.trim(),
          password: password.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Username หรือ Password ไม่ถูกต้อง");
      }

      const data = await res.json();
      
      // Defensively parse user details
      const userObj = data.user || data;
      const fetchedName = userObj.name || userObj.firstName || userObj.username || userIdentifier.trim();
      const fetchedSurname = userObj.surname || userObj.lastName || "";
      const fetchedEmNo = userObj["em No"] || userObj.emNo || userObj.em_no || userObj.employeeNumber || userIdentifier.trim();
      const fetchedDepartment = userObj.department || userObj.dept || "";
      const fetchedEmail = userObj["company email"] || userObj.companyEmail || userObj.company_email || userObj.email || "";
      const fetchedCompany = userObj.company || "";
      const jwtToken = data.jwt || data.token || "";

      const profile = {
        name: fetchedName,
        surname: fetchedSurname,
        emNo: fetchedEmNo,
        department: fetchedDepartment,
        companyEmail: fetchedEmail,
        company: fetchedCompany,
        jwt: jwtToken
      };

      setUserProfile(profile);
      setIsAuthenticated(true);
      setUserName(fetchedName + " " + fetchedSurname);
      setDepartment(fetchedDepartment);
      
      localStorage.setItem("authenticated_user_profile", JSON.stringify(profile));

      // Check if stored progress belongs to another user. If so, discard/clear it so this user gets a clean, correctly randomized exam!
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.userIdentifier !== fetchedEmNo) {
            localStorage.removeItem(storageKey);
            // Reset state values to start fresh
            setIsRegistered(false);
            setHasAcceptedInstruction(false);
            setShuffledQuestions([]);
            setAnswers({});
            setCurrentIdx(0);
            setIsExamActive(false);
          }
        } catch (_) {}
      }

      showSuccess("เข้าสู่ระบบสำเร็จ", `ยินดีต้อนรับคุณ ${fetchedName} บัญชีผู้ใช้ได้รับการตรวจสอบเรียบร้อยแล้ว`);
    } catch (err: any) {
      showError("เข้าสู่ระบบไม่สำเร็จ", err.message || "Username หรือ Password ไม่ถูกต้อง");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleStartExam = async () => {
    const activeIdentifier = userProfile?.emNo || userIdentifier;
    if (!userName.trim() || !activeIdentifier.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณากรอกข้อมูลประจำตัวของคุณก่อนเข้าสอบ");
      return;
    }

    if (!campaign) return;

    try {
      setLoading(true);
      const checkRes = await fetch(`/api/campaigns/${campaignId}/attempts/${encodeURIComponent(activeIdentifier.trim())}`);
      if (!checkRes.ok) {
        throw new Error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อตรวจสอบสิทธิ์ได้");
      }
      const checkData = await checkRes.json();
      if (!checkData.allowed) {
        showWarning(
          "หมดสิทธิ์สอบห้องสอบนี้",
          `ขออภัย: ท่านได้ทำการส่งข้อสอบห้องสอบนี้ครบสิทธิ์จำกัดแล้ว (${checkData.attemptsCount}/${checkData.maxAttempts} ครั้ง) หากมีข้อสงสัยกรุณาติดต่อผู้ควบคุมการจัดสอบ`
        );
        setLoading(false);
        return;
      }
    } catch (err: any) {
      showError("ข้อผิดพลาดในการตรวจสอบสิทธิ์", err.message);
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }

    // Call server API to start attempt and retrieve randomized questions (fully secured)
    let randomizedQuestions: QuizQuestion[] = [];
    let fetchedAttemptId = "";
    try {
      setLoading(true);
      const startRes = await fetch(`/api/campaigns/${campaignId}/start-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIdentifier: activeIdentifier.trim() })
      });
      if (!startRes.ok) {
        const errorData = await startRes.json();
        throw new Error(errorData.error || "ไม่สามารถสร้างรอบการสอบจากระบบกลางได้");
      }
      const startData = await startRes.json();
      randomizedQuestions = startData.questions;
      fetchedAttemptId = startData.attemptId;
    } catch (err: any) {
      showError("ข้อผิดพลาดในการเริ่มทำข้อสอบ", err.message);
      return;
    } finally {
      setLoading(false);
    }

    const initialSeconds = campaign.timeLimitMinutes * 60;

    setShuffledQuestions(randomizedQuestions);
    setAttemptId(fetchedAttemptId);
    setTimeRemaining(initialSeconds);
    setAnswers({});
    setCurrentIdx(0);
    setIsRegistered(true);
    setIsExamActive(true);

    // Initial save to local storage
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        campaignId,
        userName: userName.trim(),
        userIdentifier: activeIdentifier.trim(),
        department: department.trim(),
        userProfile,
        shuffledQuestions: randomizedQuestions,
        attemptId: fetchedAttemptId,
        answers: {},
        timeRemaining: initialSeconds,
        currentIdx: 0,
        updatedAt: campaign?.updatedAt || campaign?.updated_at || "",
      })
    );

    // Notify server of active join
    fetch(`/api/campaigns/${campaignId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIdentifier: activeIdentifier.trim(),
        userName: userName.trim(),
        department: department.trim()
      })
    }).catch(err => console.error("Error joining live lobby:", err));
  };

  // Timer tick down
  useEffect(() => {
    if (!isExamActive || result) return;
    if (!campaign?.isUntimed && timeRemaining <= 0) return;

    const interval = setInterval(() => {
      if (!campaign?.isUntimed) {
        setTimeRemaining((prev) => {
          const nextTime = prev - 1;
          return nextTime < 0 ? 0 : nextTime;
        });
      }
      setDurationUsed((d) => d + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isExamActive, timeRemaining <= 0, !!result, campaign?.isUntimed]);

  // Save progress to LocalStorage
  useEffect(() => {
    if (!isExamActive || result) return;
    if (!campaign?.isUntimed && timeRemaining <= 0) return;

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        campaignId,
        userName,
        userIdentifier,
        department,
        userProfile,
        shuffledQuestions,
        answers,
        timeRemaining,
        currentIdx,
        attemptId,
        updatedAt: campaign?.updatedAt || campaign?.updated_at || "",
      })
    );
  }, [isExamActive, timeRemaining, result, answers, currentIdx, userName, userIdentifier, department, shuffledQuestions, userProfile, attemptId, campaign]);

  // Trigger Auto-Submit when timer expires
  useEffect(() => {
    if (isExamActive && !campaign?.isUntimed && timeRemaining === 0 && !result && !submitting) {
      handleAutoSubmit();
    }
  }, [isExamActive, timeRemaining, result, submitting, campaign?.isUntimed]);

  // Handle single answer change
  const handleSelectOption = (questionId: string, optionText: string) => {
    const updatedAnswers = {
      ...answers,
      [questionId]: optionText,
    };
    setAnswers(updatedAnswers);

    // Save update to LocalStorage
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        campaignId,
        userName,
        userIdentifier,
        department,
        userProfile,
        shuffledQuestions,
        answers: updatedAnswers,
        timeRemaining,
        currentIdx,
        attemptId,
        updatedAt: campaign?.updatedAt || campaign?.updated_at || "",
      })
    );
  };

  // Auto submission when time is up
  const handleAutoSubmit = () => {
    showWarning("หมดเวลาแล้ว", "หมดเวลาในการทำข้อสอบแล้ว! ระบบจะทำการส่งข้อสอบของคุณโดยอัตโนมัติ");
    executeSubmit(true);
  };

  // Form manual submit
  const handleManualSubmit = async () => {
    const answeredCount = Object.keys(answers).length;
    const totalCount = shuffledQuestions.length;
    const unansweredCount = totalCount - answeredCount;

    let confirmTitle = "ยืนยันส่งคำตอบ?";
    let confirmMsg = "คุณต้องการส่งข้อสอบเพื่อตรวจคะแนนใช่หรือไม่?";
    if (unansweredCount > 0) {
      confirmTitle = "ตอบคำถามยังไม่ครบ!";
      confirmMsg = `คุณยังไม่ได้ตอบคำถามอีก ${unansweredCount} ข้อ จากทั้งหมด ${totalCount} ข้อ ต้องการยืนยันส่งข้อสอบทันทีใช่หรือไม่?`;
    }

    const hasConfirmed = await showConfirm(confirmTitle, confirmMsg);
    if (hasConfirmed) {
      executeSubmit(false);
    }
  };

  // Submit actual API call
  const executeSubmit = async (isTimeout = false) => {
    if (!campaign) return;
    setSubmitting(true);

    const payload = {
      userName: userName.trim(),
      userIdentifier: userIdentifier.trim(),
      department: department.trim(),
      surname: userProfile?.surname || "",
      emNo: userProfile?.emNo || userIdentifier.trim(),
      companyEmail: userProfile?.companyEmail || "",
      company: userProfile?.company || "",
      answers,
      durationSeconds: durationUsed || (campaign.timeLimitMinutes * 60 - timeRemaining),
      questionIds: shuffledQuestions.map(q => q.id),
      attemptId,
    };

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit exam");
      }

      const evaluation = await res.json();
      setResult(evaluation);

      // Successfully submitted, clear this campaign LocalStorage progress
      localStorage.removeItem(storageKey);
      setIsExamActive(false);
    } catch (err: any) {
      showError("ไม่สามารถส่งข้อสอบได้", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleNext = () => {
    if (currentIdx < shuffledQuestions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      // Update LocalStorage current index
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          campaignId,
          userName,
          userIdentifier,
          department,
          shuffledQuestions,
          answers,
          timeRemaining,
          currentIdx: nextIdx,
          attemptId,
        })
      );
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      // Update LocalStorage current index
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          campaignId,
          userName,
          userIdentifier,
          shuffledQuestions,
          answers,
          timeRemaining,
          currentIdx: prevIdx,
          attemptId,
        })
      );
    }
  };

  // Loading indicator on very first fetch
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-8/12 max-w-sm p-6 bg-white border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] text-center">
          <div className="w-8 h-8 border-4 border-[#1D366D] border-t-transparent rounded-none animate-spin mb-4 mx-auto" />
          <p className="text-slate-900 font-black font-mono text-xs uppercase tracking-wider">กำลังเปิดระบบสอบ...</p>
        </div>
      </div>
    );
  }

  // Error feedback (including inactive/scheduled close/not found)
  if (error || !campaign) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border-3 border-black rounded-none shadow-[6px_6px_0px_0px_#464C59] text-center">
        <AlertCircle className="text-rose-600 mx-auto mb-3" size={44} />
        <h2 className="text-lg font-black text-slate-900 font-sans uppercase">ไม่สามารถทำข้อสอบได้</h2>
        <p className="text-xs text-rose-700 font-bold bg-rose-50 border-3 border-black rounded-none p-3.5 mt-3 font-mono">
          {error || "ไม่พบห้องสอบข้อสอบนี้ในระบบ"}
        </p>
        <p className="text-xs text-slate-500 mt-4 leading-relaxed font-medium">
          หากท่านสแกน QR Code เข้ามา อาจเกิดจากการปิดห้องสอบโดยอาจารย์ผู้สอน หรือหมดช่วงเวลาการเข้าสอบที่กำหนดไว้
        </p>
      </div>
    );
  }

  // A. Score Evaluation Result Screen (Criteria/Instant Checker)
  if (result) {
    const displayMode = campaign.resultsDisplayMode || "full";

    if (displayMode === "hidden") {
      return (
        <div className="max-w-md mx-auto my-12 p-8 bg-white border-3 border-black rounded-none shadow-[6px_6px_0px_0px_#464C59] text-center animate-in fade-in duration-300">
          <CheckCircle className="text-[#2DC84D] mx-auto mb-4" size={64} />
          <h2 className="text-xl font-black text-slate-900 font-sans uppercase">บันทึกคำตอบข้อสอบสำเร็จแล้ว</h2>
          <p className="text-xs text-slate-600 mt-2 font-medium bg-slate-50 border-3 border-black p-3.5 rounded-none">
            ระบบได้รับการส่งคำตอบวิชา <span className="font-bold text-slate-900">{campaign.name}</span> ของคุณเรียบร้อยแล้ว ขอบคุณสำหรับการทำข้อสอบ
          </p>
          <div className="mt-6 p-4 bg-blue-50 border-3 border-black rounded-none text-[10px] text-slate-600 font-medium font-sans leading-relaxed text-left">
            <strong>หมายเหตุเพิ่มเติมจากทางระบบ:</strong> ตามนโยบายการจัดสอบของห้องสอบนี้ ผลคะแนนสอบรายบุคคลจะไม่ถูกแสดงผลแก่พนักงานทันทีหลังจากสอบเสร็จสิ้น ข้อมูลทั้งหมดจะถูกส่งตรงไปยังฝ่ายบุคคลหรือผู้ควบคุมการสอนเพื่อพิจารณาประเมินผลอย่างเป็นทางการ
          </div>
          <div className="mt-6">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-[#1D366D] hover:bg-indigo-950 text-white border-3 border-black rounded-none text-xs font-black uppercase font-sans tracking-wider transition-all shadow-[4px_4px_0px_0px_#464C59] active:translate-y-[2px] active:shadow-none cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <LogOut size={14} />
              เสร็จสิ้นและออกจากระบบสอบ (Logout)
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto my-6 space-y-6 text-left">
        {/* Pass / Fail Banner Card */}
        <div
          className={`p-8 border-3 border-black rounded-none text-center relative overflow-hidden shadow-[6px_6px_0px_0px_#464C59] ${
            result.passed
              ? "bg-[#2DC84D] text-black"
              : "bg-rose-300 text-slate-950"
          }`}
        >
          {result.passed ? (
            <CheckCircle className="text-black mx-auto mb-3 animate-bounce" size={54} />
          ) : (
            <XCircle className="text-slate-950 mx-auto mb-3" size={54} />
          )}

          <h2 className="text-2xl font-black font-sans tracking-tight uppercase text-black">
            {result.passed ? "ยินดีด้วย คุณสอบผ่านเกณฑ์!" : "เสียใจด้วย คุณไม่ผ่านเกณฑ์"}
          </h2>
          <p className="text-xs text-slate-900 font-bold mt-1">
            เกณฑ์คะแนนขั้นต่ำผ่าน: <span className="underline decoration-2 font-black">{result.passingCriteria}%</span>
          </p>

          <div className="mt-6 inline-flex items-baseline gap-2 p-4 bg-white border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] uppercase font-black text-slate-500 font-mono tracking-widest">เปอร์เซ็นต์คะแนน:</span>
            <span className={`text-3xl font-black font-mono ${result.passed ? "text-emerald-600" : "text-rose-600"}`}>
              {result.scorePercent}%
            </span>
            <span className="text-xs text-slate-400 font-mono font-bold">
              ({result.correctCount} / {result.totalQuestions} ข้อ)
            </span>
          </div>
        </div>

        {/* Detailed Instant Checker Breakdown (ONLY if Mode is "full") */}
        {displayMode === "full" ? (
          <div className="bg-white border-3 border-black rounded-none p-6 shadow-[4px_4px_0px_0px_#464C59] space-y-4">
            <div className="border-b-3 border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <FileText size={16} className="text-[#1D366D]" />
                เฉลยพร้อมอธิบายคำตอบ (Instant Checker & Correction)
              </h3>
              <p className="text-xs text-slate-400 font-medium">ตรวจสอบจุดที่ผิดพลาดเพื่อเป็นความรู้ในการสอบครั้งถัดไป</p>
            </div>

            <div className="space-y-4">
              {result.answersEvaluation.map((ev, idx) => (
                <div
                  key={ev.questionId}
                  className={`p-4 rounded-none border-3 border-black flex flex-col sm:flex-row sm:items-start justify-between gap-4 shadow-[3px_3px_0px_0px_#464C59] ${
                    ev.isCorrect
                      ? "bg-slate-50"
                      : "bg-rose-50/20"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-none bg-slate-900 text-white text-xs font-black font-mono shrink-0 mt-0.5 border-2 border-black">
                        {idx + 1}
                      </span>
                      <p className="font-bold text-slate-900 text-xs leading-relaxed">{ev.questionText}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans pl-8">
                      <div className="p-2.5 bg-white border-2 border-black rounded-none text-slate-700 font-medium">
                        คำตอบที่คุณเลือก: <strong className={ev.isCorrect ? "text-[#2DC84D]" : "text-rose-600"}>{ev.selectedAnswer || "- ไม่ได้เลือกตอบ -"}</strong>
                      </div>
                      {!ev.isCorrect && (
                        <div className="p-2.5 bg-emerald-50 border-2 border-black rounded-none text-slate-700 font-medium">
                          คำตอบที่ถูกต้อง: <strong className="text-emerald-700">{ev.correctAnswer}</strong>
                        </div>
                      )}
                    </div>

                    {ev.explanation && (
                      <div className="mt-2 ml-8 p-3 bg-blue-50 border-2 border-black rounded-none text-xs text-slate-700 font-sans leading-relaxed">
                        <span className="font-black text-slate-900 flex items-center gap-1 mb-0.5">
                          คำอธิบายเพิ่มเติม:
                        </span>
                        <p className="font-semibold text-slate-600">{ev.explanation}</p>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 pl-8 sm:pl-0">
                    {ev.isCorrect ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none bg-[#2DC84D] text-black text-xs font-black border-2 border-black font-sans shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        <CheckCircle size={14} />
                        ถูกต้อง
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none bg-rose-300 text-slate-950 text-xs font-black border-2 border-black font-sans shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        <XCircle size={14} />
                        ผิดพลาด
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white border-3 border-black rounded-none p-8 shadow-[4px_4px_0px_0px_#464C59] text-center space-y-3">
            <Lock size={32} className="mx-auto text-slate-500 animate-pulse" />
            <h3 className="text-sm font-black text-slate-900 uppercase font-sans">สงวนสิทธิ์การเข้าถึงเฉลยและคำตอบ</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto font-medium leading-relaxed">
              สอดคล้องกับการตั้งค่าแบบประเมินสำหรับพนักงานสอบ: คะแนนและเฉลยจะไม่ถูกเปิดเผยแบบระบุรายละเอียดในโหมดนี้ เพื่อความถูกต้องของกระบวนการวัดผลขององค์กร
            </p>
          </div>
        )}
        
        {/* Finish and Logout Button */}
        <div className="pt-4 text-center">
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-[#1D366D] hover:bg-indigo-950 text-white border-3 border-black rounded-none text-xs font-black uppercase font-sans tracking-wider transition-all shadow-[4px_4px_0px_0px_#464C59] active:translate-y-[2px] active:shadow-none cursor-pointer inline-flex items-center gap-2"
          >
            <LogOut size={14} />
            เสร็จสิ้นและออกจากระบบสอบ (Logout)
          </button>
        </div>
      </div>
    );
  }

  // B1. Secure Authentication Login Screen
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white border-3 border-black rounded-none shadow-[6px_6px_0px_0px_#464C59] overflow-hidden animate-in fade-in duration-300 text-left">
        {/* Banner with Key icon */}
        <div className="bg-[#1D366D] p-6 text-white text-center border-b-3 border-black">
          <KeyRound className="mx-auto text-white mb-2" size={32} />
          <h2 className="text-base font-black font-sans tracking-tight uppercase">เข้าสู่ระบบสอบพนักงาน (ESS Login)</h2>
          <p className="text-[10px] text-slate-300 mt-1 font-bold font-mono">ห้องสอบควิซ: {campaign.name}</p>
        </div>

        {/* Login form container */}
        <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
          <div className="space-y-3">
            {/* Username/Identifier Input */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1 font-mono">
                <User size={12} className="text-slate-900" /> รหัสพนักงาน (EM No)
              </label>
              <input
                type="text"
                required
                placeholder="เช่น AH1000xxxx"
                value={userIdentifier}
                onChange={(e) => setUserIdentifier(e.target.value)}
                className="w-full px-3.5 py-2.5 border-3 border-black focus:ring-2 focus:ring-indigo-500 rounded-none text-xs font-mono text-slate-900 font-bold focus:outline-none bg-white placeholder-slate-400"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1 font-mono">
                <Lock size={12} className="text-slate-900" /> รหัสผ่าน (Password)
              </label>
              <input
                type="password"
                required
                placeholder="กรอกรหัสผ่านของคุณ"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border-3 border-black focus:ring-2 focus:ring-indigo-500 rounded-none text-xs font-mono text-slate-900 font-bold focus:outline-none bg-white placeholder-slate-400"
              />
            </div>
          </div>

          <div className="bg-slate-50 border-3 border-black p-3.5 rounded-none flex items-start gap-2.5 text-xs text-slate-600 font-medium">
            <Fingerprint size={16} className="text-slate-900 shrink-0 mt-0.5" />
            <div className="text-[10px] leading-relaxed">
              <p className="font-bold text-slate-800">ระบบตรวจสอบสิทธิ์ผ่าน ESS Platform</p>
              <p className="text-slate-500 mt-0.5">การระบุข้อมูลประจำตัวที่ถูกต้องจะดึงข้อมูลประวัติแผนก อีเมล และชื่อจริงจากฐานข้อมูลเพื่อความปลอดภัยสูงสุดและป้องกันการทำแทน</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3 bg-[#2DC84D] hover:bg-emerald-500 text-black border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#464C59] active:translate-y-[2px] active:shadow-none disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2 font-sans"
          >
            {authLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-none animate-spin" />
                กำลังตรวจสอบสิทธิ์...
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                ตรวจสอบข้อมูลผู้ใช้จริง
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // B1.5 Instruction Page (User Workflow Step 1)
  if (!hasAcceptedInstruction) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-white border-3 border-black rounded-none shadow-[6px_6px_0px_0px_#464C59] overflow-hidden animate-in fade-in duration-300 text-left">
        <div className="bg-[#1D366D] p-6 text-white text-center border-b-3 border-black">
          <FileText className="mx-auto text-white mb-2" size={32} />
          <h2 className="text-base font-black font-sans tracking-tight uppercase">หน้าชี้แจงรายละเอียดการทดสอบ (Instruction Page)</h2>
          <p className="text-[10px] text-slate-300 mt-1 font-bold font-mono">ห้องสอบควิซ: {campaign.name}</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="p-4 bg-blue-50 border-3 border-black rounded-none space-y-2">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1">
              สวัสดีครับ คุณ {userName || "ผู้สอบ"}
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed font-semibold">
              ยินดีต้อนรับเข้าสู่ระบบประเมินความรู้พนักงาน (ESS Platform) สำหรับหัวข้อการทดสอบ <span className="text-[#1D366D] font-black">"{campaign.name}"</span> โปรดสละเวลาอ่านรายละเอียดต่อไปนี้อย่างถี่ถ้วนก่อนเริ่มต้นการทดสอบ:
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="p-3 bg-slate-50 border-2 border-black rounded-none flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase">เวลาสอบทั้งหมด</span>
                <span className="text-xs font-black text-slate-900">{campaign.isUntimed ? "ไม่จำกัดเวลา" : `${campaign.timeLimitMinutes} นาที`}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-2 border-black rounded-none flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase">โจทย์คำถามสอบจริง</span>
                <span className="text-xs font-black text-slate-900">
                  {campaign.totalQuestionsToTest && campaign.totalQuestionsToTest > 0 
                    ? `${campaign.totalQuestionsToTest} ข้อ (สุ่มจากคลัง)` 
                    : `${campaign.questions.length} ข้อ`}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-2 border-black rounded-none flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase">เกณฑ์การผ่าน</span>
                <span className="text-xs font-black text-[#2DC84D]">{campaign.passingPercentage}% ของคะแนนเต็ม</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-2 border-black rounded-none flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase">กลุ่มเป้าหมาย</span>
                <span className="text-xs font-black text-slate-900 truncate block">{campaign.groupName || "-"}</span>
              </div>
            </div>
          </div>

          {/* Instructions Box */}
          <div className="space-y-3 pt-2 border-t-2 border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-mono">คำชี้แจงในการเลือกตัดสินใจ (Your Choices)</span>
            
            <div className="space-y-3">
              <div className="p-3.5 bg-rose-50 border-2 border-black rounded-none flex gap-3 text-xs">
                <XCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-rose-950 font-semibold text-[11px]">
                  <strong>หากคุณคลิก "ไม่เข้าร่วม":</strong> ระบบจะนำคุณออกจากหน้านี้โดยทันที โดย <span className="underline font-black">สิทธิ์และจำนวนครั้งในการทำข้อสอบของคุณจะไม่สูญเสียหรือถูกหักไป</span> และคุณสามารถกลับเข้ามาล็อกอินเข้าทดสอบใหม่ได้ทุกเมื่อเมื่อพร้อม
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50 border-2 border-black rounded-none flex gap-3 text-xs">
                <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-emerald-950 font-semibold text-[11px]">
                  <strong>หากคุณคลิก "เข้าร่วม":</strong> ระบบจะนำคุณเข้าสู่หน้าแสดงข้อมูลส่วนตัว (User Information) เพื่อตรวจสอบความถูกต้องของข้อมูลพนักงาน ก่อนเริ่มต้นทำแบบทดสอบทันที
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => {
                localStorage.removeItem("authenticated_user_profile");
                localStorage.removeItem(storageKey);
                setIsAuthenticated(false);
                setUserProfile(null);
                setPassword("");
                setHasAcceptedInstruction(false);
                setIsRegistered(false);
                setShuffledQuestions([]);
                setAnswers({});
                setCurrentIdx(0);
                setIsExamActive(false);
                showSuccess("ออกจากระบบสำเร็จ", "สิทธิ์การสอบของคุณยังคงอยู่ครบถ้วนตามเดิม สามารถเข้าทดสอบภายหลังได้เมื่อพร้อมครับ");
              }}
              className="py-3 px-4 bg-rose-200 hover:bg-rose-300 text-slate-950 border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#464C59] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <XCircle size={14} className="text-rose-700" /> ไม่เข้าร่วม
            </button>

            <button
              onClick={() => {
                setHasAcceptedInstruction(true);
              }}
              className="py-3 px-4 bg-[#2DC84D] hover:bg-emerald-500 text-black border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#464C59] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <CheckCircle size={14} className="text-emerald-700" /> เข้าร่วม
            </button>
          </div>
        </div>
      </div>
    );
  }

  // B2. Pre-test Verified Profile Gate Screen (Verification Required)
  if (!isRegistered) {
    return (
      <div className="max-w-md mx-auto my-8 bg-white border-3 border-black rounded-none shadow-[6px_6px_0px_0px_#464C59] overflow-hidden animate-in fade-in duration-300 text-left">
        {/* Verification banner header */}
        <div className="bg-[#1D366D] p-6 text-white text-center border-b-3 border-black">
          <ShieldCheck className="mx-auto text-white mb-2" size={32} />
          <h2 className="text-lg font-black font-sans tracking-tight uppercase">ยืนยันโปรไฟล์ผู้เข้าสอบ</h2>
          <p className="text-[10px] text-slate-300 font-mono font-bold">Verified Candidate Profile Gate</p>
        </div>

        {/* Verified details container */}
        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border-3 border-black rounded-none p-4 text-xs text-amber-900 space-y-1">
            <p className="font-black flex items-center gap-1">
              <AlertCircle size={14} /> โปรดอ่านคำชี้แจงก่อนทำข้อสอบ
            </p>
            <p className="leading-relaxed text-[11px] text-amber-800 font-medium">
              ข้อมูลโปรไฟล์พนักงานด้านล่างนี้ ได้รับการดึงขึ้นมาจากระบบฐานข้อมูลจริงอย่างเป็นทางการของบริษัท หากข้อมูลถูกต้องครบถ้วน กรุณากดปุ่ม <strong>"ยืนยันความถูกต้องและเริ่มทำข้อสอบ"</strong> ด้านล่างเพื่อเริ่มทำทันที
            </p>
          </div>

          {/* Profile fields bento grid */}
          <div className="space-y-3 text-left">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">ข้อมูลพนักงานของคุณ (Verified Profile)</span>
            
            <div className="p-4 bg-slate-50 border-3 border-black rounded-none space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {/* Name & Surname */}
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white border border-slate-200 rounded-none text-slate-700">
                  <User size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block font-mono">ชื่อจริง - นามสกุล</span>
                  <span className="text-xs font-black text-slate-900">{userProfile?.name} {userProfile?.surname}</span>
                </div>
              </div>

              {/* Employee ID (EM No) */}
              <div className="flex items-center gap-3 border-t-2 border-slate-200 pt-2.5">
                <div className="p-1.5 bg-white border border-slate-200 rounded-none text-slate-700">
                  <Hash size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block font-mono">รหัสพนักงาน (Employee No)</span>
                  <span className="text-xs font-black text-slate-900 font-mono">{userProfile?.emNo}</span>
                </div>
              </div>

              {/* Department */}
              <div className="flex items-center gap-3 border-t-2 border-slate-200 pt-2.5">
                <div className="p-1.5 bg-white border border-slate-200 rounded-none text-slate-700">
                  <Briefcase size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block font-mono">แผนก / ฝ่าย (Department)</span>
                  <span className="text-xs font-black text-slate-900">{userProfile?.department || "-"}</span>
                </div>
              </div>

              {/* Company */}
              <div className="flex items-center gap-3 border-t-2 border-slate-200 pt-2.5">
                <div className="p-1.5 bg-white border border-slate-200 rounded-none text-slate-700">
                  <Building size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block font-mono">บริษัท (Company)</span>
                  <span className="text-xs font-black text-slate-900 font-mono">{userProfile?.company || "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign details */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100 border-3 border-black rounded-none text-[11px] font-black font-mono text-slate-900">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-[#1D366D]" />
              <span>เวลาสอบ: {campaign.isUntimed ? "ไม่จำกัดเวลา" : `${campaign.timeLimitMinutes} นาที`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText size={12} className="text-[#1D366D]" />
              <span>โจทย์คำถาม: {campaign.totalQuestionsToTest && campaign.totalQuestionsToTest > 0 ? `${campaign.totalQuestionsToTest} ข้อ` : `${campaign.questions.length} ข้อ`}</span>
            </div>
          </div>

          {/* Buttons row */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleStartExam}
              className="w-full py-3 bg-[#2DC84D] hover:bg-emerald-500 text-black border-3 border-black rounded-none text-xs font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#464C59] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck size={14} />
              ยืนยันโปรไฟล์ & เริ่มทำข้อสอบ
            </button>
            
            <button
              onClick={() => {
                localStorage.removeItem("authenticated_user_profile");
                localStorage.removeItem(storageKey);
                setIsAuthenticated(false);
                setUserProfile(null);
                setPassword("");
                setHasAcceptedInstruction(false);
                setIsRegistered(false);
                setShuffledQuestions([]);
                setAnswers({});
                setCurrentIdx(0);
                setIsExamActive(false);
              }}
              className="w-full py-2 border-3 border-black bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-none text-[10px] font-black font-mono uppercase tracking-wider transition-all cursor-pointer"
            >
              ออกจากระบบ เพื่อเปลี่ยนพนักงานเข้าสอบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // C. Active Exam Taking View
  const activeQuestion = shuffledQuestions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const isTimeUrgent = !campaign?.isUntimed && timeRemaining < 120; // less than 2 minutes left

  return (
    <div className="max-w-4xl mx-auto my-4 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start text-left">
      {/* Sidebar: Navigation Grid & Clock */}
      <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 order-last lg:order-first">
        {/* Floating Timer Card */}
        <div className={`p-4 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_#464C59] flex items-center justify-between ${
          !campaign?.isUntimed && isTimeUrgent 
            ? "bg-rose-300 text-slate-950 animate-pulse" 
            : "bg-white text-slate-900"
        }`}>
          <div className="flex items-center gap-2">
            <Clock className={!campaign?.isUntimed && isTimeUrgent ? "text-slate-950" : "text-[#1D366D]"} size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest font-mono text-slate-600">
              {campaign?.isUntimed ? "ใช้เวลาทำข้อสอบ:" : "เวลาที่เหลือ:"}
            </span>
          </div>
          <span className="text-xl font-black font-mono tracking-tight text-slate-950">
            {campaign?.isUntimed ? formatTimer(durationUsed) : formatTimer(timeRemaining)}
          </span>
        </div>

        {/* Layout Presentation Toggle */}
        <div className="bg-white border-3 border-black rounded-none p-4 shadow-[4px_4px_0px_0px_#464C59] space-y-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono block border-b-3 border-slate-100 pb-1.5">รูปแบบการแสดงผล (Layout Mode)</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLayoutMode("slider")}
              className={`py-1.5 px-2 text-[10px] font-black font-mono rounded-none transition-all border-3 border-black cursor-pointer ${
                layoutMode === "slider"
                  ? "bg-[#2DC84D] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              ทำทีละข้อ (Slider)
            </button>
            <button
              onClick={() => setLayoutMode("scroll")}
              className={`py-1.5 px-2 text-[10px] font-black font-mono rounded-none transition-all border-3 border-black cursor-pointer ${
                layoutMode === "scroll"
                  ? "bg-[#2DC84D] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              แสดงทั้งหมด (Scroll)
            </button>
          </div>
        </div>

        {/* Student Progress Map Grid */}
        <div className="bg-white border-3 border-black rounded-none p-4 shadow-[4px_4px_0px_0px_#464C59] space-y-3">
          <div className="flex justify-between items-center border-b-3 border-slate-100 pb-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono">แผงคำถาม</span>
            <span className="text-[11px] font-mono font-black text-slate-900 underline">
              ทำแล้ว {answeredCount}/{shuffledQuestions.length}
            </span>
          </div>

          {/* Grid wrapper */}
          <div className="grid grid-cols-5 gap-1.5">
            {shuffledQuestions.map((q, qIndex) => {
              const hasAnswered = answers[q.id] !== undefined;
              const isSelected = currentIdx === qIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIdx(qIndex);
                    if (layoutMode === "scroll") {
                      const el = document.getElementById(`scroll-question-${qIndex}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    }
                  }}
                  className={`py-2 text-xs font-black font-mono rounded-none transition-all border-3 border-black cursor-pointer ${
                    isSelected
                      ? "bg-[#1D366D] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : hasAnswered
                      ? "bg-[#2DC84D] text-black font-black"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {qIndex + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t-3 border-slate-100 flex flex-col gap-1.5 text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-none border-2 border-black bg-[#2DC84D]" />
              <span>ตอบแล้ว</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-none border-2 border-slate-300 bg-slate-100" />
              <span>ยังไม่ได้ตอบ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel: Active Question Slider or Scroll list */}
      <div className="lg:col-span-3 space-y-4">
        {/* Exam Title header */}
        <div className="bg-slate-950 text-white p-4 rounded-none flex items-center justify-between gap-4 border-3 border-black shadow-[4px_4px_0px_0px_#464C59]">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#2DC84D] font-mono">รหัสผู้สอบ: {userIdentifier}</span>
            <h2 className="text-xs font-black font-sans uppercase line-clamp-1 mt-0.5">{campaign.name}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0 font-sans">
            <span className="text-xs font-black font-mono bg-white/10 px-2.5 py-1 rounded-none border border-white/20">
              {layoutMode === "slider" ? `ข้อ ${currentIdx + 1} / ${shuffledQuestions.length}` : `แสดงข้อสอบ ${shuffledQuestions.length} ข้อ`}
            </span>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-none text-[10px] font-black uppercase font-mono tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px]"
            >
              <LogOut size={12} />
              Logout
            </button>
          </div>
        </div>

        {layoutMode === "scroll" ? (
          <div className="space-y-6">
            {shuffledQuestions.map((q, qIdx) => (
              <div key={q.id} id={`scroll-question-${qIdx}`} className="bg-white border-3 border-black rounded-none p-6 shadow-[4px_4px_0px_0px_#464C59] space-y-4 transition-all scroll-mt-6">
                <h3 className="text-base font-black text-slate-900 leading-relaxed font-sans">
                  ข้อที่ {qIdx + 1}. {q.text}
                </h3>
                <div className="space-y-3 pl-1">
                  {q.options.map((option, oIdx) => {
                    const isChecked = answers[q.id] === option;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => {
                          handleSelectOption(q.id, option);
                          setCurrentIdx(qIdx);
                        }}
                        className={`w-full text-left p-4 rounded-none text-xs font-bold border-3 border-black flex items-center gap-3 transition-all cursor-pointer ${
                          isChecked
                            ? "bg-blue-50 text-slate-950 border-[#1D366D] ring-2 ring-[#1D366D]/10"
                            : "bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-none border-2 border-black flex items-center justify-center font-black text-xs font-mono shrink-0 transition-all ${
                          isChecked
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="leading-relaxed font-bold">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Scroll Submit Banner */}
            <div className="bg-white border-3 border-black rounded-none p-6 shadow-[4px_4px_0px_0px_#464C59] flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500 font-bold">
                กรุณาตรวจสอบความถูกต้องของคำตอบทั้งหมด {answeredCount} / {shuffledQuestions.length} ข้อ ก่อนกดส่งคำตอบ
              </span>
              <button
                disabled={submitting}
                onClick={handleManualSubmit}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#2DC84D] hover:bg-emerald-500 text-black text-xs font-black rounded-none border-3 border-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-y-[1px] transition-all cursor-pointer shrink-0"
              >
                <Send size={14} />
                {submitting ? "กำลังส่งคำตอบ..." : "ส่งข้อสอบทั้งหมด"}
              </button>
            </div>
          </div>
        ) : (
          /* Question Slider Container */
          activeQuestion && (
            <div className="bg-white border-3 border-black rounded-none p-6 sm:p-8 shadow-[4px_4px_0px_0px_#464C59] flex flex-col justify-between min-h-[40vh] space-y-6">
              <div className="space-y-6">
                {/* Question Text */}
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-relaxed font-sans">
                  {activeQuestion.text}
                </h3>

                {/* Shuffled Options choices */}
                <div className="space-y-3 pl-1">
                  {activeQuestion.options.map((option, oIdx) => {
                    const isChecked = answers[activeQuestion.id] === option;

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleSelectOption(activeQuestion.id, option)}
                        className={`w-full text-left p-4 rounded-none text-xs font-bold border-3 border-black flex items-center gap-3 transition-all cursor-pointer ${
                          isChecked
                            ? "bg-blue-50 text-slate-950 border-[#1D366D] ring-2 ring-[#1D366D]/10"
                            : "bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-none border-2 border-black flex items-center justify-center font-black text-xs font-mono shrink-0 transition-all ${
                          isChecked
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="leading-relaxed font-bold">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slider Navigation Footer */}
              <div className="flex items-center justify-between gap-3 pt-6 border-t-3 border-slate-100">
                <button
                  disabled={currentIdx === 0}
                  onClick={handlePrev}
                  className="inline-flex items-center gap-1 px-4 py-2 border-3 border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 text-xs font-black text-slate-800 rounded-none transition-all cursor-pointer shadow-[2px_2px_0px_0px_#464C59] active:translate-y-[1px]"
                >
                  <ChevronLeft size={16} />
                  ย้อนกลับ
                </button>

                {currentIdx < shuffledQuestions.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="inline-flex items-center gap-1 px-5 py-2.5 bg-[#1D366D] hover:bg-indigo-950 text-white text-xs font-black rounded-none border-3 border-black shadow-[2px_2px_0px_0px_#464C59] active:translate-y-[1px] transition-all cursor-pointer"
                  >
                    ข้อถัดไป
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    disabled={submitting}
                    onClick={handleManualSubmit}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#2DC84D] hover:bg-emerald-500 text-black text-xs font-black rounded-none border-3 border-black shadow-[2px_2px_0px_0px_#464C59] active:translate-y-[1px] transition-all cursor-pointer"
                  >
                    <Send size={14} />
                    {submitting ? "กำลังส่งคำตอบ..." : "ส่งข้อสอบ"}
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
