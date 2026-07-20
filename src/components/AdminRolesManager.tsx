import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Search, 
  Lock, 
  User, 
  Users, 
  UserCheck,
  Building,
  ArrowRight,
  RefreshCw,
  X,
  AlertCircle
} from "lucide-react";
import { showSuccess, showError, showWarning } from "../lib/swal";

interface AdminRecord {
  id: string;
  username_or_id: string;
  name: string;
  department: string;
  type: "system" | "ess";
  role: "super_admin" | "admin";
  created_at: string;
}

export default function AdminRolesManager() {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceType, setSourceType] = useState<"system" | "ess">("ess");

  // Form states for System Account
  const [sysUsername, setSysUsername] = useState("");
  const [sysName, setSysName] = useState("");
  const [sysDept, setSysDept] = useState("");
  const [sysPassword, setSysPassword] = useState("");
  const [sysRole, setSysRole] = useState<"super_admin" | "admin">("admin");

  // Form states for ESS Account Mapping
  const [essId, setEssId] = useState("");
  const [searchingEss, setSearchingEss] = useState(false);
  const [essSearchResult, setEssSearchResult] = useState<{
    found: boolean;
    employeeId: string;
    name: string;
    department: string;
    message?: string;
  } | null>(null);

  // Manual fallback fields if ESS not found in mock cache
  const [essManualName, setEssManualName] = useState("");
  const [essManualDept, setEssManualDept] = useState("");
  const [essRole, setEssRole] = useState<"super_admin" | "admin">("admin");

  // Editing state
  const [editingAdmin, setEditingAdmin] = useState<AdminRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"super_admin" | "admin">("admin");

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admins");
      if (!res.ok) throw new Error("ไม่สามารถโหลดรายชื่อผู้ดูแลระบบได้");
      const data = await res.json();
      setAdmins(data);
    } catch (err: any) {
      showError("เกิดข้อผิดพลาด", err.message || "ไม่สามารถโหลดข้อมูลรายชื่อผู้ดูแลระบบได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleSearchEss = async () => {
    if (!essId.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณาระบุรหัสพนักงาน ESS ที่ต้องการตรวจสอบ");
      return;
    }
    try {
      setSearchingEss(true);
      setEssSearchResult(null);
      const res = await fetch(`/api/ess/lookup/${encodeURIComponent(essId.trim())}`);
      const data = await res.json();
      if (data.found) {
        setEssSearchResult({
          found: true,
          employeeId: data.user.employeeId,
          name: data.user.name,
          department: data.user.department
        });
        setEssManualName("");
        setEssManualDept("");
      } else {
        setEssSearchResult({
          found: false,
          employeeId: essId.trim().toUpperCase(),
          name: "",
          department: "",
          message: data.message
        });
        setEssManualName("");
        setEssManualDept("");
      }
    } catch (err: any) {
      showError("เกิดข้อผิดพลาด", "ไม่สามารถเชื่อมต่อระบบตรวจสอบข้อมูลพนักงานได้");
    } finally {
      setSearchingEss(false);
    }
  };

  const handleCreateSystemAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sysUsername.trim() || !sysName.trim() || !sysPassword.trim()) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณาระบุข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username_or_id: sysUsername.trim(),
          name: sysName.trim(),
          department: sysDept.trim(),
          type: "system",
          password: sysPassword.trim(),
          role: sysRole
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่สามารถสร้างสิทธิ์ผู้ดูแลระบบได้");

      showSuccess("ดำเนินการสำเร็จ", `เปิดใช้งานสิทธิ์ System Admin บัญชี ${sysUsername.trim()} สำเร็จ`);
      
      // Reset form fields
      setSysUsername("");
      setSysName("");
      setSysDept("");
      setSysPassword("");
      setSysRole("admin");
      
      fetchAdmins();
    } catch (err: any) {
      showError("การดำเนินการล้มเหลว", err.message);
    }
  };

  const handleMapEssAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!essSearchResult) return;

    const finalName = essSearchResult.found ? essSearchResult.name : essManualName.trim();
    const finalDept = essSearchResult.found ? essSearchResult.department : essManualDept.trim();

    if (!finalName) {
      showWarning("ข้อมูลไม่ครบถ้วน", "กรุณาระบุชื่อ-นามสกุลของพนักงาน");
      return;
    }

    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username_or_id: essSearchResult.employeeId,
          name: finalName,
          department: finalDept,
          type: "ess",
          password: null, // Strictly NO password creation/management for ESS account source
          role: essRole
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่สามารถจับคู่สิทธิ์ผู้ดูแลระบบได้");

      showSuccess("จับคู่สิทธิ์สำเร็จ", `กำหนดสิทธิ์ผู้ดูแลระบบให้กับบัญชีพนักงาน ${essSearchResult.employeeId} สำเร็จ`);
      
      // Reset states
      setEssId("");
      setEssSearchResult(null);
      setEssManualName("");
      setEssManualDept("");
      setEssRole("admin");
      
      fetchAdmins();
    } catch (err: any) {
      showError("การดำเนินการล้มเหลว", err.message);
    }
  };

  const handleDeleteAdmin = async (admin: AdminRecord) => {
    const isConfirmed = await window.showCustomConfirm(
      "เพิกถอนสิทธิ์ผู้ดูแลระบบ",
      `คุณแน่ใจหรือไม่ว่าต้องการเพิกถอนสิทธิ์ผู้ดูแลระบบของ ${admin.name} (${admin.username_or_id})? บัญชีนี้จะไม่สามารถล็อกอินเข้าสู่ระบบแผงควบคุมแอดมินได้อีก`
    );

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ล้มเหลวในการลบสิทธิ์ผู้ดูแลระบบ");

      showSuccess("เพิกถอนสิทธิ์เรียบร้อย", "ทำการลบสิทธิ์ผู้ดูแลระบบออกจากฐานข้อมูลแล้ว");
      fetchAdmins();
    } catch (err: any) {
      showError("ข้อผิดพลาด", err.message);
    }
  };

  const startEditAdmin = (admin: AdminRecord) => {
    setEditingAdmin(admin);
    setEditName(admin.name);
    setEditDept(admin.department || "");
    setEditPassword("");
    setEditRole(admin.role);
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    try {
      const res = await fetch(`/api/admins/${editingAdmin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          department: editDept.trim(),
          password: editPassword.trim() || undefined,
          role: editRole
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่สามารถอัปเดตข้อมูลได้");

      showSuccess("อัปเดตสำเร็จ", "ปรับปรุงข้อมูลสิทธิ์เรียบร้อยแล้ว");
      setEditingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      showError("อัปเดตล้มเหลว", err.message);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Module Heading */}
      <div className="border-b-4 border-slate-900 pb-5 text-left">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-brand-accent-blue" />
          <span>การจัดการบทบาทและสิทธิ์ผู้ดูแลระบบ (Admin Role Assignment)</span>
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          กำหนดสิทธิ์การใช้งานแผงควบคุมสำหรับ Super Admin และ Admin จากบัญชีระบบภายใน หรือแผนกบุคคลภายนอก (ESS)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Grant Privileges Form */}
        <div className="lg:col-span-5 bg-white border-3 border-black p-6 shadow-[5px_5px_0px_0px_#000] space-y-6 text-left">
          <div className="flex justify-between items-center pb-2 border-b-2 border-slate-100">
            <h2 className="text-md font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand-accent-blue" />
              <span>เพิ่มผู้ดูแลระบบรายใหม่</span>
            </h2>
          </div>

          {/* Select Account Source Type */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">
              เลือกแหล่งที่มาของบัญชี (ACCOUNT SOURCE)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSourceType("ess");
                  setEssSearchResult(null);
                }}
                className={`py-3 px-4 neo-border-2 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceType === "ess"
                    ? "bg-brand-accent-blue text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>ESS Employee</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceType("system")}
                className={`py-3 px-4 neo-border-2 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sourceType === "system"
                    ? "bg-brand-accent-blue text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>System Account</span>
              </button>
            </div>
          </div>

          {/* Source 1: ESS Account Mapping */}
          {sourceType === "ess" && (
            <div className="space-y-5 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="bg-amber-50 border-2 border-amber-500 p-3.5 text-xs text-amber-900 font-medium space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-950">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>ประกาศนโยบายบัญชี ESS (Employee Self-Service)</span>
                </p>
                <p className="leading-relaxed">
                  ระบบจะทำการจับคู่ (Mapping) รหัสพนักงานที่ได้รับสิทธิ์กับระบบตรวจสอบสิทธิ์ Aapico ESS หลักโดยตรง <strong>ไม่มีการเก็บหรือกำหนดรหัสผ่านใหม่</strong> ในระบบนี้แต่อย่างใด
                </p>
              </div>

              {/* Step 1: Search Employee ID */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
                  ค้นหารหัสพนักงาน ESS (ESS EMPLOYEE ID)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="เช่น AH10002900"
                      value={essId}
                      onChange={(e) => setEssId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchEss();
                        }
                      }}
                      className="w-full pl-9 pr-4 py-2 border-2 border-black rounded-none text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={searchingEss}
                    onClick={handleSearchEss}
                    className="bg-brand-accent-blue hover:bg-opacity-90 text-white font-bold text-xs py-2 px-4 border-2 border-black neo-shadow-black transition-all cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
                  >
                    {searchingEss ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "ตรวจสอบข้อมูล"
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Display search results or manual inputs */}
              {essSearchResult && (
                <form onSubmit={handleMapEssAdmin} className="space-y-4 border-t-2 border-dashed border-slate-200 pt-4 animate-in zoom-in-95 duration-150">
                  <div className={`p-4 border-2 text-xs ${essSearchResult.found ? "bg-emerald-50 border-emerald-500 text-emerald-900" : "bg-red-50 border-red-500 text-red-900"}`}>
                    {essSearchResult.found ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                          <UserCheck className="w-4 h-4" />
                          <span>พบประวัติบัญชีผู้ใช้งานในระบบ ESS</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-1 text-[11px] font-mono mt-1">
                          <span className="text-slate-500">รหัสพนักงาน:</span>
                          <span className="font-bold text-slate-900">{essSearchResult.employeeId}</span>
                          <span className="text-slate-500">ชื่อ-นามสกุล:</span>
                          <span className="font-bold text-slate-900">{essSearchResult.name}</span>
                          <span className="text-slate-500">แผนกงาน:</span>
                          <span className="font-bold text-slate-900">{essSearchResult.department}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 font-bold text-red-950">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span>แจ้งข่าวสาร: {essSearchResult.message || "ไม่พบข้อมูลรหัสพนักงานนี้"}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          คุณยังคงสามารถจับคู่กำหนดสิทธิ์ได้โดยป้อนชื่อและแผนกงานของรหัสพนักงาน <strong>{essSearchResult.employeeId}</strong> ด้วยตนเอง เพื่อรอการล็อกอินจริงผ่าน API ในอนาคต
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Manual input if NOT found in DB cache */}
                  {!essSearchResult.found && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                          ชื่อ-นามสกุล (NAME - SURNAME) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="ระบุชื่อและนามสกุลภาษาไทย"
                          value={essManualName}
                          onChange={(e) => setEssManualName(e.target.value)}
                          className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                          แผนก/สังกัด (DEPARTMENT)
                        </label>
                        <input
                          type="text"
                          placeholder="ระบุชื่อแผนกงาน เช่น HR-01, IT-96"
                          value={essManualDept}
                          onChange={(e) => setEssManualDept(e.target.value)}
                          className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                        />
                      </div>
                    </div>
                  )}

                  {/* Select Role */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                      ระดับสิทธิ์การใช้งาน (ADMIN ROLE)
                    </label>
                    <select
                      value={essRole}
                      onChange={(e) => setEssRole(e.target.value as any)}
                      className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white"
                    >
                      <option value="admin">Admin (จัดการบทเรียน/ห้องสอบ)</option>
                      <option value="super_admin">Super Admin (จัดการบทบาททั้งหมด)</option>
                    </select>
                  </div>

                  {/* Submit Map */}
                  <button
                    type="submit"
                    className="w-full bg-brand-accent-blue hover:bg-opacity-90 text-white font-bold text-xs py-3 px-4 border-2 border-black neo-shadow-black transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>ผูกบัญชี ESS และมอบสิทธิ์ Admin</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Source 2: Internal System Account Creation */}
          {sourceType === "system" && (
            <form onSubmit={handleCreateSystemAdmin} className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                  รหัสบัญชีเข้าระบบ (USERNAME) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="เช่น system_admin, staff_it"
                    value={sysUsername}
                    onChange={(e) => setSysUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                    className="w-full pl-9 pr-4 py-2 border-2 border-black rounded-none text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                  รหัสผ่านเข้าระบบ (PASSWORD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="ความยาวขั้นต่ำ 6 อักขระ"
                    value={sysPassword}
                    onChange={(e) => setSysPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border-2 border-black rounded-none text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                  ชื่อ-นามสกุลจริง (NAME - SURNAME) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย ใจดี"
                  value={sysName}
                  onChange={(e) => setSysName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                  หน่วยงาน/สังกัด (DEPARTMENT)
                </label>
                <input
                  type="text"
                  placeholder="เช่น IT Administration"
                  value={sysDept}
                  onChange={(e) => setSysDept(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                  ระดับสิทธิ์การใช้งาน (ADMIN ROLE)
                </label>
                <select
                  value={sysRole}
                  onChange={(e) => setSysRole(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white"
                >
                  <option value="admin">Admin (จัดการบทเรียน/ห้องสอบ)</option>
                  <option value="super_admin">Super Admin (จัดการบทบาททั้งหมด)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-accent-blue hover:bg-opacity-90 text-white font-bold text-xs py-3 px-4 border-2 border-black neo-shadow-black transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>สร้างบัญชีระบบภายใน และมอบสิทธิ์ Admin</span>
              </button>
            </form>
          )}
        </div>

        {/* Right Side: Active Admins Table */}
        <div className="lg:col-span-7 bg-white border-3 border-black p-6 shadow-[5px_5px_0px_0px_#000] space-y-4 text-left">
          <div className="flex justify-between items-center pb-2 border-b-2 border-slate-100">
            <h2 className="text-md font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-accent-blue" />
              <span>รายชื่อผู้ได้รับสิทธิ์ผู้ดูแลระบบในระบบ ({admins.length} บัญชี)</span>
            </h2>
            <button
              onClick={fetchAdmins}
              className="p-1 border border-slate-300 hover:border-black cursor-pointer bg-slate-50 transition-colors"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading && admins.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-accent-blue" />
              <span>กำลังดึงข้อมูลผู้ดูแลระบบ...</span>
            </div>
          ) : admins.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 text-slate-400 text-xs">
              ไม่พบข้อมูลผู้ดูแลระบบในระบบความปลอดภัย
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-black">
                    <th className="py-2.5 px-3 font-black text-slate-700 uppercase font-mono tracking-wider text-[10px]">ประเภท</th>
                    <th className="py-2.5 px-3 font-black text-slate-700 uppercase font-mono tracking-wider text-[10px]">บัญชี/รหัส</th>
                    <th className="py-2.5 px-3 font-black text-slate-700 uppercase font-mono tracking-wider text-[10px]">ชื่อผู้ใช้</th>
                    <th className="py-2.5 px-3 font-black text-slate-700 uppercase font-mono tracking-wider text-[10px]">ระดับสิทธิ์</th>
                    <th className="py-2.5 px-3 font-black text-slate-700 uppercase font-mono tracking-wider text-[10px] text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        {admin.type === "system" ? (
                          <span className="inline-flex items-center gap-1 bg-slate-900 text-white text-[10px] font-black px-1.5 py-0.5 rounded-none uppercase">
                            <Lock size={10} />
                            System
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 border border-sky-300 text-[10px] font-black px-1.5 py-0.5 rounded-none uppercase">
                            <Users size={10} />
                            ESS
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {admin.username_or_id}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <div className="font-bold text-slate-800">{admin.name}</div>
                        {admin.department && (
                          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            <Building size={10} />
                            <span>{admin.department}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-none ${
                          admin.role === "super_admin" 
                            ? "bg-red-100 text-red-800 border border-red-200" 
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}>
                          {admin.role === "super_admin" ? "SUPER ADMIN" : "ADMIN"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1">
                        <button
                          onClick={() => startEditAdmin(admin)}
                          className="p-1.5 border border-black bg-amber-400 hover:bg-amber-500 shadow-[1px_1px_0px_rgba(0,0,0,1)] transition-all cursor-pointer inline-flex items-center"
                          title="แก้ไขรายละเอียด"
                        >
                          <Edit3 size={12} className="text-black" />
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(admin)}
                          disabled={admin.username_or_id === "admin" && admin.type === "system"}
                          className={`p-1.5 border border-black bg-red-400 hover:bg-red-500 shadow-[1px_1px_0px_rgba(0,0,0,1)] transition-all inline-flex items-center ${
                            admin.username_or_id === "admin" && admin.type === "system" 
                              ? "opacity-30 cursor-not-allowed" 
                              : "cursor-pointer"
                          }`}
                          title="เพิกถอนสิทธิ์"
                        >
                          <Trash2 size={12} className="text-black" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Editing Dialog Modal Box */}
      {editingAdmin && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto p-4 flex justify-center items-center bg-slate-950/60 backdrop-blur-sm">
          <div 
            className="absolute inset-0 transition-opacity cursor-pointer"
            onClick={() => setEditingAdmin(null)}
          />
          
          <div className="relative w-full max-w-md bg-white border-4 border-slate-900 overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b-4 border-slate-900 flex items-center justify-between bg-amber-400 text-slate-950">
              <h3 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                <span>แก้ไขข้อมูลสิทธิ์แอดมิน</span>
              </h3>
              <button 
                onClick={() => setEditingAdmin(null)}
                className="p-1 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAdmin} className="p-6 space-y-4 text-left">
              <div className="bg-slate-50 p-3 border-2 border-black text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">บัญชีแอดมิน:</span>
                  <span className="font-black font-mono text-slate-900">{editingAdmin.username_or_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">ประเภทบัญชี:</span>
                  <span className="font-black uppercase text-slate-950">{editingAdmin.type}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                  ชื่อ-นามสกุลจริง (NAME - SURNAME) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย ใจดี"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                  หน่วยงาน/สังกัด (DEPARTMENT)
                </label>
                <input
                  type="text"
                  placeholder="เช่น IT Support"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                />
              </div>

              {editingAdmin.type === "system" && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                    รหัสผ่านใหม่ (NEW PASSWORD) <span className="text-slate-400 font-medium">(ระบุเฉพาะเมื่อต้องการเปลี่ยน)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      placeholder="ความยาวขั้นต่ำ 6 อักขระ"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border-2 border-black rounded-none text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                  ระดับสิทธิ์การใช้งาน (ADMIN ROLE)
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-black rounded-none text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-aapico-blue bg-white"
                >
                  <option value="admin">Admin (จัดการบทเรียน/ห้องสอบ)</option>
                  <option value="super_admin">Super Admin (จัดการบทบาททั้งหมด)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="w-1/2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs py-2.5 px-4 border-2 border-black transition-all cursor-pointer text-center"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-brand-accent-blue hover:bg-opacity-90 text-white font-bold text-xs py-2.5 px-4 border-2 border-black neo-shadow-black transition-all cursor-pointer text-center"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
