"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const ToastContainer: React.FC = () => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const icons = {
          default: <Info className="h-5 w-5 text-indigo-500 shrink-0" />,
          success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
          warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
          error: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />,
        };

        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg transition-all animate-in slide-in-from-bottom-2",
              t.variant === "success" && "border-emerald-200 dark:border-emerald-800",
              t.variant === "error" && "border-rose-200 dark:border-rose-800"
            )}
          >
            {icons[t.variant || "default"]}
            <div className="flex-1 text-sm">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">{t.title}</h4>
              {t.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
