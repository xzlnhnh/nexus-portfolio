// 总览 — 组合市值、盈亏、大盘指数带、持仓快照
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Activity } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { useQuote, useStore } from "@/lib/store";
import { INDEX_SYMBOLS, fmtMoney, fmtNum, fmtPct, trendClass } from "@/lib/market";
import type { AnyHolding, Quote } from "@/types";

function HoldingRow({ h, onClick }: { h: AnyHolding; onClick?: () => void }) {
  const quote = useQuote(h.market, h.code);
  const value = quote?.price != null ? quote.price * h.shares : null;
  const cost = h.cost * h.shares;
  const pnl = value !== null ? value - cost : null;
  const pnlPct = value !== null && cost > 0 ? ((value - cost) / cost) * 100 : null;
  const cls = trendClass(pnl);
  return (
    <button onClick={onClick} className="pressable flex w-full items-center justify-between gap-3 rounded-2xl px-1 py-2.5 text-left">
      <div className="min-w-0">
        <div className="truncate text-[15px] font-medium t1">
          {quote?.name && quote.name !== h.code ? quote.name : h.name}
        </div>
        <div className="tnum text-[12px] t3">
          {h.market === "FUND" ? "基金" : h.market === "US" ? "美股" : "A股"} ·{" "}
          {h.code.replace(/^(sh|sz|bj)/i, "").toUpperCase()} · {fmtNum(h.shares, 0)}
          {h.market === "FUND" ? " 份" : " 股"}
        </div>
      </div>
      <div className="text-right">
        <div className={`tnum text-[15px] font-semibold ${trendClass(quote?.changePct)}`}>
          {fmtNum(quote?.price)}
        </div>
        <div className={`tnum text-[12px] ${cls}`}>
          {pnl !== null ? `${pnl > 0 ? "+" : ""}${fmtMoney(pnl)} (${fmtPct(pnlPct)})` : "--"}
        </div>
      </div>
    </button>
  );
}

function IndexStrip() {
  const { quotes } = useStore();
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
      {INDEX_SYMBOLS.map(({ symbol, label }) => {
        const q = quotes[symbol.toLowerCase()];
        const cls = trendClass(q?.changePct);
        return (
          <GlassCard key={symbol} radius={16} className="shrink-0 px-3.5 py-2.5">
            <div className="text-[11px] t3">{label}</div>
            <div className={`tnum text-[15px] font-semibold ${cls}`}>{fmtNum(q?.price)}</div>
            <div className={`tnum text-[11px] ${cls}`}>{fmtPct(q?.changePct)}</div>
          </GlassCard>
        );
      })}
    </div>
  );
}

export function Overview({ onInspect }: { onInspect: (h: AnyHolding) => void }) {
  const { holdings, quotes, quotesAt, quotesLoading, quotesError, refreshQuotes, setTab } = useStore();

  const metrics = holdings.map((h) => {
    const key =
      h.market === "FUND" ? "fund:" + h.code : h.market === "US" ? ("us" + h.code).toLowerCase() : h.code;
    const q: Quote | undefined = quotes[key];
    const value = q?.price != null ? q.price * h.shares : null;
    return { h, q, value, cost: h.cost * h.shares };
  });

  let totalValue = 0, totalCost = 0, dayPnl = 0, upCount = 0, counted = 0;
  for (const m of metrics) {
    if (m.value !== null) {
      totalValue += m.value;
      totalCost += m.cost;
      counted++;
      if (m.q?.changePct != null && m.q.prevClose) {
        dayPnl += (m.q.changePct / 100) * m.q.prevClose * m.h.shares;
      }
      if ((m.q?.changePct ?? 0) > 0) upCount++;
    }
  }
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;
  const pnlCls = trendClass(totalPnl);
  const dayCls = trendClass(dayPnl);

  return (
    <div className="anim-in px-4 pb-32">
      <header
        className="flex items-center justify-between px-1 pb-4"
        style={{ paddingTop: "max(10px, var(--sat))" }}
      >
        <div className="flex items-center gap-2">
          <span className="glass flex h-8 w-8 items-center justify-center" style={{ borderRadius: 10 }}>
            <Activity size={16} color="#9db9ff" />
          </span>
          <div>
            <div className="text-[15px] font-semibold tracking-wide t1">Nexus 持仓智能</div>
            <div className="text-[11px] t3">Portfolio Intelligence · Glass</div>
          </div>
        </div>
        <button
          onClick={refreshQuotes}
          className="pressable glass flex h-9 w-9 items-center justify-center"
          style={{ borderRadius: 12 }}
          aria-label="刷新行情"
        >
          <RefreshCw size={16} color="#9db9ff" className={quotesLoading ? "spin-slow" : ""} />
        </button>
      </header>

      <IndexStrip />

      <GlassCard strong radius={24} className="mt-3 px-5 py-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] t2">组合总市值</span>
          <span className="flex items-center gap-1.5 text-[11px] t3">
            <span
              className="live-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: quotesError ? "#ff9d5d" : "#2fd08c" }}
            />
            {quotesError ? "行情异常" : quotesLoading ? "刷新中" : quotesAt ? new Date(quotesAt).toLocaleTimeString("zh-CN") : "--"}
          </span>
        </div>
        <div className="tnum mt-1 text-[36px] font-bold leading-tight tracking-tight t1">
          {counted ? fmtMoney(totalValue) : "--"}
        </div>
        <div className="mt-3 flex gap-2">
          <div className="flex-1 rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-1 text-[11px] t3">
              {totalPnl >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} 持仓盈亏
            </div>
            <div className={`tnum text-[15px] font-semibold ${pnlCls}`}>
              {counted ? `${totalPnl > 0 ? "+" : ""}${fmtMoney(totalPnl)}（${fmtPct(totalPnlPct)}）` : "--"}
            </div>
          </div>
          <div className="flex-1 rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-1 text-[11px] t3">
              <Wallet size={11} /> 当日参考
            </div>
            <div className={`tnum text-[15px] font-semibold ${dayCls}`}>
              {counted ? `${dayPnl > 0 ? "+" : ""}${fmtMoney(dayPnl)}` : "--"}
            </div>
          </div>
          <div className="flex-1 rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="text-[11px] t3">上涨资产</div>
            <div className="tnum text-[15px] font-semibold t1">{counted ? `${upCount}/${counted}` : "--"}</div>
          </div>
        </div>
        {quotesError && (
          <div className="mt-3 rounded-xl px-3 py-2 text-[12px]" style={{ background: "rgba(255,157,93,0.12)", color: "#ffb98a" }}>
            {quotesError}
          </div>
        )}
      </GlassCard>

      <div className="mt-5 flex items-end justify-between px-1">
        <h2 className="text-[17px] font-semibold t1">持仓快照</h2>
        <button className="pressable text-[13px] accent" onClick={() => setTab("holdings")}>
          管理持仓 →
        </button>
      </div>
      <GlassCard radius={22} className="mt-2 px-4 py-1.5">
        {metrics.length === 0 ? (
          <div className="py-8 text-center text-[13px] t3">暂无持仓，去「持仓」页添加，或导入旧版备份</div>
        ) : (
          metrics.map(({ h }) => <HoldingRow key={h.id} h={h} onClick={() => onInspect(h)} />)
        )}
      </GlassCard>
    </div>
  );
}
