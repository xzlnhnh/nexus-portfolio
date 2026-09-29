// ═══════════════════════════════════════════
// 行情引擎 — 腾讯 qt.gtimg.cn（HTTPS + CORS 直连）
// A股 v_sh600519 / 美股 v_usAAPL / 港股 v_hkHSI 字段布局一致:
//   [1]名称 [3]现价 [4]昨收 [5]开盘 [31]涨跌额 [32]涨跌幅% [33]最高 [34]最低
// 基金估值 — 天天基金 fundgz JSONP
// ═══════════════════════════════════════════
import type { Quote } from "@/types";

export function normalizeAStockCode(input: string): string {
  let s = (input || "").trim().toLowerCase();
  s = s.replace(/^(sh|sz|bj)/, "").replace(/\.(sh|sz|ss|bj)$/, "").replace(/\.(sh|sz|bj|ss)/, "");
  if (!/^\d{6}$/.test(s)) return "";
  if (s.startsWith("6")) return "sh" + s;
  if (s.startsWith("4") || s.startsWith("8")) return "bj" + s;
  return "sz" + s;
}

export function normalizeUSTicker(input: string): string {
  const s = (input || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(s) ? s : "";
}

export function normalizeFundCode(input: string): string {
  const s = (input || "").trim();
  return /^\d{6}$/.test(s) ? s : "";
}

/** 统一组合内代码 → 腾讯请求符号 */
export function tencentSymbol(market: "CN" | "US", code: string): string {
  return market === "US" ? "us" + code : code;
}

export function quoteKey(market: string, code: string): string {
  return market === "US" ? ("us" + code).toLowerCase() : code.toLowerCase();
}

async function fetchTencentQuotes(symbols: string[], timeoutMs = 6000): Promise<Record<string, Quote>> {
  if (!symbols.length) return {};
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const buf = await fetch(`https://qt.gtimg.cn/q=${symbols.join(",")}`, {
      signal: ctrl.signal,
    }).then((r) => r.arrayBuffer());
    let text: string;
    try {
      text = new TextDecoder("gbk").decode(buf);
    } catch {
      text = new TextDecoder("utf-8").decode(buf);
    }
    const results: Record<string, Quote> = {};
    for (const line of text.split(";")) {
      const m = line.match(/v_(\w+)="([^"]*)"/);
      if (!m) continue;
      const symbol = m[1];
      const p = m[2].split("~");
      if (p.length < 35 || p[0] === "0") continue;
      const num = (i: number) => {
        const v = parseFloat(p[i]);
        return Number.isFinite(v) ? v : null;
      };
      results[symbol.toLowerCase()] = {
        symbol,
        name: p[1] || symbol,
        price: num(3),
        prevClose: num(4),
        open: num(5),
        change: num(31),
        changePct: num(32),
        high: num(33),
        low: num(34),
        time: p[30] || undefined,
        source: "tencent",
      };
    }
    return results;
  } finally {
    clearTimeout(t);
  }
}

/** 基金净值 — 东方财富 pingzhongdata 脚本接口（script 标签加载不受 CORS 限制）
 *  定义全局 fS_name / fS_code / Data_netWorthTrend（[{x:毫秒, y:净值, equityReturn:日涨幅%}]）
 *  天天基金 fundgz 实时估值接口已下线，故采用最新净值 + 日涨跌 */
let fundQueue: Promise<unknown> = Promise.resolve();
let fundSeq = 0;

function fetchFundNavScript(code: string, timeoutMs = 5000): Promise<Quote | null> {
  const task = () =>
    new Promise<Quote | null>((resolve) => {
      const scriptId = `_nx_fund_${++fundSeq}`;
      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);
      const script = document.createElement("script");
      const cleanup = () => {
        clearTimeout(timeout);
        document.getElementById(scriptId)?.remove();
      };
      script.id = scriptId;
      script.src = `https://fund.eastmoney.com/pingzhongdata/${encodeURIComponent(code)}.js`;
      script.onload = () => {
        cleanup();
        const w = window as any;
        // 全局名固定，串行加载；校验 fS_code 防止读到上一只基金的残留数据
        const trend: { x: number; y: number; equityReturn?: number }[] | undefined = w.Data_netWorthTrend;
        if (w.fS_code !== code || !Array.isArray(trend) || !trend.length) return resolve(null);
        const last = trend[trend.length - 1];
        const prev = trend.length > 1 ? trend[trend.length - 2] : null;
        const nav = last?.y;
        const prevNav = prev?.y ?? null;
        const ret = typeof last?.equityReturn === "number" ? last.equityReturn : null;
        if (typeof nav !== "number" || !Number.isFinite(nav)) return resolve(null);
        resolve({
          symbol: code,
          name: w.fS_name || code,
          price: nav,
          prevClose: prevNav,
          open: null,
          high: null,
          low: null,
          change: prevNav !== null ? +(nav - prevNav).toFixed(4) : null,
          changePct: ret,
          time: last?.x ? new Date(last.x).toISOString().slice(0, 10) : undefined,
          source: "eastmoney-nav",
        });
      };
      script.onerror = () => {
        cleanup();
        resolve(null);
      };
      document.head.appendChild(script);
    });
  const pending = fundQueue.then(task, task) as Promise<Quote | null>;
  fundQueue = pending.catch(() => null);
  return pending;
}

/** 抓所有持仓+自选的股票/指数行情（A股+美股一次请求，基金逐个 JSONP） */
export async function fetchQuotes(params: {
  stockSymbols: string[]; // 腾讯符号列表
  fundCodes: string[];
}): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  try {
    Object.assign(out, await fetchTencentQuotes(params.stockSymbols));
  } catch (e) {
    console.warn("[行情] 腾讯接口失败", e);
  }
  for (const code of params.fundCodes) {
    try {
      const q = await fetchFundNavScript(code);
      if (q) out["fund:" + code] = q;
    } catch {
      /* 单只基金失败不影响整体 */
    }
  }
  return out;
}

/** 大盘指数带 */
export const INDEX_SYMBOLS = [
  { symbol: "sh000001", label: "上证" },
  { symbol: "sz399001", label: "深成" },
  { symbol: "sz399006", label: "创业板" },
  { symbol: "hkHSI", label: "恒生" },
  { symbol: "usIXIC", label: "纳斯达克" },
  { symbol: "usINX", label: "标普500" },
];

// ── 格式化 ────────────────────────────────
export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "--";
  return v.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "--";
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}

export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "--";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e8) return `${sign}${(a / 1e8).toFixed(2)} 亿`;
  if (a >= 1e4) return `${sign}${(a / 1e4).toFixed(2)} 万`;
  return `${sign}${a.toFixed(2)}`;
}

/** 中国市场配色方向：红涨绿跌（HTML data-market-colors="CN" 控制） */
export function trendClass(v: number | null | undefined): "up" | "down" | "" {
  if (v === null || v === undefined || !Number.isFinite(v) || v === 0) return "";
  return v > 0 ? "up" : "down";
}
