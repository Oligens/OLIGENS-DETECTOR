interface Props {
  value: number; // 0..1
  accent?: "gold" | "cyan";
  hideLabel?: boolean;
  label?: string;
}

export function MetricBar({ value, accent = "gold", hideLabel, label }: Props) {
  const pct = Math.max(0, Math.min(1, value));
  const color = accent === "gold" ? "#FFB800" : "#00F0FF";
  return (
    <div className="space-y-2">
      {!hideLabel ? (
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
          <span>{label ?? `${Math.round(pct * 100)}%`}</span>
          <span>{pct > 0.8 ? "Élevé" : pct > 0.5 ? "Moyen" : "Bas"}</span>
        </div>
      ) : null}
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.round(pct * 100)}%`,
            background:
              accent === "gold"
                ? "linear-gradient(90deg, #FFB800, #FFD55A)"
                : "linear-gradient(90deg, #00F0FF, #43E9FF)",
            boxShadow: `0 0 12px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}
