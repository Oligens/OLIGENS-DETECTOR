interface Props {
  label: string;
  value: string;
}

export function BIStatusBlock({ label, value }: Props) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#05070B]/70 px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}
