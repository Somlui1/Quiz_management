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

  // Attempts info state (Retry Feature)
  const [attemptsInfo, setAttemptsInfo] = useState<{ attemptsCount: number; maxAttempts: number; allowed: boolean } | null>(null);

  const fetchAttemptsInfo = async (identifier: string) => {
    if (campaignId === "tour-demo-quiz") {
      const mockInfo = { attemptsCount: 0, maxAttempts: 0, allowed: true };
      setAttemptsInfo(mockInfo);
      return mockInfo;
    }
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/attempts/${encodeURIComponent(identifier.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setAttemptsInfo(data);
        return data;
      }
    } catch (err) {
      console.error("Error fetching attempts info:", err);
    }
    return null;
  };

  useEffect(() => {
    const activeId = userProfile?.emNo || userIdentifier;
    if (activeId && campaignId) {
      fetchAttemptsInfo(activeId);
    }
  }, [campaignId, userProfile?.emNo, userIdentifier, isAuthenticated]);

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

  // Retry / restart exam logic
  const handleRetryExam = async () => {
    const activeIdentifier = userProfile?.emNo || userIdentifier;
    if (!activeIdentifier) {
      showWarning("ไม่พบบัญชีผู้ใช้", "กรุณาลงชื่อเข้าใช้ใหม่อีกครั้ง");
      return;
    }

    // Refresh attempts information
    const updatedInfo = await fetchAttemptsInfo(activeIdentifier);
    const maxAttempts = updatedInfo?.maxAttempts || campaign?.maxAttempts || 0;
    const count = updatedInfo?.attemptsCount ?? 0;

    if (maxAttempts > 0 && count >= maxAttempts) {
      showWarning(
        "หมดสิทธิ์สอบห้องสอบนี้",
        `คุณได้ใช้สิทธิ์ส่งข้อสอบห้องสอบนี้ครบแล้ว (${count}/${maxAttempts} ครั้ง) หากมีข้อสงสัยกรุณาติดต่อผู้ดูแลระบบ`
      );
      return;
    }

    const hasConfirmed = await showConfirm(
      "ต้องการเริ่มทำข้อสอบใหม่ (Retry)?",
      `คุณกำลังใช้สิทธิ์สอบครั้งถัดไป (ครั้งที่ ${count + 1} จากทั้งหมด ${maxAttempts > 0 ? maxAttempts : "ไม่จำกัด"} ครั้ง) เพื่อทำแบบทดสอบใหม่อีกครั้ง ยืนยันเริ่มทำข้อสอบใช่หรือไม่?`
    );
    if (!hasConfirmed) return;

    // Clear exam state & progress cache
    localStorage.removeItem(storageKey);
    setShuffledQuestions([]);
    setAnswers({});
    setCurrentIdx(0);
    setTimeRemaining(0);
    setIsExamActive(false);
    setResult(null);
    setHasAcceptedInstruction(false);
    setIsRegistered(false);

    // Trigger start exam
    handleStartExam();
  };

  const renderRetrySection = () => {
    if (!attemptsInfo) return null;

    const { attemptsCount, maxAttempts, allowed } = attemptsInfo;
    const isUnlimited = maxAttempts === 0;
    const remaining = isUnlimited ? 999 : (maxAttempts - attemptsCount);

    return (
      <div className="p-6 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4 text-center mt-6">
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold text-slate-800 font-sans uppercase tracking-tight">
            สถิติสิทธิ์การทำข้อสอบใหม่ (Retry attempts)
          </h4>
          <div className="flex flex-wrap justify-center items-center gap-3 text-xs">
            <span className="px-2.5 py-1 bg-[#1D366D] text-white rounded-lg font-bold">
              ทำสอบไปแล้ว: {attemptsCount} ครั้ง
            </span>
            <span className="px-2.5 py-1 bg-slate-200 text-slate-800 rounded-lg font-bold">
              สิทธิ์ทั้งหมด: {isUnlimited ? "ไม่จำกัด" : `${maxAttempts} ครั้ง`}
            </span>
            <span className={`px-2.5 py-1 rounded-lg font-bold ${remaining > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
              {isUnlimited ? "เหลือสิทธิ์ทำใหม่อีก: ไม่จำกัดครั้ง" : `เหลือสิทธิ์ทำใหม่อีก: ${remaining} ครั้ง`}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {allowed && (
            <button
              onClick={handleRetryExam}
              className="w-full sm:w-auto px-8 py-3 bg-[#2DC84D] hover:bg-emerald-500 text-black rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-sm active:translate-y-[1px] cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <Award size={14} />
              เริ่มทำข้อสอบใหม่ (Retry)
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto px-8 py-3 bg-[#1D366D] hover:bg-indigo-950 text-white rounded-full text-xs font-bold tracking-wider transition-all duration-200 shadow-sm hover:shadow-md active:translate-y-[1px] cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <LogOut size={14} />
            เสร็จสิ้นและออกจากระบบสอบ
          </button>
        </div>
      </div>
    );
  };

  // Timer Ref to count duration used
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch campaign details on load
  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        setLoading(true);
        setError(null);
        if (campaignId === "tour-demo-quiz") {
          const mockCampaignData = {
            id: "tour-demo-quiz",
            name: "ควิซสาธิตระบบ (Demo Quiz)",
            groupName: "กลุ่มทดสอบ (Web Guided Tour)",
            passingPercentage: 60,
            timeLimitMinutes: 5,
            questions: [
              {
                id: "q1",
                text: "ข้อสอบ AAPICO SmartEval สนับสนุนการสอบรูปแบบใด?",
                type: "single",
                choices: [
                  "เขียนคำตอบบนกระดาษ",
                  "ออนไลน์ผ่าน E-Testing / E-Exam",
                  "สอบปากเปล่าตัวต่อตัว",
                  "ไม่มีข้อถูก"
                ],
                explanation: "แพลตฟอร์ม AAPICO SmartEval ออกแบบมาเพื่อการทำข้อสอบแบบออนไลน์ E-Testing / E-Exam ไร้กระดาษ"
              },
              {
                id: "q2",
                text: "ระบบ AAPICO SmartEval มีฟีเจอร์ใดต่อไปนี้สำหรับป้องกันการทุจริต?",
                type: "single",
                choices: [
                  "ระบบตรวจสอบเรียลไทม์ (Live Lobby)",
                  "สุ่มสลับโจทย์และตัวเลือกเฉพาะบุคคล",
                  "ล็อกเอาต์เมื่อสิ้นสุดเวลาทำข้อสอบ",
                  "ถูกทุกข้อ"
                ],
                explanation: "มีทั้งระบบตรวจสอบเรียลไทม์ (Live Lobby), ล็อกเอาต์อัตโนมัติ, และระบบสุ่มสลับข้อสอบและตัวเลือกเฉพาะบุคคล"
              }
            ],
            isUntimed: false,
            totalQuestionsToTest: 2,
            maxAttempts: 0,
            resultsDisplayMode: "full",
            randomizationMode: "question_choice"
          };
          setCampaign(mockCampaignData as any);
          setShuffledQuestions(mockCampaignData.questions as any);
          setLoading(false);
          return;
        }
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

  // Guided Tour Event and localStorage Synchronizer
  useEffect(() => {
    const applyTourStepState = (step: number) => {
      if (step === 2) {
        setIsAuthenticated(false);
        setHasAcceptedInstruction(false);
        setIsRegistered(false);
        setIsExamActive(false);
        setResult(null);
      } else if (step === 3) {
        setIsAuthenticated(true);
        setHasAcceptedInstruction(false);
        setIsRegistered(false);
        setIsExamActive(false);
        setResult(null);
        setUserName("สมชาย รักเรียน");
      } else if (step === 4) {
        setIsAuthenticated(true);
        setHasAcceptedInstruction(true);
        setIsRegistered(false);
        setIsExamActive(false);
        setResult(null);
        setUserProfile({
          name: "สมชาย",
          surname: "รักเรียน (Demo)",
          emNo: "AH10009999",
          department: "AAPICO IT Department",
          companyEmail: "somchai.demo@aapico.com",
          company: "AAPICO Hitech PLC",
          jwt: "mock-jwt"
        });
      } else if (step === 5) {
        setIsAuthenticated(true);
        setHasAcceptedInstruction(true);
        setIsRegistered(true);
        setIsExamActive(true);
        setResult(null);
        setAnswers({});
        setCurrentIdx(0);
      } else if (step === 6) {
        setIsAuthenticated(true);
        setHasAcceptedInstruction(true);
        setIsRegistered(true);
        setIsExamActive(false);
        
        const correctCount = Object.keys(answers).filter(qId => {
          if (qId === "q1") return answers[qId] === "ออนไลน์ผ่าน E-Testing / E-Exam";
          if (qId === "q2") return answers[qId] === "ถูกทุกข้อ";
          return false;
        }).length || 2; // Default to 2 correct for demo if none selected

        setResult({
          scorePercent: (correctCount / 2) * 100,
          totalQuestions: 2,
          correctCount,
          passed: (correctCount / 2) * 100 >= 60,
          passingCriteria: 60,
          answersEvaluation: [
            {
              questionId: "q1",
              questionText: "ข้อสอบ AAPICO SmartEval สนับสนุนการสอบรูปแบบใด?",
              correctAnswer: "ออนไลน์ผ่าน E-Testing / E-Exam",
              selectedAnswer: answers["q1"] || "ออนไลน์ผ่าน E-Testing / E-Exam",
              isCorrect: true,
              explanation: "แพลตฟอร์ม AAPICO SmartEval ออกแบบมาเพื่อการทำข้อสอบแบบออนไลน์ E-Testing / E-Exam ไร้กระดาษ"
            },
            {
              questionId: "q2",
              questionText: "ระบบ AAPICO SmartEval มีฟีเจอร์ใดต่อไปนี้สำหรับป้องกันการทุจริต?",
              correctAnswer: "ถูกทุกข้อ",
              selectedAnswer: answers["q2"] || "ถูกทุกข้อ",
              isCorrect: true,
              explanation: "มีทั้งระบบตรวจสอบเรียลไทม์ (Live Lobby), ล็อกเอาต์อัตโนมัติ, และระบบสุ่มสลับข้อสอบและตัวเลือกเฉพาะบุคคล"
            }
          ]
        });
      }
    };

    // 1. Instantly check localStorage for any saved step on mount/campaign change
    if (campaignId === "tour-demo-quiz") {
      try {
        const savedTourActive = localStorage.getItem("aapico_tour_active") === "true";
        const savedTourStep = localStorage.getItem("aapico_tour_step");
        if (savedTourActive && savedTourStep) {
          const stepNum = Number(savedTourStep);
          if (stepNum >= 2 && stepNum <= 6) {
            applyTourStepState(stepNum);
          }
        }
      } catch (_) {}
    }

    // 2. Custom event listener as a real-time reactive trigger
    const handleTourStepChange = (e: CustomEvent) => {
      const step = e.detail.step;
      if (campaignId === "tour-demo-quiz" && step >= 2 && step <= 6) {
        applyTourStepState(step);
      }
    };

    window.addEventListener("tour-step-changed", handleTourStepChange as any);
    return () => {
      window.removeEventListener("tour-step-changed", handleTourStepChange as any);
    };
  }, [campaignId, answers]);

  // Authentication Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (campaignId === "tour-demo-quiz") {
      const profile = {
        name: "สมชาย",
        surname: "รักเรียน (Demo)",
        emNo: userIdentifier.trim() || "AH10009999",
        department: "AAPICO IT Department",
        companyEmail: "somchai.demo@aapico.com",
        company: "AAPICO Hitech PLC",
        jwt: "mock-jwt"
      };
      setUserProfile(profile);
      setIsAuthenticated(true);
      setUserName("สมชาย รักเรียน (Demo)");
      return;
    }
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
    if (campaignId === "tour-demo-quiz") {
      const initialSeconds = campaign.timeLimitMinutes * 60;
      setShuffledQuestions(campaign.questions);
      setAttemptId("tour-demo-attempt");
      setTimeRemaining(initialSeconds);
      setAnswers({});
      setCurrentIdx(0);
      setIsRegistered(true);
      setIsExamActive(true);
      return;
    }
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
      userIdentifier: userProfile?.emNo || userIdentifier.trim(),
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

    if (campaignId === "tour-demo-quiz") {
      const correctCount = Object.keys(answers).filter(qId => {
        if (qId === "q1") return answers[qId] === "ออนไลน์ผ่าน E-Testing / E-Exam";
        if (qId === "q2") return answers[qId] === "ถูกทุกข้อ";
        return false;
      }).length;

      const evaluation = {
        scorePercent: (correctCount / 2) * 100,
        totalQuestions: 2,
        correctCount,
        passed: (correctCount / 2) * 100 >= 60,
        passingCriteria: 60,
        answersEvaluation: [
          {
            questionId: "q1",
            questionText: "ข้อสอบ AAPICO SmartEval สนับสนุนการสอบรูปแบบใด?",
            correctAnswer: "ออนไลน์ผ่าน E-Testing / E-Exam",
            selectedAnswer: answers["q1"] || "ออนไลน์ผ่าน E-Testing / E-Exam",
            isCorrect: answers["q1"] === "ออนไลน์ผ่าน E-Testing / E-Exam",
            explanation: "แพลตฟอร์ม AAPICO SmartEval ออกแบบมาเพื่อการทำข้อสอบแบบออนไลน์ E-Testing / E-Exam ไร้กระดาษ"
          },
          {
            questionId: "q2",
            questionText: "ระบบ AAPICO SmartEval มีฟีเจอร์ใดต่อไปนี้สำหรับป้องกันการทุจริต?",
            correctAnswer: "ถูกทุกข้อ",
            selectedAnswer: answers["q2"] || "ถูกทุกข้อ",
            isCorrect: answers["q2"] === "ถูกทุกข้อ",
            explanation: "มีทั้งระบบตรวจสอบเรียลไทม์ (Live Lobby), ล็อกเอาต์อัตโนมัติ, และระบบสุ่มสลับข้อสอบและตัวเลือกเฉพาะบุคคล"
          }
        ]
      };
      setResult(evaluation as any);
      setIsExamActive(false);
      return;
    }

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

      // Refresh attempts count immediately
      fetchAttemptsInfo(payload.emNo);

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-slate-50/30">
        <div className="w-full max-w-sm p-8 bg-white border border-slate-100 rounded-2xl shadow-lg text-center space-y-4 animate-in fade-in duration-300">
          <div className="w-12 h-12 border-4 border-[#1D366D] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 font-sans tracking-tight">กำลังจัดเตรียมระบบสอบ...</h3>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">ระบบความปลอดภัยกำลังเชื่อมโยงข้อมูลรายชื่อพนักงาน</p>
          </div>
        </div>
      </div>
    );
  }

  // Error feedback (including inactive/scheduled close/not found)
  if (error || !campaign) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-100 rounded-2xl shadow-lg text-center space-y-5 animate-in fade-in duration-300">
        <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
          <AlertCircle size={28} />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-800 font-sans">ไม่สามารถเข้าทำข้อสอบได้</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            ห้องสอบนี้อาจถูกปิดโดยผู้ควบคุมระบบ หรือหมดช่วงเวลาเปิดสอบที่กำหนดไว้ในแผนงานองค์กร
          </p>
        </div>
        <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100/50">
          <p className="text-xs text-rose-700 font-mono font-semibold break-all leading-relaxed">
            {error || "ไม่พบรหัสห้องสอบนี้ในฐานข้อมูล"}
          </p>
        </div>
      </div>
    );
  }

  // A. Score Evaluation Result Screen (Criteria/Instant Checker)
  if (result) {
    const displayMode = campaign.resultsDisplayMode || "full";

    if (displayMode === "hidden") {
      return (
        <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-100 rounded-2xl shadow-lg text-center space-y-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle size={36} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800 font-sans tracking-tight">บันทึกคำตอบสำเร็จแล้ว</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              ระบบได้รับการบันทึกคำตอบวิชา <span className="font-semibold text-slate-800">"{campaign.name}"</span> ของคุณเรียบร้อยแล้ว
            </p>
          </div>
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 text-[11px] text-slate-600 font-sans leading-relaxed text-left">
            <strong>หมายเหตุ:</strong> ตามนโยบายการจัดสอบของฝ่ายประเมินผล ผลคะแนนสอบรายบุคคลของคุณจะไม่แสดงบนหน้านี้ทันที แต่จะนำส่งตรงไปยังฝ่ายทรัพยากรบุคคลหรือผู้บังคับบัญชาเพื่อพิจารณาอย่างเป็นทางการ
          </div>
          {renderRetrySection()}
        </div>
      );
    }

    return (
      <div id="tour-score-card" className="max-w-2xl mx-auto my-8 space-y-6 text-left animate-in fade-in duration-300">
        {/* Pass / Fail Banner Card */}
        <div
          className={`p-8 rounded-2xl text-center relative overflow-hidden border shadow-md ${
            result.passed
              ? "bg-emerald-50 border-emerald-100 text-emerald-950"
              : "bg-rose-50 border-rose-100 text-rose-950"
          }`}
        >
          <div className="space-y-3">
            {result.passed ? (
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle size={28} />
              </div>
            ) : (
              <div className="w-14 h-14 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <XCircle size={28} />
              </div>
            )}

            <div className="space-y-1">
              <h2 className="text-xl font-bold font-sans tracking-tight">
                {result.passed ? "ยินดีด้วย คุณสอบผ่านเกณฑ์ประเมิน!" : "เสียใจด้วย คะแนนของคุณยังไม่ผ่านเกณฑ์"}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                เกณฑ์ผ่านประเมินขั้นต่ำ: <span className="font-semibold text-slate-700">{result.passingCriteria}%</span>
              </p>
            </div>

            <div className="pt-4">
              <div className="inline-flex items-center gap-3 px-5 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">เปอร์เซ็นต์คะแนน</span>
                <span className={`text-2xl font-bold font-mono ${result.passed ? "text-emerald-600" : "text-rose-600"}`}>
                  {result.scorePercent}%
                </span>
                <span className="text-xs text-slate-400 font-semibold border-l border-slate-200 pl-3">
                  (ถูกต้อง {result.correctCount} จาก {result.totalQuestions} ข้อ)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Instant Checker Breakdown (ONLY if Mode is "full") */}
        {displayMode === "full" ? (
          <div id="tour-review-box" className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 font-sans">
                <FileText size={18} className="text-[#1D366D]" />
                สรุปเฉลยและการประเมินรายข้อ (Instant Analysis)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                โปรดทบทวนเฉลยอย่างรอบคอบเพื่อเพิ่มความรู้ความเข้าใจสำหรับประยุกต์ใช้ในการทำงานจริง
              </p>
            </div>

            <div className="space-y-5">
              {result.answersEvaluation.map((ev, idx) => (
                <div
                  key={ev.questionId}
                  className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all duration-200 ${
                    ev.isCorrect
                      ? "bg-slate-50/50 border-slate-100"
                      : "bg-rose-50/20 border-rose-100/30"
                  }`}
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold font-mono shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="font-bold text-slate-800 text-xs sm:text-sm leading-relaxed">{ev.questionText}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pl-9">
                      <div className="p-3 bg-white border border-slate-100 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 block">คำตอบของคุณ:</span>
                        <p className={`font-bold ${ev.isCorrect ? "text-emerald-600" : "text-rose-600"}`}>
                          {ev.selectedAnswer || "- ไม่ได้เลือกตอบ -"}
                        </p>
                      </div>
                      {!ev.isCorrect && (
                        <div className="p-3 bg-emerald-50/40 border border-emerald-100/50 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-emerald-600 block">คำตอบที่ถูกต้อง:</span>
                          <p className="font-bold text-emerald-700">{ev.correctAnswer}</p>
                        </div>
                      )}
                    </div>

                    {ev.explanation && (
                      <div className="mt-2 ml-9 p-3 bg-blue-50/40 border border-blue-100/50 rounded-xl text-xs text-slate-600 leading-relaxed">
                        <span className="font-bold text-slate-800 block mb-1">คำอธิบายเพิ่มเติม:</span>
                        <p className="text-slate-500 font-medium">{ev.explanation}</p>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 pl-9 md:pl-0">
                    {ev.isCorrect ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                        <CheckCircle size={14} />
                        ถูกต้อง
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-100">
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
          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 animate-pulse">
              <Lock size={20} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-800 font-sans uppercase">ข้อมูลเฉลยถูกจำกัดการแสดงผล</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                เนื่องจากเป็นการสอบวัดระดับอย่างเป็นทางการ การเฉลยคำตอบรายข้อจะไม่ถูกเปิดเผยแก่พนักงานโดยตรงเพื่อป้องกันความน่าเชื่อถือของเนื้อหาสอบวิชานี้
              </p>
            </div>
          </div>
        )}
        
        {renderRetrySection()}
      </div>
    );
  }

  // B1. Secure Authentication Login Screen
  if (!isAuthenticated) {
    return (
      <div id="tour-login-card" className="max-w-md mx-auto my-12 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-300 text-left">
        {/* Banner with Key icon */}
        <div className="bg-[#1D366D] p-8 text-white text-center space-y-2">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
            <KeyRound className="text-white" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold font-sans tracking-tight">เข้าสู่ระบบประเมินพนักงาน (ESS Login)</h2>
            <p className="text-[11px] text-slate-300 font-semibold">ห้องสอบ: {campaign.name}</p>
          </div>
        </div>

        {/* Login form container */}
        <form onSubmit={handleLoginSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            {/* Username/Identifier Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 tracking-wide flex items-center gap-1.5 font-sans">
                <User size={14} className="text-slate-400" /> รหัสพนักงาน (EM No)
              </label>
              <input
                id="tour-em-no-input"
                type="text"
                required
                placeholder="กรอกรหัสพนักงานของคุณ เช่น AH1000xxxx"
                value={userIdentifier}
                onChange={(e) => setUserIdentifier(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 font-semibold focus:outline-none bg-slate-50/50"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 tracking-wide flex items-center gap-1.5 font-sans">
                <Lock size={14} className="text-slate-400" /> รหัสผ่าน (Password)
              </label>
              <input
                id="tour-password-input"
                type="password"
                required
                placeholder="กรอกรหัสผ่านเข้าใช้งานระบบ"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 font-semibold focus:outline-none bg-slate-50/50"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-start gap-3 text-xs text-slate-500 leading-relaxed">
            <Fingerprint size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-700">ระบบตรวจสอบสิทธิ์ผ่านฐานข้อมูลส่วนกลาง</p>
              <p className="text-[11px]">เพื่อความโปร่งใสและถูกต้อง ข้อมูลแผนก สังกัด และอีเมลของคุณจะถูกเชื่อมโยงโดยอัตโนมัติเมื่อระบุตัวตนถูกต้อง</p>
            </div>
          </div>

          <button
            id="tour-login-btn"
            type="submit"
            disabled={authLoading}
            className="w-full py-3 bg-[#1D366D] hover:bg-indigo-950 text-white rounded-full text-xs font-bold tracking-wider shadow-sm hover:shadow-md disabled:opacity-50 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 font-sans"
          >
            {authLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                กำลังยืนยันตัวตน...
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                เข้าสู่ระบบประเมินผล
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
      <div id="tour-instruction-card" className="max-w-xl mx-auto my-12 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-300 text-left">
        <div className="bg-[#1D366D] p-8 text-white text-center space-y-2">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
            <FileText className="text-white" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold font-sans tracking-tight">คำชี้แจงและสิทธิ์การเข้าทำแบบประเมิน</h2>
            <p className="text-[11px] text-slate-300 font-semibold">วิชาทดสอบ: {campaign.name}</p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100/50 space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              สวัสดีครับ คุณ {userName || "ผู้สอบ"}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ยินดีต้อนรับสู่ระบบประเมินความรู้พนักงาน (ESS Platform) สำหรับหัวข้อ <span className="font-semibold text-slate-800">"{campaign.name}"</span> กรุณาทำความเข้าใจเงื่อนไขและข้อมูลเบื้องต้นด้านล่างนี้ก่อนเริ่มประเมินผล:
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">เวลาทำข้อสอบทั้งหมด</span>
              <span className="font-bold text-slate-800 text-sm">{campaign.isUntimed ? "ไม่จำกัดเวลา (Untimed)" : `${campaign.timeLimitMinutes} นาที`}</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">โจทย์คำถามจริง</span>
              <span className="font-bold text-slate-800 text-sm">
                {campaign.totalQuestionsToTest && campaign.totalQuestionsToTest > 0 
                  ? `${campaign.totalQuestionsToTest} ข้อ (สุ่มจากคลังคำถาม)` 
                  : `${campaign.questions.length} ข้อ`}
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">เกณฑ์ผ่านประเมิน</span>
              <span className="font-bold text-emerald-600 text-sm">ต้องได้คะแนน ≥ {campaign.passingPercentage}%</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">กลุ่มเป้าหมายผู้สอบ</span>
              <span className="font-bold text-slate-800 text-sm truncate block">{campaign.groupName || "-"}</span>
            </div>
          </div>

          {/* Instructions Box */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ทางเลือกในการทำแบบทดสอบ (Your Choices)</span>
            
            <div className="space-y-3">
              <div className="p-4 bg-rose-50/50 border border-rose-100/50 rounded-xl flex gap-3 text-xs leading-relaxed">
                <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-slate-600 font-medium">
                  <strong className="text-rose-800">หากเลือก "ไม่เข้าร่วม":</strong> ระบบจะนำท่านกลับโดยทันที โดยสิทธิ์และจำนวนครั้งในการทำข้อสอบของท่านจะไม่สูญเสียไป ท่านสามารถล็อกอินเข้ารับการประเมินในภายหลังได้เมื่อพร้อม
                </p>
              </div>

              <div className="p-4 bg-emerald-50/50 border border-emerald-100/50 rounded-xl flex gap-3 text-xs leading-relaxed">
                <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-slate-600 font-medium">
                  <strong className="text-emerald-800">หากเลือก "เข้าร่วม":</strong> ระบบจะนำท่านเข้าสู่ขั้นตอนยืนยันข้อมูลพนักงาน เพื่อตรวจสอบความถูกต้องของข้อมูลส่วนบุคคลก่อนเริ่มสอบจับเวลาจริง
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
                showSuccess("ออกจากระบบสำเร็จ", "สิทธิ์การทำข้อสอบของคุณยังคงปลอดภัย คุณสามารถกลับมาเข้าทดสอบได้ภายหลัง");
              }}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <XCircle size={14} className="text-slate-500" /> ไม่เข้าร่วม
            </button>

            <button
              onClick={() => {
                setHasAcceptedInstruction(true);
              }}
              className="py-3 px-4 bg-[#1D366D] hover:bg-indigo-950 text-white rounded-full text-xs font-bold tracking-wide shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <CheckCircle size={14} className="text-white/80" /> เข้าร่วมประเมิน
            </button>
          </div>
        </div>
      </div>
    );
  }

  // B2. Pre-test Verified Profile Gate Screen (Verification Required)
  if (!isRegistered) {
    return (
      <div id="tour-profile-card" className="max-w-md mx-auto my-12 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-300 text-left">
        {/* Verification banner header */}
        <div className="bg-[#1D366D] p-8 text-white text-center space-y-2">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold font-sans tracking-tight">ยืนยันโปรไฟล์ผู้เข้าประเมิน</h2>
            <p className="text-[11px] text-slate-300 font-semibold">Verified Candidate Profile Gate</p>
          </div>
        </div>

        {/* Verified details container */}
        <div className="p-8 space-y-6">
          <div className="bg-amber-50/60 border border-amber-100/50 rounded-xl p-4 text-xs text-amber-900 space-y-1.5 leading-relaxed">
            <p className="font-bold flex items-center gap-1">
              <AlertCircle size={14} className="text-amber-600" /> โปรดตรวจสอบประวัติของคุณก่อนเริ่มทำแบบประเมิน
            </p>
            <p className="text-slate-600">
              รายละเอียดโปรไฟล์พนักงานด้านล่างนี้ถูกดึงขึ้นมาจากระบบประวัติส่วนบุคคลอย่างเป็นทางการ หากถูกต้อง กรุณากดปุ่ม <strong>"เริ่มแบบประเมินผล"</strong> เพื่อเริ่มทำทันที
            </p>
          </div>

          {/* Profile fields bento grid */}
          <div className="space-y-3 text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ประวัติพนักงานอย่างเป็นทางการ (Verified Profile)</span>
            
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl space-y-4">
              {/* Name & Surname */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 shrink-0">
                  <User size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">ชื่อจริง - นามสกุล</span>
                  <span className="text-xs font-bold text-slate-800">{userProfile?.name} {userProfile?.surname}</span>
                </div>
              </div>

              {/* Employee ID (EM No) */}
              <div className="flex items-center gap-3 border-t border-slate-200/50 pt-3">
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 shrink-0">
                  <Hash size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">รหัสพนักงาน (Employee No)</span>
                  <span className="text-xs font-bold text-slate-800 font-mono">{userProfile?.emNo}</span>
                </div>
              </div>

              {/* Department */}
              <div className="flex items-center gap-3 border-t border-slate-200/50 pt-3">
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 shrink-0">
                  <Briefcase size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">แผนก / ฝ่าย (Department)</span>
                  <span className="text-xs font-bold text-slate-800">{userProfile?.department || "-"}</span>
                </div>
              </div>

              {/* Company */}
              <div className="flex items-center gap-3 border-t border-slate-200/50 pt-3">
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 shrink-0">
                  <Building size={14} />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">บริษัท (Company)</span>
                  <span className="text-xs font-bold text-slate-800">{userProfile?.company || "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign details */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#1D366D] shrink-0" />
              <span>เวลาสอบ: {campaign.isUntimed ? "ไม่จำกัดเวลา" : `${campaign.timeLimitMinutes} นาที`}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-[#1D366D] shrink-0" />
              <span>โจทย์: {campaign.totalQuestionsToTest && campaign.totalQuestionsToTest > 0 ? `${campaign.totalQuestionsToTest} ข้อ` : `${campaign.questions.length} ข้อ`}</span>
            </div>
          </div>

          {/* Buttons row */}
          <div className="space-y-2.5 pt-2">
            <button
              id="tour-start-exam-btn"
              onClick={handleStartExam}
              className="w-full py-3 bg-[#2DC84D] hover:bg-emerald-500 text-black rounded-full text-xs font-bold tracking-wider shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} />
              ยืนยันประวัติ & เริ่มทำข้อสอบ
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
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer text-center"
            >
              ออกจากระบบ เพื่อเปลี่ยนพนักงานเข้าประเมิน
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
    <div id="tour-exam-container" className="w-full max-w-6xl xl:max-w-7xl mx-auto my-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start text-left px-4 lg:px-0 animate-in fade-in duration-300">
      {/* Sidebar: Navigation Grid & Clock */}
      <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 order-last lg:order-first">
        {/* Floating Timer Card (Visible only on desktop) */}
        <div id="tour-timer-box" className={`hidden lg:flex p-4 border rounded-2xl shadow-sm items-center justify-between transition-all duration-300 ${
          !campaign?.isUntimed && isTimeUrgent 
            ? "bg-rose-50 border-rose-100 text-rose-800 animate-pulse shadow-rose-100/50" 
            : "bg-white border-slate-100 text-slate-800"
        }`}>
          <div className="flex items-center gap-2">
            <Clock className={!campaign?.isUntimed && isTimeUrgent ? "text-rose-600" : "text-[#1D366D]"} size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {campaign?.isUntimed ? "เวลาที่ใช้ไป:" : "เวลาที่เหลือ:"}
            </span>
          </div>
          <span className="text-lg font-bold font-mono tracking-tight">
            {campaign?.isUntimed ? formatTimer(durationUsed) : formatTimer(timeRemaining)}
          </span>
        </div>

        {/* Layout Presentation Toggle */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-50 pb-2">รูปแบบการแสดงผล (Layout)</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setLayoutMode("slider")}
              className={`quiz-control-btn py-2 px-2 text-[10px] font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                layoutMode === "slider"
                  ? "bg-[#1D366D] text-white shadow-sm"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100/80"
              }`}
            >
              ทำทีละข้อ
            </button>
            <button
              onClick={() => setLayoutMode("scroll")}
              className={`quiz-control-btn py-2 px-2 text-[10px] font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                layoutMode === "scroll"
                  ? "bg-[#1D366D] text-white shadow-sm"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100/80"
              }`}
            >
              แสดงทั้งหมด
            </button>
          </div>
        </div>

        {/* Student Progress Map Grid */}
        <div id="tour-navigation-grid" className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-slate-50 pb-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-semibold">แผงข้อสอบ</span>
            <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-full">
              ทำแล้ว {answeredCount}/{shuffledQuestions.length} ข้อ
            </span>
          </div>

          {/* Dynamically responsive grid for all device sizes to avoid clipping or excessive spacing */}
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-4 xl:grid-cols-5 gap-2 justify-items-center justify-center">
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
                  className={`quiz-nav-btn w-10 h-10 !p-0 flex items-center justify-center text-xs font-bold font-mono rounded-full transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-[#1D366D] text-white shadow-sm hover:bg-indigo-900"
                      : hasAnswered
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100/50"
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100/80 border border-transparent"
                  }`}
                >
                  {qIndex + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-2.5 border-t border-slate-50 flex flex-col gap-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-200" />
              <span>ทำคำตอบเรียบร้อยแล้ว</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-100 border border-slate-200" />
              <span>ยังไม่ได้เลือกตอบ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel: Active Question Slider or Scroll list */}
      <div className="lg:col-span-3 space-y-4">
        {/* Exam Title header */}
        <div className="bg-[#1D366D] text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm text-center sm:text-left">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold block mb-0.5">รหัสผู้สอบ: {userIdentifier}</span>
            <h2 className="text-sm font-bold tracking-tight line-clamp-1">{campaign.name}</h2>
          </div>
          <div className="flex items-center gap-3 shrink-0 font-sans">
            <span className="text-xs font-bold font-mono bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              {layoutMode === "slider" ? `ข้อที่ ${currentIdx + 1} / ${shuffledQuestions.length}` : `รวม ${shuffledQuestions.length} ข้อ`}
            </span>
            <button
              onClick={handleLogout}
              className="quiz-control-btn px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1"
            >
              <LogOut size={12} />
              ออก
            </button>
          </div>
        </div>

        {/* Compact Mobile Timer (Visible only on mobile/tablet screens) */}
        <div id="tour-timer-box-mobile" className="lg:hidden p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between transition-all duration-300">
          <div className="flex items-center gap-2">
            <Clock className={!campaign?.isUntimed && isTimeUrgent ? "text-rose-600" : "text-[#1D366D]"} size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {campaign?.isUntimed ? "เวลาที่ใช้ไป:" : "เวลาที่เหลือ:"}
            </span>
          </div>
          <span className="text-lg font-bold font-mono tracking-tight text-slate-800">
            {campaign?.isUntimed ? formatTimer(durationUsed) : formatTimer(timeRemaining)}
          </span>
        </div>

        {layoutMode === "scroll" ? (
          <div className="space-y-6">
            {shuffledQuestions.map((q, qIdx) => (
              <div key={q.id} id={`scroll-question-${qIdx}`} className="bg-slate-100 border-2 border-slate-400/70 rounded-2xl p-6 sm:p-8 shadow-md space-y-5 transition-all scroll-mt-6 hover:border-slate-500">
                <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-relaxed font-sans">
                  ข้อที่ {qIdx + 1}. {q.text}
                </h3>
                <div className="space-y-2.5 pl-1">
                  {q.options.map((option, oIdx) => {
                    const isChecked = answers[q.id] === option;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => {
                          handleSelectOption(q.id, option);
                          setCurrentIdx(qIdx);
                        }}
                        className={`quiz-option-btn w-full text-left p-4 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer flex items-center gap-3 ${
                          isChecked
                            ? "bg-[#1D366D] border-[#1D366D] text-white shadow-md ring-2 ring-[#1D366D]/25"
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 transition-all duration-200 ${
                          isChecked
                            ? "bg-white text-[#1D366D]"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="leading-relaxed flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Scroll Submit Banner */}
            <div className="bg-slate-100 border-2 border-slate-400/70 rounded-2xl p-6 sm:p-8 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500 font-semibold leading-relaxed">
                กรุณาตรวจสอบความถูกต้องของคำตอบทั้งหมด <span className="font-bold text-slate-700">{answeredCount} / {shuffledQuestions.length} ข้อ</span> ก่อนกดยืนยันส่งคะแนนประเมิน
              </span>
              <button
                disabled={submitting}
                onClick={handleManualSubmit}
                className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#2DC84D] hover:bg-emerald-500 text-black text-xs font-bold rounded-full transition-all duration-200 cursor-pointer shadow-sm active:translate-y-[1px] shrink-0"
              >
                <Send size={14} />
                {submitting ? "กำลังส่งข้อสอบ..." : "ส่งข้อสอบทั้งหมด"}
              </button>
            </div>
          </div>
        ) : (
          /* Question Slider Container */
          activeQuestion && (
            <div className="bg-slate-100 border-2 border-slate-400/70 rounded-2xl p-6 sm:p-8 shadow-md flex flex-col justify-between min-h-[40vh] space-y-6">
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                {/* Question Text */}
                <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-relaxed font-sans">
                  {activeQuestion.text}
                </h3>
 
                {/* Shuffled Options choices */}
                <div className="space-y-2.5 pl-1">
                  {activeQuestion.options.map((option, oIdx) => {
                    const isChecked = answers[activeQuestion.id] === option;

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleSelectOption(activeQuestion.id, option)}
                        className={`quiz-option-btn w-full text-left p-4 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer flex items-center gap-3 ${
                          isChecked
                            ? "bg-[#1D366D] border-[#1D366D] text-white shadow-md ring-2 ring-[#1D366D]/25"
                            : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 transition-all duration-200 ${
                          isChecked
                            ? "bg-white text-[#1D366D]"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="leading-relaxed flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slider Navigation Footer */}
              <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-50">
                <button
                  disabled={currentIdx === 0}
                  onClick={handlePrev}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-slate-50 border border-slate-100 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100/80 text-xs font-bold text-slate-600 rounded-full transition-all duration-200 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  ย้อนกลับ
                </button>

                {currentIdx < shuffledQuestions.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="inline-flex items-center gap-1 px-5 py-2.5 bg-[#1D366D] hover:bg-indigo-950 text-white text-xs font-bold rounded-full transition-all duration-200 cursor-pointer shadow-sm"
                  >
                    ข้อถัดไป
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    disabled={submitting}
                    onClick={handleManualSubmit}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#2DC84D] hover:bg-emerald-500 text-black text-xs font-bold rounded-full shadow-sm active:translate-y-[1px] transition-all duration-200 cursor-pointer"
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
