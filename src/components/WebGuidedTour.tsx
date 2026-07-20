import React, { useState, useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface WebGuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  setUrlCampaignId: (id: string | null) => void;
  setActiveTab: (tab: "student" | "admin") => void;
  setAdminMenu: (menu: "bank" | "campaigns" | "branding" | "roles") => void;
  setAdminUser: (user: any) => void;
}

const STEP_CONFIGS: Record<number, {
  element: string;
  title: string;
  description: string;
  side?: "top" | "left" | "right" | "bottom" | "over";
}> = {
  1: {
    element: "#tour-join-campaign-section",
    title: "ยินดีต้อนรับสู่ AAPICO SmartEval",
    description: "หน้าจอแรกสำหรับลงทะเบียนทำข้อสอบพนักงานของบริษัท กรุณากรอกรหัสแคมเปญ / ห้องสอบ (เช่น <strong>tour-demo-quiz</strong> สำหรับห้องสอบสาธิต) แล้วกดคลิกเข้าสอบ หรือสแกน QR Code เข้าสอบด้วยสมาร์ตโฟนได้อย่างรวดเร็ว",
    side: "bottom"
  },
  2: {
    element: "#tour-login-card",
    title: "ระบบลงทะเบียนสืบค้นประวัติพนักงาน (ESS Login)",
    description: "ระบุรหัสพนักงาน (EM No) และรหัสผ่านส่วนตัวเพื่อดึงข้อมูลประวัติเฉพาะบุคคลสำหรับการเข้าสอบจากระบบทะเบียนพนักงานกลางของ AAPICO โดยอัตโนมัติ",
    side: "bottom"
  },
  3: {
    element: "#tour-instruction-card",
    title: "คำชี้แจงและเกณฑ์ข้อสอบ (Exam Rules Gate)",
    description: "แสดงรายละเอียดวิชาสอบ เวลาที่กำหนด และเกณฑ์คะแนนผ่านประเมิน (เช่น 60%) อย่างชัดเจนเพื่อให้พนักงานตรวจสอบความมั่นใจและยอมรับกติกาก่อนเริ่มทำสอบจริง",
    side: "bottom"
  },
  4: {
    element: "#tour-profile-card",
    title: "การยืนยันข้อมูลผู้เข้าสอบ (Verified Profile Gate)",
    description: "ระบบสืบค้นแผนกและสังกัดเพื่อป้องกันผู้สวมสิทธิ์ กรุณาตรวจสอบประวัติแผนก และบริษัท (เช่น AAPICO Hitech PLC) ให้ถูกต้องก่อนกดยืนยันเริ่มทำข้อสอบจริง",
    side: "bottom"
  },
  5: {
    element: "#tour-exam-container",
    title: "แผงทำข้อสอบความมั่นคงสูง (Active Quiz Board)",
    description: "หน้ากระดาษคำถามและตัวเลือกจะถูกสุ่มสลับ (Randomization) แตกต่างกันไปในพนักงานแต่ละบุคคล ป้องกันการลอก พร้อมระบบเซฟคำตอบอัตโนมัติ (Auto-save) และนาฬิกาจับเวลากดดันถอยหลังส่วนตัว",
    side: "top"
  },
  6: {
    element: "#tour-score-card",
    title: "การตรวจผลสอบทันทีและแถบประเมิน (Instant Evaluation Sheet)",
    description: "เมื่อกดส่งคำตอบ ระบบจะตรวจและประมวลผลคะแนนให้คุณทราบทันทีแบบเรียลไทม์ พร้อมแถบบอกสถานะ ผ่าน/ตก เกณฑ์ประเมิน และเฉลยรายข้อพร้อมคำอธิบายเฉลยที่ชัดเจน",
    side: "top"
  },
  7: {
    element: "#tour-admin-live-lobby",
    title: "แผงควบคุมการคุมสอบสด (Live Lobby Proctor Board)",
    description: "เจ้าหน้าที่จัดสอบและผู้บังคับบัญชา สามารถล็อกอินเพื่อเฝ้าติดตามความเคลื่อนไหวของผู้ทำข้อสอบได้แบบวินาทีต่อวินาที (Real-time tracking) เห็นทันทีว่าใครผ่าน ใครตก และกำลังออนไลน์สอบอยู่ เพื่อควบคุมการประเมินให้มีเสถียรภาพสูงสุด",
    side: "top"
  }
};

