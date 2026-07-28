interface Props {
  label: string;
  accent: "gold" | "cyan";
  onClick?: () => void;
}

export function SidebarButton({ label, accent, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[28px] border px-4 py-4 text-left text-sm font-semibold uppercase tracking-[0.25em] transition ${
        accent === "gold"
          ? "border-[#FFB800]/35 bg-[#FFB800]/10 text-[#FFD97E] hover:border-[#FFB800]/55"
          : "border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300/50"
      }`}
    >
      {label}
    </button>
  );
}
