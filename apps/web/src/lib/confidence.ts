/**
 * 置信度三档分类和颜色映射。
 * PRD F6 要求：不展示具体数值，仅颜色编码。
 */

export type ConfidenceLevel = "high" | "medium" | "low";

/** 置信度分档：>= 0.8 高，>= 0.5 中，< 0.5 低 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

/** 置信度颜色映射（适配暗色主题） */
export const confidenceColors: Record<
  ConfidenceLevel,
  { bg: string; text: string; border: string; dot: string }
> = {
  high: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/20",
    dot: "bg-green-400",
  },
  medium: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  low: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
    dot: "bg-red-400",
  },
};

/** 置信度标签 */
export const confidenceLabels: Record<ConfidenceLevel, string> = {
  high: "高置信度",
  medium: "中置信度",
  low: "低置信度",
};
