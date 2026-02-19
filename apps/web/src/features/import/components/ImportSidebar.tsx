/**
 * 导入流程侧边栏。
 * 垂直 stepper 导航，展示 6 步状态（1:1 对应后端 BatchStatus）。
 * 桌面端固定 w-70（可收缩），移动端 glass-sheet 覆盖层。
 */

import {
  Check,
  Loader2,
  Minus,
  X,
  Upload,
  Eye,
  FileText,
  TableProperties,
  Database,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { ImportStepId, StepStatus } from "../hooks/use-import";

/** 步骤定义 */
const STEPS: { id: ImportStepId; label: string; icon: typeof Upload }[] = [
  { id: "upload", label: "文件上传", icon: Upload },
  { id: "preview", label: "数据预览", icon: Eye },
  { id: "prompting", label: "提示词预览", icon: FileText },
  { id: "mapping", label: "映射结果", icon: TableProperties },
  { id: "importing", label: "数据导入", icon: Database },
  { id: "result", label: "导入结果", icon: ClipboardCheck },
];

interface ImportSidebarProps {
  currentStep: ImportStepId;
  stepStatuses: Record<ImportStepId, StepStatus>;
  onStepClick: (step: ImportStepId) => void;
  collapsed: boolean;
  isOpen: boolean;
  onClose: () => void;
}

/** 步骤状态图标 */
function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/15">
          <Check size={ICON_SIZE.sm} className="text-green-400" />
        </div>
      );
    case "active":
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 ring-2 ring-indigo-500/40">
          <div className="h-2 w-2 rounded-full bg-indigo-400" />
        </div>
      );
    case "loading":
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10">
          <Loader2
            size={ICON_SIZE.sm}
            className="animate-spin-slow text-indigo-400"
          />
        </div>
      );
    case "skipped":
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5">
          <Minus size={ICON_SIZE.xs} className="text-white/20" />
        </div>
      );
    case "pending":
    default:
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5">
          <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
        </div>
      );
  }
}

function SidebarContent({
  currentStep,
  stepStatuses,
  onStepClick,
  onClose,
}: Omit<ImportSidebarProps, "collapsed" | "isOpen">) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {/* 移动端关闭按钮 */}
      {onClose && (
        <div className="mb-3 flex items-center justify-between md:hidden">
          <span className="text-sm font-semibold text-white/60">导入步骤</span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            aria-label="关闭步骤面板"
          >
            <X size={ICON_SIZE.lg} />
          </button>
        </div>
      )}

      <h3 className="mb-4 hidden text-xs font-medium uppercase tracking-wider text-white/30 md:block">
        导入步骤
      </h3>

      {/* 垂直 stepper */}
      <nav className="flex flex-col" aria-label="导入步骤">
        {STEPS.map((step, idx) => {
          const status = stepStatuses[step.id];
          const isActive = step.id === currentStep;
          const isClickable =
            status === "completed" || status === "skipped";
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex">
              {/* 左侧：图标 + 连接线 */}
              <div className="flex flex-col items-center">
                <StepIcon status={isActive ? "active" : status} />
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "my-0.5 w-px flex-1",
                      status === "completed" ? "bg-green-500/20" : "bg-white/5",
                    )}
                  />
                )}
              </div>

              {/* 右侧：标签 + 图标 */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "ml-3 flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  isActive && "text-white",
                  status === "completed" &&
                    !isActive &&
                    "cursor-pointer text-white/60 hover:bg-white/5 hover:text-white/80",
                  status === "skipped" &&
                    !isActive &&
                    "cursor-pointer text-white/40 hover:bg-white/5 hover:text-white/60",
                  status === "pending" && "text-white/30",
                  status === "loading" && "text-indigo-400/80",
                  !isClickable && !isActive && "cursor-default",
                )}
              >
                <Icon
                  size={ICON_SIZE.md}
                  className={cn(
                    isActive && "text-indigo-400",
                    status === "completed" && !isActive && "text-green-400/60",
                    status === "skipped" && "text-white/15",
                    status === "loading" && "text-indigo-400/60",
                  )}
                />
                <span>{step.label}</span>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export function ImportSidebar({
  currentStep,
  stepStatuses,
  onStepClick,
  collapsed,
  isOpen,
  onClose,
}: ImportSidebarProps) {
  const contentProps = { currentStep, stepStatuses, onStepClick, onClose };

  return (
    <>
      {/* 桌面端：固定侧边栏（支持收缩） */}
      <div
        className={cn(
          "hidden shrink-0 border-r border-white/5 transition-[width] duration-200 md:block",
          collapsed ? "w-0 overflow-hidden border-r-0" : "w-70",
        )}
      >
        <SidebarContent {...contentProps} />
      </div>

      {/* 移动端：glass-sheet 覆盖层 */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[var(--z-sidebar)] bg-black/50 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="glass-sheet fixed inset-y-0 left-0 z-[var(--z-sidebar)] w-80 md:hidden">
            <SidebarContent {...contentProps} />
          </div>
        </>
      )}
    </>
  );
}
