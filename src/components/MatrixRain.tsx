import { useEffect, useRef } from "react";

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const fontSize = 14;
    let columns = Math.floor(width / fontSize);
    let drops: number[] = Array(columns).fill(1);

    const chars =
      "0123456789ABCDEF アカサタナハマヤラワ ΦΨΩ∑∆π√∞≈≠≤≥⌬⚛✧✦✩";
    const charset = chars.split("");

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      columns = Math.floor(width / fontSize);
      drops = Array(columns).fill(1);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const draw = () => {
      ctx.fillStyle = "rgba(5, 5, 8, 0.08)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = charset[Math.floor(Math.random() * charset.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Head: bright warm gold, tail: deep gold + chrome-blue blend
        const isHead = Math.random() > 0.985;
        if (isHead) {
          ctx.fillStyle = "rgba(255, 224, 130, 0.95)";
        } else {
          const palette = [
            "rgba(212, 175, 55, 0.55)",  // deep gold #D4AF37
            "rgba(212, 175, 55, 0.32)",  // deep gold, dim
            "rgba(70, 130, 180, 0.42)",  // chrome-blue #4682B4
            "rgba(70, 130, 180, 0.22)",  // chrome-blue, dim
          ];
          ctx.fillStyle = palette[(i + drops[i]) % palette.length];
        }
        ctx.fillText(ch, x, y);

        if (y > height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      aria-hidden
    />
  );
}
