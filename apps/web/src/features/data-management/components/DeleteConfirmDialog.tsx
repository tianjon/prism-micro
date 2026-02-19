/**
 * 删除确认对话框。
 * 模态弹窗，glass-card 风格，WAI-ARIA Dialog 模式。
 */

import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  loading?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  loading,
}: DeleteConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // ESC 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    },
    [onClose, loading],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    // 打开时聚焦取消按钮
    cancelRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
      className="fixed inset-0 z-[var(--z-dropdown)] flex items-center justify-center"
    >
      {/* 遮罩 */}
      <button
        type="button"
        aria-label="关闭对话框"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      {/* 对话框 */}
      <div className="glass-card relative z-10 w-full max-w-md p-6">
        <h3 id="delete-dialog-title" className="text-lg font-semibold text-white">{title}</h3>
        <p id="delete-dialog-desc" className="mt-2 text-sm text-white/50">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={loading}
            className="glass-btn-ghost px-4 py-2 text-sm"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "glass-btn-primary bg-red-600 hover:bg-red-500 px-4 py-2 text-sm",
              loading && "opacity-50 cursor-not-allowed",
            )}
          >
            {loading ? "删除中..." : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
