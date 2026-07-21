interface Props {
  active: boolean;
  bars?: number;
}

export function SoundWave({ active, bars = 24 }: Props) {
  return (
    <div className="flex h-8 items-center gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: active ? `${20 + Math.sin(i * 0.7) * 40 + 30}%` : "10%",
            background:
              "linear-gradient(180deg, #FFD700, rgba(212,175,55,0.4))",
            boxShadow: active ? "0 0 6px rgba(255,215,0,0.6)" : "none",
            animation: active
              ? `oligens-wave 900ms ease-in-out ${i * 40}ms infinite alternate`
              : "none",
          }}
        />
      ))}
    </div>
  );
}
