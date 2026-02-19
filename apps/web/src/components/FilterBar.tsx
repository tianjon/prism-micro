/**
 * 筛选栏组件。
 * 水平排列多个 glass-input select。
 */

export interface FilterField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function FilterBar({ fields, values, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <label className="text-xs text-white/40">{field.label}</label>
          <select
            value={values[field.key] ?? ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="glass-input h-8 px-3 text-xs min-w-[120px] cursor-pointer"
          >
            <option value="">全部</option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
