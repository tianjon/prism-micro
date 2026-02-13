/**
 * 全局常量定义。
 */

/** API 基地址（通过 Vite proxy 代理到后端） */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/** 槽位类型元数据 */
export const SLOT_META = {
  fast: {
    label: "快速模型",
    description: "格式校验、快速分类、标签标准化",
    icon: "Zap",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    borderColor: "border-yellow-400/20",
  },
  reasoning: {
    label: "推理模型",
    description: "语义拆解、标签涌现、合成数据",
    icon: "Brain",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    borderColor: "border-purple-400/20",
  },
  embedding: {
    label: "向量模型",
    description: "文本向量化",
    icon: "Cpu",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    borderColor: "border-blue-400/20",
  },
  rerank: {
    label: "重排序模型",
    description: "搜索结果重排序",
    icon: "ArrowUpDown",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    borderColor: "border-green-400/20",
  },
} as const;

/** 槽位类型的有序列表 */
export const SLOT_TYPES = ["fast", "reasoning", "embedding", "rerank"] as const;

/** z-index 层级常量 */
export const Z_INDEX = {
  /** 基础层（卡片悬浮等） */
  card: 10,
  /** 顶栏 + 遮罩 */
  topbar: 30,
  /** 侧边栏 */
  sidebar: 40,
  /** 下拉菜单 / Combobox 弹出层 */
  dropdown: 50,
  /** Toast 通知 */
  toast: 100,
} as const;
