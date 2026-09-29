// 玻璃卡片：随指尖移动的高光（iOS 液态玻璃质感）
import React, { useRef } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  strong?: boolean;
  radius?: number;
}

export function GlassCard({ children, strong, radius = 20, style, className = "", ...rest }: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
    el.style.setProperty("--spec", "1");
  };
  const onPointerLeave = () => {
    ref.current?.style.setProperty("--spec", "0");
  };

  return (
    <div
      ref={ref}
      className={`glass ${strong ? "glass-strong" : ""} ${className}`}
      style={{ borderRadius: radius, ...style }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      {...rest}
    >
      {children}
    </div>
  );
}
