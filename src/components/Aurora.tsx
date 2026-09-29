// 动态极光背景：漂浮光球 + 指针跟随光晕 + 噪点
import { useEffect } from "react";

export function Aurora() {
  useEffect(() => {
    let raf = 0;
    let targetX = 50, targetY = 30, curX = 50, curY = 30;
    const onMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;
    };
    const tick = () => {
      curX += (targetX - curX) * 0.04;
      curY += (targetY - curY) * 0.04;
      document.documentElement.style.setProperty("--mx", curX.toFixed(2) + "%");
      document.documentElement.style.setProperty("--my", curY.toFixed(2) + "%");
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="aurora-stage" aria-hidden>
      <div className="aurora-orb orb-a" />
      <div className="aurora-orb orb-b" />
      <div className="aurora-orb orb-c" />
      <div className="aurora-orb orb-pointer" />
      <div className="aurora-grain" />
    </div>
  );
}
