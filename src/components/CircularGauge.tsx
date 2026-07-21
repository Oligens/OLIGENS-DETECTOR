interface Props {
  value: number; // 0..1
  label: string;
  sublabel?: string;
  size?: number;
}

export function CircularGauge({ value, label, sublabel, size = 200 }: Props) {
  const pct = Math.max(0, Math.min(1, value));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const isDanger = pct > 0.65;
  const isWarn = pct > 0.35 && pct <= 0.65;
  const color = isDanger ? "#ff4d6d" : isWarn ? "#ffd700" : "#7CFFB2";

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="g-track" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <linearGradient id="g-arc" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#g-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#g-arc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 8px ${color})`,
            transition: "stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="font-mono text-4xl font-bold tabular-nums"
          style={{ color, textShadow: `0 0 12px ${color}80` }}
        >
          {(pct * 100).toFixed(1)}%
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
          {label}
        </div>
        {sublabel && (
          <div className="mt-1 text-[10px] text-white/40">{sublabel}</div>
        )}
      </div>
    </div>
  );
}
