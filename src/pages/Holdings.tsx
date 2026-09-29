// 持仓管理 — 股票 / 基金 添加与删除
import { useState } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { useQuote, useStore } from "@/lib/store";
import { normalizeAStockCode, normalizeFundCode, normalizeUSTicker, fmtNum, fmtPct, trendClass } from "@/lib/market";
import type { AnyHolding } from "@/types";

function Row({ h, onDelete }: { h: AnyHolding; onDelete: () => void }) {
  const quote = useQuote(h.market, h.code);
  const price = quote?.price ?? null;
  const value = price !== null ? price * h.shares : null;
  const cost = h.cost * h.shares;
  const pnl = value !== null ? value - cost : null;
  const pnlPct = value !== null && cost > 0 ? ((value - cost) / cost) * 100 : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[15px] font-medium t1">
          {quote?.name && quote.name !== h.code ? quote.name : h.name}
        </div>
        <div className="tnum text-[12px] t3">
          {h.market === "FUND" ? "基金" : h.market === "US" ? "美股" : "A股"} ·{" "}
          {h.code.replace(/^(sh|sz|bj)/i, "").toUpperCase()} · 成本 {fmtNum(h.cost)}
          {h.market === "FUND" ? "" : " /股"}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className={`tnum text-[15px] font-semibold ${trendClass(quote?.changePct)}`}>
            {fmtNum(price)}
          </div>
          <div className={`tnum text-[12px] ${trendClass(pnl)}`}>
            {pnl !== null ? `${pnl > 0 ? "+" : ""}${fmtNum(pnl)} (${fmtPct(pnlPct)})` : "--"}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="pressable flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: "rgba(255,93,93,0.12)", color: "#ff8d8d" }}
          aria-label="删除持仓"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function Holdings() {
  const { holdings, addHolding, removeHolding } = useStore();
  const [seg, setSeg] = useState<"CN" | "US" | "FUND">("CN");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [err, setErr] = useState("");

  const stocks = holdings.filter((h) => h.market !== "FUND");
  const funds = holdings.filter((h) => h.market === "FUND");

  const submit = () => {
    setErr("");
    let normCode = "";
    if (seg === "CN") normCode = normalizeAStockCode(code);
    else if (seg === "US") normCode = normalizeUSTicker(code);
    else normCode = normalizeFundCode(code);
    if (!normCode) return setErr(seg === "US" ? "美股代码格式不正确" : seg === "CN" ? "A股代码应为 6 位数字" : "基金代码应为 6 位数字");
    const sh = parseFloat(shares);
    const c = parseFloat(cost);
    if (!Number.isFinite(sh) || sh <= 0) return setErr("请填写有效的数量/份额");
    if (!Number.isFinite(c) || c <= 0) return setErr("请填写有效的成本");
    addHolding({
      market: seg,
      name: name.trim() || (seg === "US" ? normCode : normCode.replace(/^(sh|sz|bj)/i, "").toUpperCase()),
      code: normCode,
      shares: sh,
      cost: c,
    });
    setName("");
    setCode("");
    setShares("");
    setCost("");
  };

  const segs: { key: "CN" | "US" | "FUND"; label: string }[] = [
    { key: "CN", label: "A 股" },
    { key: "US", label: "美股" },
    { key: "FUND", label: "基金" },
  ];

  return (
    <div className="anim-in px-4 pb-32">
      <header style={{ paddingTop: "max(10px, var(--sat))" }} className="px-1 pb-4 pt-2">
        <h1 className="text-[22px] font-bold t1">持仓管理</h1>
        <p className="text-[12px] t3">数据只保存在本机浏览器，零云端费用</p>
      </header>

      <GlassCard radius={22} className="px-4 py-4">
        <div className="mb-3 flex gap-1.5">
          {segs.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSeg(s.key); setErr(""); }}
              className="pressable flex-1 rounded-xl py-2 text-[13px] transition-colors"
              style={{
                background: seg === s.key ? "rgba(122,168,255,0.2)" : "rgba(255,255,255,0.05)",
                color: seg === s.key ? "#9db9ff" : "rgba(200,212,235,0.55)",
                fontWeight: seg === s.key ? 600 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <input className="field" placeholder="名称（可留空自动识别）" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field tnum" placeholder={seg === "CN" ? "代码 如 600519" : seg === "US" ? "代码 如 AAPL" : "基金代码 6 位"} value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="field tnum" placeholder={seg === "FUND" ? "持有份额" : "持股数量"} inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} />
          <input className="field tnum" placeholder={seg === "FUND" ? "成本净值" : "每股成本"} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        {err && <div className="mt-2 text-[12px]" style={{ color: "#ff9d8a" }}>{err}</div>}
        <button className="btn-primary pressable mt-3 flex w-full items-center justify-center gap-1.5" onClick={submit}>
          <Plus size={16} /> 添加{seg === "FUND" ? "基金" : "股票"}
        </button>
      </GlassCard>

      <div className="mt-5 flex items-center gap-1.5 px-1">
        <Layers size={15} className="t2" />
        <h2 className="text-[16px] font-semibold t1">股票持仓 ({stocks.length})</h2>
      </div>
      <GlassCard radius={22} className="mt-2 px-4 py-1.5">
        {stocks.length === 0 ? (
          <div className="py-6 text-center text-[13px] t3">还没有股票持仓</div>
        ) : (
          stocks.map((h) => <Row key={h.id} h={h} onDelete={() => removeHolding(h.id)} />)
        )}
      </GlassCard>

      <div className="mt-5 px-1">
        <h2 className="text-[16px] font-semibold t1">基金持仓 ({funds.length})</h2>
      </div>
      <GlassCard radius={22} className="mt-2 px-4 py-1.5">
        {funds.length === 0 ? (
          <div className="py-6 text-center text-[13px] t3">还没有基金持仓</div>
        ) : (
          funds.map((h) => <Row key={h.id} h={h} onDelete={() => removeHolding(h.id)} />)
        )}
      </GlassCard>
    </div>
  );
}
