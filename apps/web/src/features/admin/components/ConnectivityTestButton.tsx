/**
 * 连通性测试按钮组件。
 * 测试按钮 + 实时状态反馈（loading -> success/error 动画）。
 */

import { useState } from "react";
import { Wifi, WifiOff, Loader2, CheckCircle } from "lucide-react";
import { cn, formatLatency } from "@/lib/utils";
import type { ProviderTestResponse } from "@/api/types";

type TestState = "idle" | "testing" | "success" | "error";

interface ConnectivityTestButtonProps {
  onTest: () => Promise<ProviderTestResponse | null>;
}

export function ConnectivityTestButton({ onTest }: ConnectivityTestButtonProps) {
  const [state, setState] = useState<TestState>("idle");
  const [result, setResult] = useState<ProviderTestResponse | null>(null);

  const handleTest = async () => {
    setState("testing");
    setResult(null);

    const res = await onTest();
    if (res) {
      setResult(res);
      setState(res.status === "ok" ? "success" : "error");
    } else {
      setState("error");
    }

    // 5 秒后重置为 idle
    setTimeout(() => setState("idle"), 5000);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void handleTest()}
        disabled={state === "testing"}
        className={cn(
          "glass-btn-ghost flex items-center gap-2 px-4 py-2 text-sm",
          state === "testing" && "opacity-60",
        )}
      >
        {state === "idle" && <Wifi size={14} />}
        {state === "testing" && <Loader2 size={14} className="animate-spin" />}
        {state === "success" && (
          <CheckCircle size={14} className="text-green-400" />
        )}
        {state === "error" && <WifiOff size={14} className="text-red-400" />}

        {state === "idle" && "测试连通性"}
        {state === "testing" && "测试中..."}
        {state === "success" && "连通成功"}
        {state === "error" && "连通失败"}
      </button>

      {/* 测试结果详情 */}
      {result && state !== "idle" && (
        <span
          className={cn(
            "text-xs",
            result.status === "ok" ? "text-green-400" : "text-red-400",
          )}
        >
          {result.status === "ok" && result.latency_ms !== null
            ? formatLatency(result.latency_ms)
            : result.message}
        </span>
      )}
    </div>
  );
}
