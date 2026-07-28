interface Props {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function TabButton({ active, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.35em] transition ${
        active
          ? "border-[color:var(--oligens-gold)] bg-[rgba(255,184,0,0.16)] text-[color:var(--oligens-gold)]"
          : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}
