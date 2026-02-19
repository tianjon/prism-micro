/**
 * 通用卡片列表组件。
 * 提供 loading 骨架屏和空态展示。
 */

import type { ReactNode } from "react";

interface DataCardListProps<T> {
  items: T[];
  loading: boolean;
  emptyMessage: string;
  renderCard: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string;
}

function SkeletonCard() {
  return (
    <div className="glass-card p-4 space-y-3" style={{ pointerEvents: "none" }}>
      <div className="glass-skeleton h-4 w-3/4 rounded" />
      <div className="glass-skeleton h-3 w-1/2 rounded" />
      <div className="flex gap-1.5">
        <div className="glass-skeleton h-5 w-16 rounded-md" />
        <div className="glass-skeleton h-5 w-20 rounded-md" />
        <div className="glass-skeleton h-5 w-24 rounded-md" />
      </div>
    </div>
  );
}

export function DataCardList<T>({
  items,
  loading,
  emptyMessage,
  renderCard,
  keyExtractor,
}: DataCardListProps<T>) {
  if (loading && items.length === 0) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-white/30 text-sm">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={keyExtractor(item)}>{renderCard(item, idx)}</div>
      ))}
    </div>
  );
}
