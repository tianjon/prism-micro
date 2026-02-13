/**
 * 毛玻璃风格骨架屏。
 */

import { cn } from "@/lib/utils";

interface GlassSkeletonProps {
  className?: string;
}

export function GlassSkeleton({ className }: GlassSkeletonProps) {
  return <div className={cn("glass-skeleton", className)} />;
}

/** 卡片骨架屏 */
export function CardSkeleton() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3">
        <GlassSkeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <GlassSkeleton className="h-4 w-32" />
          <GlassSkeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <GlassSkeleton className="h-3 w-full" />
        <GlassSkeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}
