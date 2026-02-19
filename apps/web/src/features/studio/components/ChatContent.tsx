/**
 * Chat 内容区 — 纯对话 UI。
 * 消息流 + 底部输入框 + SSE 流式处理。
 * 不包含模式切换或 Provider/Model 选择（已提升至 Sidebar）。
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SIZE } from "@/lib/icon-sizes";
import type { MessageItem, UsageInfo } from "@/api/types";
import type { ChatParams } from "../types";
import { callCompletionStream } from "../api/studio-api";

export interface ChatMessage extends MessageItem {
  id: string;
}

interface SessionStats {
  usage: UsageInfo;
  latency_ms: number;
  model: string;
}

interface ChatContentProps {
  providerId: string | null;
  modelId: string;
  chatParams: ChatParams;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  streaming: boolean;
  onStreamingChange: (streaming: boolean) => void;
}

export function ChatContent({
  providerId,
  modelId,
  chatParams,
  messages,
  onMessagesChange,
  streaming,
  onStreamingChange,
}: ChatContentProps) {
  const [input, setInput] = useState("");
  const [lastStats, setLastStats] = useState<SessionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const canSend = providerId && modelId && input.trim() && !streaming;

  const handleSend = async () => {
    if (!canSend) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      role: "user",
      content: input.trim(),
    };
    const assistantMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      role: "assistant",
      content: "",
    };

    const updatedMessages = [...messages, userMsg, assistantMsg];
    onMessagesChange(updatedMessages);
    setInput("");
    onStreamingChange(true);
    setLastStats(null);
    setError(null);

    // 构造 API 消息：system prompt + 历史（过滤空 assistant 占位）
    const apiMessages: { role: string; content: string }[] = [];
    if (chatParams.systemPrompt.trim()) {
      apiMessages.push({ role: "system", content: chatParams.systemPrompt.trim() });
    }
    for (const m of updatedMessages) {
      if (m.role === "assistant" && !m.content) continue;
      apiMessages.push({ role: m.role, content: m.content });
    }

    await callCompletionStream(
      {
        provider_id: providerId,
        model_id: modelId,
        messages: apiMessages,
        max_tokens: chatParams.maxTokens,
        temperature: chatParams.temperature,
        top_p: chatParams.topP,
      },
      (delta) => {
        onMessagesChange(
          updatedMessages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content + delta }
              : m,
          ),
        );
        // 更新闭包内的 updatedMessages 以累积 delta
        const target = updatedMessages.find((m) => m.id === assistantMsg.id);
        if (target) target.content += delta;
      },
      (summary) => {
        setLastStats({
          usage: summary.usage,
          latency_ms: summary.latency_ms,
          model: summary.model,
        });
        onStreamingChange(false);
      },
      (err) => {
        // 移除空的 assistant 占位
        onMessagesChange(updatedMessages.filter((m) => m.id !== assistantMsg.id));
        setError(err.message);
        setLastFailedInput(userMsg.content);
        onStreamingChange(false);
      },
    );
  };

  const handleRetry = () => {
    if (!lastFailedInput) return;
    setInput(lastFailedInput);
    setError(null);
    setLastFailedInput(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  /* ── 空态提示 ── */
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
              <span className="text-lg font-bold text-indigo-400">P</span>
            </div>
            <p className="text-sm text-white/30">
              {!providerId || !modelId
                ? "请在左侧面板选择 Provider 和模型"
                : "输入消息开始对话"}
            </p>
          </div>
        </div>

        {/* 底部输入 */}
        <div className="border-t border-white/5 px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <InputCard
              input={input}
              onInputChange={setInput}
              onKeyDown={handleKeyDown}
              onSend={() => void handleSend()}
              canSend={!!canSend}
              streaming={streaming}
              disabled={!providerId || !modelId}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── 活跃态：消息流 + 底部输入 ── */
  return (
    <div className="flex h-full flex-col">
      {/* 消息流 */}
      <div className="flex-1 overflow-y-auto" role="log" aria-live="polite" aria-label="对话消息">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] text-sm leading-relaxed",
                  msg.role === "user"
                    ? "rounded-2xl bg-indigo-500/10 px-4 py-3 text-white/90"
                    : "text-white/80",
                )}
              >
                <p className="whitespace-pre-wrap">
                  {msg.content || (
                    <span className="inline-flex items-center gap-1.5 text-white/30">
                      <Loader2 size={ICON_SIZE.sm} className="animate-spin" />
                      思考中...
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}

          {lastStats && (
            <div className="flex items-center gap-4 text-xs text-white/20">
              <span>{lastStats.model}</span>
              <span>{lastStats.latency_ms}ms</span>
              <span>
                {lastStats.usage.prompt_tokens} + {lastStats.usage.completion_tokens} ={" "}
                {lastStats.usage.total_tokens} tokens
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="border-t border-red-500/10 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-300">
            <span className="flex-1">{error}</span>
            {lastFailedInput && (
              <button
                type="button"
                onClick={handleRetry}
                className="shrink-0 cursor-pointer rounded-lg border border-red-500/20 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
              >
                重新发送
              </button>
            )}
          </div>
        </div>
      )}

      {/* 底部输入 */}
      <div className="border-t border-white/5 px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <InputCard
            input={input}
            onInputChange={setInput}
            onKeyDown={handleKeyDown}
            onSend={() => void handleSend()}
            canSend={!!canSend}
            streaming={streaming}
            disabled={!providerId || !modelId}
          />
        </div>
      </div>
    </div>
  );
}

/* ── 输入卡片子组件 ── */

function InputCard({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  canSend,
  streaming,
  disabled,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  canSend: boolean;
  streaming: boolean;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="px-4 pt-3 pb-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            disabled
              ? "请先选择 Provider 和模型"
              : "输入消息... (Enter 发送, Shift+Enter 换行)"
          }
          disabled={disabled}
          rows={2}
          aria-label="输入消息"
          className="w-full resize-none bg-transparent text-sm leading-relaxed text-white/90 placeholder:text-white/25 focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-end px-3 pb-2.5">
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="发送消息"
          className={cn(
            "shrink-0 cursor-pointer rounded-xl p-2 transition-all disabled:opacity-30",
            canSend
              ? "bg-indigo-500/80 text-white hover:bg-indigo-500"
              : "text-white/30",
          )}
        >
          {streaming ? (
            <Loader2 size={ICON_SIZE.lg} className="animate-spin" />
          ) : (
            <Send size={ICON_SIZE.lg} />
          )}
        </button>
      </div>
    </div>
  );
}
