// 应用外壳 — 极光背景 + 页面路由 + 资产详情浮层
import { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { Aurora } from "@/components/Aurora";
import { BottomNav } from "@/components/BottomNav";
import { GlassCard } from "@/components/GlassCard";
import { Overview } from "@/pages/Overview";
import { Holdings } from "@/pages/Holdings";
import { Watchlist } from "@/pages/Watchlist";
import { Research } from "@/pages/Research";
import { Settings } from "@/pages/Settings";
import { useQuote, useStore } from "@/lib/store";
import { fmtMoney, fmtNum, fmtPct, trendClass } from "@/lib/market";
import type { AnyHolding } from "@/types";

function DetailSheet({ h, onClose }: { h: AnyHolding; onClose: () => void }) {
  const quote = useQuote(h.market, h.code);
  const price = quote?.price ?? null;
  const value = price !== null ? price * h.shares : null;
  const cost = h.cost * h.shares;
  const pnl = value !== null ? value - cost : null;
  const pnlPct = value !== null && cost > 0 ? ((value - cost) / cost) * 100 : null;
  const cls = trendClass(pnl);
  const rows: [string, string][] = [
    ["现价", fmtNum(price)],
    ["成本", fmtNum(h.cost)],
    ["持有数量", `${fmtNum(h.shares, 0)}${h.market === "FUND" ? " 份" : " 股"}`],
    ["市值", value !== null ? fmtMoney(value) : "--"],
    ["成本金额", fmtMoney(cost)],
    ["当日涨跌", fmtPct(quote?.changePct)],
    ["今日最高", fmtNum(quote?.high)],
    ["今日最低", fmtNum(quote?.low)],
    ["昨收", fmtNum(quote?.prevClose)],
    ["数据时间", quote?.time ? String(quote.time).replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3 $4:$5") : "--"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0" style={{ background: "rgba(3,5,10,0.55)", backdropFilter: "blur(6px)" }} onClick={onClose} />
      <GlassCard strong radius={26} className="anim-in relative w-full max-w-md px-5 pt-4 pb-8" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: "max(28px, var(--sab))" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.25)" }} />
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[19px] font-bold t1">{quote?.name && quote.name !== h.code ? quote.name : h.name}</div>
            <div className="tnum mt-0.5 text-[12px] t3">
              {h.market === "FUND" ? "基金" : h.market === "US" ? "美股" : "A股"} · {h.code.replace(/^(sh|sz|bj)/i, "").toUpperCase()}
            </div>
          </div>
          <button onClick={onClose} className="pressable flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }} aria-label="关闭">
            <X size={15} className="t2" />
          </button>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div className={`tnum text-[32px] font-bold ${trendClass(quote?.changePct)}`}>{fmtNum(price)}</div>
          <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-semibold ${cls ? (cls === "up" ? "chip-up" : "chip-down") : ""}`}>
            {pnl !== null ? (pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />) : null}
            {pnl !== null ? `${pnl > 0 ? "+" : ""}${fmtMoney(pnl)} (${fmtPct(pnlPct)})` : "--"}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="text-[11px] t3">{k}</div>
              <div className="tnum mt-0.5 text-[14px] font-medium t1">{v}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

export default function App() {
  const { tab } = useStore();
  const [inspect, setInspect] = useState<AnyHolding | null>(null);

  useEffect(() => {
    document.title = "Nexus 持仓智能";
  }, []);

  return (
    <div className="relative min-h-[100dvh]">
      <Aurora />
      <main className="relative z-10 mx-auto w-full max-w-md scroll-y">
        {tab === "overview" && <Overview onInspect={setInspect} />}
        {tab === "holdings" && <Holdings />}
        {tab === "watchlist" && <Watchlist />}
        {tab === "research" && <Research />}
        {tab === "settings" && <Settings />}
      </main>
      <BottomNav />
      {inspect && <DetailSheet h={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}
