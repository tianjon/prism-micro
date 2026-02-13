/**
 * Playground 页面 — OpenAI Playground 风格左右分栏。
 * 编排 PlaygroundHeader + PlaygroundSidebar + 内容区（ChatContent / EmbeddingPanel / RerankPanel）。
 */

import { useState } from "react";
import { useProviders } from "@/features/admin/hooks/use-providers";
import { PlaygroundHeader } from "../components/PlaygroundHeader";
import { PlaygroundSidebar } from "../components/PlaygroundSidebar";
import { ChatContent } from "../components/ChatContent";
import type { ChatMessage } from "../components/ChatContent";
import { EmbeddingPanel } from "../components/EmbeddingPanel";
import { RerankPanel } from "../components/RerankPanel";
import type { PlaygroundMode, ChatParams } from "../types";
import { DEFAULT_CHAT_PARAMS } from "../types";

export function PlaygroundPage() {
  const [mode, setMode] = useState<PlaygroundMode>("chat");
  const [providerId, setProviderId] = useState<string | null>(null);
  const [modelId, setModelId] = useState("");
  const [chatParams, setChatParams] = useState<ChatParams>(DEFAULT_CHAT_PARAMS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const { providers } = useProviders();

  const handleClear = () => {
    setMessages([]);
    setStreaming(false);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      <PlaygroundHeader
        mode={mode}
        onModeChange={setMode}
        onClear={handleClear}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onToggleDesktopSidebar={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
        hasMessages={messages.length > 0}
        desktopSidebarCollapsed={desktopSidebarCollapsed}
      />

      <div className="flex min-h-0 flex-1">
        <PlaygroundSidebar
          providerId={providerId}
          onProviderChange={setProviderId}
          modelId={modelId}
          onModelChange={setModelId}
          providers={providers}
          mode={mode}
          chatParams={chatParams}
          onChatParamsChange={setChatParams}
          collapsed={desktopSidebarCollapsed}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="min-w-0 flex-1 overflow-hidden">
          {mode === "chat" && (
            <ChatContent
              providerId={providerId}
              modelId={modelId}
              chatParams={chatParams}
              messages={messages}
              onMessagesChange={setMessages}
              streaming={streaming}
              onStreamingChange={setStreaming}
            />
          )}
          {mode === "embedding" && (
            <EmbeddingPanel providerId={providerId} modelId={modelId} />
          )}
          {mode === "rerank" && (
            <RerankPanel providerId={providerId} modelId={modelId} />
          )}
        </div>
      </div>
    </div>
  );
}
