"use client";

import { useState, useCallback } from "react";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
}

let listeners: ((toasts: ToastItem[]) => void)[] = [];
let memoryToasts: ToastItem[] = [];

export function toast({
  title,
  description,
  variant = "default",
}: {
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
}) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast: ToastItem = { id, title, description, variant };
  memoryToasts = [...memoryToasts, newToast];
  listeners.forEach((l) => l(memoryToasts));

  setTimeout(() => {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
    listeners.forEach((l) => l(memoryToasts));
  }, 4000);
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>(memoryToasts);

  useState(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  });

  const dismiss = useCallback((id: string) => {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
    listeners.forEach((l) => l(memoryToasts));
  }, []);

  return { toasts, toast, dismiss };
}
