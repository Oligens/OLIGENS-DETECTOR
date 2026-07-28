interface Props {
  label: string;
  variant: "gold" | "cyan" | "ghost";
  fullWidth?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function ActionButton({
  label,
  variant,
  fullWidth,
  onClick,
  disabled,
}: Props) {
  const base =
    "rounded-[24px] px-4 py-3 text-sm font-semibold uppercase tracking-[0.25em] transition shadow-[0_12px_40px_rgba(0,0,0,0.18)]";
  const style =
    variant === "gold"
      ? "bg-gradient-to-r from-[#FFB800] via-[#FFD65C] to-[#FFEE94] text-[#05070B] shadow-[0_0_30px_rgba(255,184,0,0.35)]"
      : variant === "cyan"
      ? "bg-gradient-to-r from-[#00F0FF] via-[#39E6FF] to-[#61D5FF] text-[#03060A] shadow-[0_0_28px_rgba(0,240,255,0.35)]"
      : "bg-white/5 text-white/80 border border-white/10 hover:bg-white/10";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${style} ${fullWidth ? "w-full" : "inline-flex"} ${
        disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5"
      }`}
    >
      {label}
    </button>
  );
}
