export type HeatmapSegment = {
  id: string;
  text: string;
  score: number;
  variant: "ai" | "mixed" | "human";
};

interface Props {
  text: string;
  segments: HeatmapSegment[];
  onTextChange: (value: string) => void;
  showHeatmap: boolean;
  rows?: number;
  placeholder?: string;
}

export function HeatmapText({
  text,
  segments,
  onTextChange,
  showHeatmap,
  rows = 12,
  placeholder = "Collez votre texte ici pour déceler l'empreinte IA...",
}: Props) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#04060A]/90 p-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.18)]">
      <div className="pointer-events-none absolute inset-0 bg-grid-lines opacity-20" />
      <div className="absolute inset-0 z-10 overflow-hidden rounded-[28px] px-4 py-4">
        <pre className="m-0 min-h-full whitespace-pre-wrap break-words font-mono text-sm leading-6 text-white/90">
          {showHeatmap ? (
            text.trim() ? (
              segments.map((segment) => {
                const variantClasses =
                  segment.variant === "ai"
                    ? "rounded-2xl bg-[#FFB800]/20 px-2 py-[2px] text-[#FFF0B2]"
                    : segment.variant === "human"
                    ? "rounded-2xl bg-cyan-400/15 px-2 py-[2px] text-cyan-100"
                    : "rounded-2xl bg-white/5 px-2 py-[2px] text-white/75";
                return (
                  <span key={segment.id} className={variantClasses}>
                    {segment.text}
                    {" "}
                  </span>
                );
              })
            ) : (
              <span className="text-white/40">{placeholder}</span>
            )
          ) : (
            text || placeholder
          )}
        </pre>
      </div>
      <textarea
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        rows={rows}
        className="relative z-20 min-h-[280px] w-full resize-none rounded-[28px] border-none bg-transparent px-4 py-4 text-sm leading-6 text-transparent caret-white selection:bg-white/20 outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}
