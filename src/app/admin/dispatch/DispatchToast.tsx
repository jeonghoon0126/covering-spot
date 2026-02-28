"use client";

interface DispatchToastProps {
  toast: { msg: string; type: "success" | "error" | "warning" } | null;
}

export default function DispatchToast({ toast }: DispatchToastProps) {
  if (!toast) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg pointer-events-none ${
        toast.type === "error"
          ? "bg-semantic-red text-white"
          : toast.type === "success"
            ? "bg-semantic-green text-white"
            : "bg-semantic-orange text-white"
      }`}
    >
      {toast.msg}
    </div>
  );
}