export default function WebGuidedTour({
  isOpen,
  onClose,
  setUrlCampaignId,
  setActiveTab,
  setAdminMenu,
  setAdminUser
}: WebGuidedTourProps) {
  const [step, setStep] = useState<number>(() => {
    try {
      const savedStep = localStorage.getItem("aapico_tour_step");
      return savedStep ? Number(savedStep) : 1;
    } catch (_) {
      return 1;
    }
  });
  const driverRef = useRef<any>(null);

  // Close and clean up the tour
  const handleTourClose = () => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
    try {
      localStorage.removeItem("aapico_tour_step");
      localStorage.removeItem("aapico_tour_active");
    } catch (_) {}
    // Revert URL query
    setUrlCampaignId(null);
    setStep(1);
    onClose();
  };

  // Setup the target screen for the current step
  const handleStepSetup = (currentStep: number) => {
    try {
      localStorage.setItem("aapico_tour_step", String(currentStep));
      localStorage.setItem("aapico_tour_active", "true");
    } catch (_) {}

    if (currentStep === 1) {
      setUrlCampaignId(null);
      setActiveTab("student");
    } else if (currentStep >= 2 && currentStep <= 6) {
      setActiveTab("student");
      setUrlCampaignId("tour-demo-quiz");
      
      // Dispatch custom event to notify QuizTaker component to set appropriate internal view
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("tour-step-changed", { detail: { step: currentStep } }));
      }, 50);
    } else if (currentStep === 7) {
      // Transition to Proctor Dashboard view
      setActiveTab("admin");
      setAdminMenu("campaigns");
      setAdminUser({
        name: "อาจารย์ สมชาย (ผู้คุมสอบ)",
        emNo: "T9999",
        department: "ฝ่ายฝึกอบรมพัฒนา"
      });
      
      // Dispatch custom event to set CampaignAnalytics to Live Lobby tab with tour-demo-quiz
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("tour-step-changed", { detail: { step: currentStep } }));
      }, 50);
    }
  };

  // Run highlight on the element with aggressive DOM polling
  const highlightStep = (stepNum: number) => {
    if (driverRef.current) {
      driverRef.current.destroy();
    }

    const config = STEP_CONFIGS[stepNum];
    if (!config) return;

    let el = document.querySelector(config.element);
    if (el) {
      triggerDriver(stepNum, config);
      return;
    }

    // Poll the DOM every 100ms for up to 5 seconds to await async/motion rendering
    let attempts = 0;
    const maxAttempts = 50;
    const intervalId = setInterval(() => {
      attempts++;
      el = document.querySelector(config.element);
      if (el) {
        clearInterval(intervalId);
        triggerDriver(stepNum, config);
      } else if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        console.warn(`[WebGuidedTour] Element "${config.element}" was not loaded in the DOM after 5s polling.`);
      }
    }, 100);

    return intervalId;
  };

  // Launch driver.js popup highlights
  const triggerDriver = (stepNum: number, config: any) => {
    const isLast = stepNum === 7;

    const d = driver({
      allowClose: true,
      overlayColor: "#050B1A",
      overlayOpacity: 0.8,
      popoverClass: "aapico-tour-popover",
      onCloseClick: () => {
        handleTourClose();
      }
    });

    driverRef.current = d;

    d.highlight({
      element: config.element,
      popover: {
        title: `<div class="flex items-center gap-2 text-[#1D366D] font-black font-sans text-xs tracking-tight uppercase">
                  <span class="bg-[#1D366D] text-white text-[9.5px] px-2 py-0.5 rounded-full font-bold">ขั้นตอน ${stepNum}/7</span>
                  <span>${config.title}</span>
                </div>`,
        description: `
          <div class="text-slate-600 text-xs leading-relaxed font-semibold font-sans mt-2.5">
            ${config.description}
          </div>
          <div class="flex items-center justify-between mt-4 pt-3.5 border-t border-slate-100 gap-2">
            <button class="tour-skip-btn px-2 py-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 text-[10.5px] font-bold rounded-full cursor-pointer transition-all">
              ข้ามทัวร์
            </button>
            <div class="flex items-center gap-1.5">
              ${stepNum > 1 ? `
                <button class="tour-prev-btn px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold rounded-full border border-slate-200 transition-all cursor-pointer">
                  ย้อนกลับ
                </button>
              ` : ''}
              <button class="tour-next-btn px-4 py-1 bg-[#1D366D] hover:bg-indigo-950 text-white text-[10.5px] font-bold rounded-full border border-[#1D366D] transition-all shadow-sm cursor-pointer">
                ${isLast ? "เสร็จสิ้น" : "ถัดไป ➔"}
              </button>
            </div>
          </div>
        `,
        side: config.side || "bottom",
        align: "start"
      }
    });
  };

  // Sync React step transitions with rendering and element visibility
  useEffect(() => {
    if (!isOpen) {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      return;
    }

    handleStepSetup(step);

    let pollInterval: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      pollInterval = highlightStep(step);
    }, 200);

    return () => {
      clearTimeout(timer);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isOpen, step]);

  // Handle global click delegations for the custom popover buttons using capture phase
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".tour-next-btn")) {
        e.preventDefault();
        e.stopPropagation();
        if (step < 7) {
          setStep((s) => s + 1);
        } else {
          handleTourClose();
        }
      } else if (target.closest(".tour-prev-btn")) {
        e.preventDefault();
        e.stopPropagation();
        if (step > 1) {
          setStep((s) => s - 1);
        }
      } else if (target.closest(".tour-skip-btn")) {
        e.preventDefault();
        e.stopPropagation();
        handleTourClose();
      }
    };

    window.addEventListener("click", handleGlobalClick, true);
    return () => {
      window.removeEventListener("click", handleGlobalClick, true);
    };
  }, [isOpen, step]);

  return null;
}
