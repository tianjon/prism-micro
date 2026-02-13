/**
 * Toast 通知 hook。
 * 基于 Zustand 管理全局通知状态。
 */

import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    // 自动消失（4 秒）
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

/**
 * 使用 toast 通知。
 */
export function useToast() {
  const { addToast, removeToast } = useToastStore();

  return {
    toast: (options: { title: string; description?: string; variant?: ToastVariant }) => {
      addToast({
        title: options.title,
        description: options.description,
        variant: options.variant ?? "default",
      });
    },
    dismiss: removeToast,
  };
}

/** 直接访问 toast 列表（供 ToastProvider 消费） */
export { useToastStore };
