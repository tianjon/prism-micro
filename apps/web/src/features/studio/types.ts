/**
 * Studio 模块类型定义。
 */

export type PlaygroundMode = "chat" | "embedding" | "rerank";

export interface ChatParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
}

export const DEFAULT_CHAT_PARAMS: ChatParams = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
  systemPrompt: "",
};
