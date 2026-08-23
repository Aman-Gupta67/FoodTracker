// Hand-rolled SVG ring — no chart library, per the stack constraint.
// Over-target renders in stone-600, not red: "information, not a scolding."

const SIZE = 140;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({
  consumed,
  target,
}: {
  consumed: number;
  target: number;
}) {
  const remaining = target - consumed;
  const isOver = remaining < 0;
  const ratio = target > 0 ? Math.min(1, consumed / target) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - ratio);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-primary-100)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={isOver ? "var(--color-stone-500)" : "var(--color-primary-500)"}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={
            "text-xl font-medium " + (isOver ? "text-stone-600" : "text-stone-900")
          }
        >
          {Math.round(Math.abs(remaining))}
        </span>
        <span className="text-xs text-stone-500">
          {isOver ? "over" : "remaining"}
        </span>
      </div>
    </div>
  );
}
