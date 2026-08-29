// One consistent tile for every logged/searchable food item — replaces the
// earlier per-item random accent colors, which read as meaningless noise
// rather than information (macro colors are the only colors that carry
// real meaning in this app).
export function FoodTile({ size = 38 }: { size?: number }) {
  const iconSize = Math.round(size * 0.47);
  return (
    <div
      style={{ width: size, height: size, borderRadius: size * 0.32 }}
      className="flex flex-shrink-0 items-center justify-center bg-primary-100"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-primary-700)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 13a8 8 0 0 0 16 0Z" />
        <path d="M4 13h16" />
        <path d="M12 13V7" />
      </svg>
    </div>
  );
}
