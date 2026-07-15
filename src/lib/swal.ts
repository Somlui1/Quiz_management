import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const NeoSwal = Swal.mixin({
  customClass: {
    popup: "border-4 border-slate-900 rounded-3xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] font-sans bg-white text-slate-950 max-w-md",
    title: "font-black text-slate-900 uppercase tracking-tight text-xl pt-6 px-4",
    htmlContainer: "font-bold text-slate-700 text-sm py-4 px-6",
    confirmButton: "px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] mx-2 cursor-pointer transition-all text-xs",
    cancelButton: "px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-black uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] mx-2 cursor-pointer transition-all text-xs",
    actions: "pb-6",
  },
  buttonsStyling: false,
});

export const showSuccess = (title: string, message: string) => {
  return NeoSwal.fire({
    title,
    text: message,
    icon: "success",
    confirmButtonText: "ตกลง",
  });
};

export const showError = (title: string, message: string) => {
  return NeoSwal.fire({
    title,
    text: message,
    icon: "error",
    confirmButtonText: "ตกลง",
  });
};

export const showWarning = (title: string, message: string) => {
  return NeoSwal.fire({
    title,
    text: message,
    icon: "warning",
    confirmButtonText: "ตกลง",
  });
};

export const showConfirm = (title: string, message: string, confirmText = "ยืนยัน", cancelText = "ยกเลิก") => {
  return NeoSwal.fire({
    title,
    text: message,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
  }).then((result) => result.isConfirmed);
};

export const showPrompt = (title: string, message: string, defaultValue = "", confirmText = "ตกลง", cancelText = "ยกเลิก") => {
  return NeoSwal.fire({
    title,
    text: message,
    input: "text",
    inputValue: defaultValue,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    inputAttributes: {
      autocapitalize: "off",
      autocorrect: "off",
    },
    customClass: {
      popup: "border-4 border-slate-900 rounded-3xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] font-sans bg-white text-slate-950 max-w-md",
      title: "font-black text-slate-900 uppercase tracking-tight text-xl pt-6 px-4",
      htmlContainer: "font-bold text-slate-700 text-sm py-2 px-6",
      input: "mx-6 my-2 px-4 py-2 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-950",
      confirmButton: "px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] mx-2 cursor-pointer transition-all text-xs",
      cancelButton: "px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-black uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] mx-2 cursor-pointer transition-all text-xs",
      actions: "pb-6",
    },
    buttonsStyling: false,
  }).then((result) => {
    if (result.isConfirmed) {
      return result.value;
    }
    return null;
  });
};
