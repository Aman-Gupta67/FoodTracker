import type { ReactNode } from "react";

export function MacroBar({
  label,
  consumed,
  target,
  color,
  colorBg,
  icon,
}: {
  label: string;
  consumed: number;
  target: number;
  color: string;
  colorBg: string;
  icon: ReactNode;
}) {
  const ratio = target > 0 ? Math.min(1, consumed / target) : 0;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[9px]"
        style={{ backgroundColor: colorBg }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="mb-0.5 flex justify-between text-[11px] font-semibold text-stone-500">
          <span>{label}</span>
          <span className="text-stone-700">
            {Math.round(consumed)}/{Math.round(target)}g
          </span>
        </div>
        <div className="h-1.5 rounded-full" style={{ backgroundColor: colorBg }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${ratio * 100}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}
