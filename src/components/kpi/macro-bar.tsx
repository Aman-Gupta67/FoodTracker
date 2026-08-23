export function MacroBar({
  label,
  consumed,
  target,
  color,
}: {
  label: string;
  consumed: number;
  target: number;
  color: string;
}) {
  const ratio = target > 0 ? Math.min(1, consumed / target) : 0;

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-stone-600">
        <span>{label}</span>
        <span>
          {Math.round(consumed)} / {Math.round(target)} g
        </span>
      </div>
      <div className="h-2 rounded-full bg-stone-100">
        <div
          className="h-2 rounded-full"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
