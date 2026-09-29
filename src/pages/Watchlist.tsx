// 自选分析池 — 关注但不计入组合市值
import { useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { useQuote, useStore } from "@/lib/store";
import { normalizeAStockCode, normalizeFundCode, normalizeUSTicker, fmtNum, fmtPct, trendClass } from "@/lib/market";
import type { WatchItem } from "@/types";

function Row({ w, onDelete }: { w: WatchItem; onDelete: () => void }) {
  const quote = useQuote(w.market, w.code);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[15px] font-medium t1">
          {quote?.name && quote.name !== w.code ? quote.name : w.name}
        </div>
        <div className="tnum text-[12px] t3">
          {w.market === "FUND" ? "基金" : w.market === "US" ? "美股" : "A股"} ·{" "}
          {w.code.replace(/^(sh|sz|bj)/i, "").toUpperCase()}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className={`tnum text-[15px] font-semibold ${trendClass(quote?.changePct)}`}>
            {fmtNum(quote?.price)}
          </div>
          <div className={`tnum text-[12px] ${trendClass(quote?.changePct)}`}>{fmtPct(quote?.changePct)}</div>
        </div>
        <button
          onClick={onDelete}
          className="pressable flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: "rgba(255,93,93,0.12)", color: "#ff8d8d" }}
          aria-label="移出自选"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function Watchlist() {
  const { watchlist, addWatch, removeWatch } = useStore();
  const [seg, setSeg] = useState<"CN" | "US" | "FUND">("CN");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    let norm = "";
    if (seg === "CN") norm = normalizeAStockCode(code);
    else if (seg === "US") norm = normalizeUSTicker(code);
    else norm = normalizeFundCode(code);
    if (!norm) return setErr("代码格式不正确");
    addWatch({
      market: seg,
      name: name.trim() || (seg === "US" ? norm : norm.replace(/^(sh|sz|bj)/i, "").toUpperCase()),
      code: norm,
    });
    setName("");
    setCode("");
  };

  const segs: { key: "CN" | "US" | "FUND"; label: string }[] = [
    { key: "CN", label: "A 股" },
    { key: "US", label: "美股" },
    { key: "FUND", label: "基金" },
  ];

  return (
    <div className="anim-in px-4 pb-32">
      <header style={{ paddingTop: "max(10px, var(--sat))" }} className="px-1 pb-4 pt-2">
        <h1 className="text-[22px] font-bold t1">自选分析池</h1>
        <p className="text-[12px] t3">自选会拉取行情展示在这里，不计入组合总市值</p>
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
          <input className="field" placeholder="名称（可留空）" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field tnum" placeholder={seg === "CN" ? "代码 如 300308" : seg === "US" ? "代码 如 NVDA" : "基金代码"} value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        {err && <div className="mt-2 text-[12px]" style={{ color: "#ff9d8a" }}>{err}</div>}
        <button className="btn-primary pressable mt-3 flex w-full items-center justify-center gap-1.5" onClick={submit}>
          <Plus size={16} /> 加入自选
        </button>
      </GlassCard>

      <div className="mt-5 flex items-center gap-1.5 px-1">
        <Star size={15} color="#ffd28a" />
        <h2 className="text-[16px] font-semibold t1">我的自选 ({watchlist.length})</h2>
      </div>
      <GlassCard radius={22} className="mt-2 px-4 py-1.5">
        {watchlist.length === 0 ? (
          <div className="py-6 text-center text-[13px] t3">自选池为空</div>
        ) : (
          watchlist.map((w) => <Row key={w.id} w={w} onDelete={() => removeWatch(w.id)} />)
        )}
      </GlassCard>
    </div>
  );
}
