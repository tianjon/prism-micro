/**
 * 通用页面容器。
 * 提供居中限宽 + 内边距，供非全宽页面使用。
 */

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
