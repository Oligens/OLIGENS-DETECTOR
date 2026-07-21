interface Props {
  label: string;
  value: number; // 0..1
  raw?: string;
  inverted?: boolean; // when true, high raw value = human (green)
}

export function MetricBar({ label, value, raw, inverted }: Props) {
  const pct = Math.max(0, Math.min(1, value));
  const humanLean = inverted ? pct : 1 - pct;
  const color =
    humanLean > 0.65 ? "#7CFFB2" : humanLean > 0.35 ? "#FFD700" : "#ff4d6d";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em]">
        <span className="text-white/70">{label}</span>
        <span className="text-white/90" style={{ color }}>
          {raw ?? (pct * 100).toFixed(1) + "%"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct * 100}%`,
            background: `linear-gradient(90deg, ${color}, #D4AF37)`,
            boxShadow: `0 0 10px ${color}80`,
          }}
        />
      </div>
    </div>
  );
}
