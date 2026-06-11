interface Props {
  score: number;
  size?: "sm" | "md";
  label?: string;
}

export default function ConfidenceBadge({ score, size = "md", label }: Props) {
  const pct = Math.round(score);
  const color =
    pct >= 80 ? "bg-red-100 text-red-700 border-red-200"
    : pct >= 60 ? "bg-amber-100 text-amber-700 border-amber-200"
    : pct >= 40 ? "bg-yellow-100 text-yellow-700 border-yellow-200"
    : "bg-green-100 text-green-700 border-green-200";

  const sizeClass = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${color} ${sizeClass}`}>
      {label ?? `${pct}%`}
    </span>
  );
}
