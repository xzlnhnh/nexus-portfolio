// ═══════════════════════════════════════════
// 全局状态 — 本机持久化（localStorage），无需云端、零费用
// ═══════════════════════════════════════════
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AiConfig, AnyHolding, Quote, TabKey, WatchItem } from "@/types";
import {
  INDEX_SYMBOLS,
  fetchQuotes,
  normalizeAStockCode,
  normalizeFundCode,
  normalizeUSTicker,
  quoteKey,
  tencentSymbol,
} from "@/lib/market";

import {
  decryptEnvelope,
  encryptPayload,
  mergePayloads,
  pullEnvelope,
  pushEnvelope,
  type SyncConfig,
  type SyncPayload,
  type Tombstone,
} from "@/lib/sync";

const LS = {
  holdings: "nexus_glass_holdings_v1",
  watchlist: "nexus_glass_watchlist_v1",
  ai: "nexus_glass_ai_v1",
  seeded: "nexus_glass_seeded_v1",
  marketColors: "nexus_glass_market_colors_v1",
  tombstones: "nexus_glass_tombstones_v1",
  syncCfg: "nexus_glass_synccfg_v1",
  lastSync: "nexus_glass_lastsync_v1",
  gistId: "nexus_glass_gistid_v1",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 存储满时静默失败 */
  }
}

export const DEFAULT_AI: AiConfig = {
  provider: "deepseek",
  apiUrl: "https://api.deepseek.com/chat/completions",
  model: "deepseek-chat",
  apiKey: "",
  webSearch: false,
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** 首次进入注入演示持仓，一键可清空 */
function seedDemo(): { holdings: AnyHolding[]; watchlist: WatchItem[] } {
  const now = Date.now();
  const holdings: AnyHolding[] = [
    { id: uid(), market: "CN", name: "贵州茅台", code: "sh600519", shares: 100, cost: 1420.5, createdAt: now },
    { id: uid(), market: "CN", name: "宁德时代", code: "sz300750", shares: 200, cost: 186.3, createdAt: now },
    { id: uid(), market: "US", name: "Apple Inc.", code: "AAPL", shares: 50, cost: 189.2, createdAt: now },
    { id: uid(), market: "FUND", name: "易方达蓝筹精选混合", code: "005827", shares: 5000, cost: 1.845, createdAt: now },
  ];
  const watchlist: WatchItem[] = [
    { id: uid(), market: "CN", name: "中际旭创", code: "sz300308", createdAt: now },
    { id: uid(), market: "US", name: "NVIDIA", code: "NVDA", createdAt: now },
    { id: uid(), market: "FUND", name: "华夏国证半导体芯片ETF联接", code: "008888", createdAt: now },
  ];
  return { holdings, watchlist };
}

interface StoreCtx {
  tab: TabKey;
  setTab: (t: TabKey) => void;

  holdings: AnyHolding[];
  watchlist: WatchItem[];
  addHolding: (h: Omit<AnyHolding, "id" | "createdAt">) => void;
  removeHolding: (id: string) => void;
  addWatch: (w: Omit<WatchItem, "id" | "createdAt">) => void;
  removeWatch: (id: string) => void;
  clearAll: () => void;
  importData: (json: string) => boolean;

  syncCfg: SyncConfig;
  setSyncCfg: (c: SyncConfig) => void;
  lastSyncAt: number | null;
  syncBusy: boolean;
  syncMsg: string | null;
  syncNow: (mode: "merge" | "push" | "pull") => Promise<void>;

  quotes: Record<string, Quote>;
  quotesAt: number | null;
  quotesLoading: boolean;
  quotesError: string | null;
  refreshQuotes: () => void;

  ai: AiConfig;
  setAi: (a: AiConfig) => void;

  marketColors: "CN" | "US";
  setMarketColors: (m: "CN" | "US") => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<TabKey>("overview");

  const [holdings, setHoldings] = useState<AnyHolding[]>(() => {
    const existing = load<AnyHolding[]>(LS.holdings, []);
    if (existing.length) return existing;
    if (load<boolean>(LS.seeded, false)) return [];
    const demo = seedDemo();
    save(LS.holdings, demo.holdings);
    save(LS.watchlist, demo.watchlist);
    save(LS.seeded, true);
    return demo.holdings;
  });
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() =>
    load<WatchItem[]>(LS.watchlist, [])
  );
  const [ai, setAiState] = useState<AiConfig>(() => ({ ...DEFAULT_AI, ...load<Partial<AiConfig>>(LS.ai, {}) }));
  const [marketColors, setMarketColorsState] = useState<"CN" | "US">(() =>
    load<"CN" | "US">(LS.marketColors, "CN")
  );

  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesAt, setQuotesAt] = useState<number | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const refreshing = useRef(false);

  // ── 云端同步状态 ──
  const [tombstones, setTombstones] = useState<{ holdings: Tombstone[]; watchlist: Tombstone[] }>(() =>
    load(LS.tombstones, { holdings: [], watchlist: [] })
  );
  const [syncCfg, setSyncCfgState] = useState<SyncConfig>(() =>
    load(LS.syncCfg, { token: "", password: "" })
  );
  const [gistId, setGistId] = useState<string | null>(() => load(LS.gistId, null));
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() => load(LS.lastSync, null));
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => save(LS.holdings, holdings), [holdings]);
  useEffect(() => save(LS.watchlist, watchlist), [watchlist]);
  useEffect(() => save(LS.ai, ai), [ai]);
  useEffect(() => save(LS.tombstones, tombstones), [tombstones]);
  useEffect(() => save(LS.syncCfg, syncCfg), [syncCfg]);
  useEffect(() => save(LS.gistId, gistId), [gistId]);
  useEffect(() => {
    if (lastSyncAt) save(LS.lastSync, lastSyncAt);
  }, [lastSyncAt]);
  useEffect(() => {
    save(LS.marketColors, marketColors);
    document.documentElement.dataset.marketColors = marketColors;
  }, [marketColors]);

  const refreshQuotes = useCallback(() => {
    if (refreshing.current) return;
    refreshing.current = true;
    setQuotesLoading(true);
    setQuotesError(null);

    const stockSyms = new Set<string>();
    const fundCodes = new Set<string>();
    for (const h of holdings) {
      if (h.market === "FUND") fundCodes.add(h.code);
      else stockSyms.add(tencentSymbol(h.market, h.code));
    }
    for (const w of watchlist) {
      if (w.market === "FUND") fundCodes.add(w.code);
      else stockSyms.add(tencentSymbol(w.market, w.code));
    }
    for (const idx of INDEX_SYMBOLS) stockSyms.add(idx.symbol);

    fetchQuotes({ stockSymbols: [...stockSyms], fundCodes: [...fundCodes] })
      .then((q) => {
        setQuotes(q);
        setQuotesAt(Date.now());
        const stockOk = [...stockSyms].some((s) => q[s.toLowerCase()]);
        if (!stockOk && stockSyms.size > 0) setQuotesError("行情源未返回数据，请检查网络后重试");
      })
      .catch(() => setQuotesError("行情获取失败，请稍后重试"))
      .finally(() => {
        setQuotesLoading(false);
        refreshing.current = false;
      });
  }, [holdings, watchlist]);

  // 首次进入与数据变化后自动刷新，之后每 30 秒轮询
  useEffect(() => {
    refreshQuotes();
    const t = setInterval(refreshQuotes, 30_000);
    return () => clearInterval(t);
  }, [refreshQuotes]);

  const addHolding = useCallback((h: Omit<AnyHolding, "id" | "createdAt">) => {
    const now = Date.now();
    setHoldings((prev) => [...prev, { ...h, id: uid(), createdAt: now, updatedAt: now }]);
  }, []);
  const removeHolding = useCallback((id: string) => {
    setHoldings((prev) => prev.filter((x) => x.id !== id));
    setTombstones((prev) => ({
      ...prev,
      holdings: [...prev.holdings.filter((t) => t.id !== id), { id, at: Date.now() }],
    }));
  }, []);
  const addWatch = useCallback((w: Omit<WatchItem, "id" | "createdAt">) => {
    const now = Date.now();
    setWatchlist((prev) => [...prev, { ...w, id: uid(), createdAt: now, updatedAt: now }]);
  }, []);
  const removeWatch = useCallback((id: string) => {
    setWatchlist((prev) => prev.filter((x) => x.id !== id));
    setTombstones((prev) => ({
      ...prev,
      watchlist: [...prev.watchlist.filter((t) => t.id !== id), { id, at: Date.now() }],
    }));
  }, []);
  const clearAll = useCallback(() => {
    const now = Date.now();
    setTombstones((prev) => ({
      holdings: [...prev.holdings, ...holdings.map((h) => ({ id: h.id, at: now }))],
      watchlist: [...prev.watchlist, ...watchlist.map((w) => ({ id: w.id, at: now }))],
    }));
    setHoldings([]);
    setWatchlist([]);
  }, [holdings, watchlist]);
  const importData = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data.holdings) || !Array.isArray(data.watchlist)) return false;
      const now = Date.now();
      setHoldings(data.holdings.map((h: AnyHolding) => ({ ...h, updatedAt: h.updatedAt ?? h.createdAt ?? now })));
      setWatchlist(data.watchlist.map((w: WatchItem) => ({ ...w, updatedAt: w.updatedAt ?? w.createdAt ?? now })));
      return true;
    } catch {
      return false;
    }
  }, []);
  const setAi = useCallback((a: AiConfig) => setAiState(a), []);
  const setMarketColors = useCallback((m: "CN" | "US") => setMarketColorsState(m), []);
  const setSyncCfg = useCallback((c: SyncConfig) => {
    setSyncCfgState(c);
    if (gistId) setGistId(null); // 换了令牌就重新定位 Gist
  }, [gistId]);

  // ── 同步执行 ──
  const syncNow = useCallback(
    async (mode: "merge" | "push" | "pull") => {
      if (syncBusy) return;
      if (!syncCfg.token.trim()) {
        setSyncMsg("请先填写 GitHub 访问令牌");
        return;
      }
      setSyncBusy(true);
      setSyncMsg(null);
      try {
        const cfg: SyncConfig = { token: syncCfg.token.trim(), password: syncCfg.password };

        if (mode === "push") {
          const payload: SyncPayload = {
            version: 1,
            updatedAt: Date.now(),
            holdings,
            watchlist,
            tombstones,
          };
          const env = await encryptPayload(payload, cfg.password);
          const id = await pushEnvelope(cfg, gistId, env);
          setGistId(id);
          setLastSyncAt(Date.now());
          setSyncMsg("已上传本机数据");
          return;
        }

        const pulled = await pullEnvelope(cfg, gistId);
        if (!pulled) {
          if (mode === "pull") {
            setSyncMsg("云端暂无数据，请先在一台设备上执行「只上传本机」");
          } else {
            // 云端没有 → 直接上传本机
            const payload: SyncPayload = { version: 1, updatedAt: Date.now(), holdings, watchlist, tombstones };
            const env = await encryptPayload(payload, cfg.password);
            const id = await pushEnvelope(cfg, gistId, env);
            setGistId(id);
            setLastSyncAt(Date.now());
            setSyncMsg("首次同步：已创建云端备份");
          }
          return;
        }
        setGistId(pulled.gistId);
        const remote = await decryptEnvelope(pulled.env, cfg.password);

        if (mode === "pull") {
          const merged = mergePayloads(
            { version: 1, updatedAt: 0, holdings: [], watchlist: [], tombstones },
            remote
          );
          setHoldings(merged.holdings);
          setWatchlist(merged.watchlist);
          setTombstones(merged.tombstones);
          setLastSyncAt(Date.now());
          setSyncMsg("已用云端数据覆盖本机");
          return;
        }

        // merge：双向合并后上传结果
        const local: SyncPayload = { version: 1, updatedAt: Date.now(), holdings, watchlist, tombstones };
        const merged = mergePayloads(local, remote);
        setHoldings(merged.holdings);
        setWatchlist(merged.watchlist);
        setTombstones(merged.tombstones);
        const env = await encryptPayload(
          { version: 1, updatedAt: merged.updatedAt, holdings: merged.holdings, watchlist: merged.watchlist, tombstones: merged.tombstones },
          cfg.password
        );
        await pushEnvelope(cfg, pulled.gistId, env);
        setLastSyncAt(Date.now());
        setSyncMsg("同步完成，两端数据已合并");
      } catch (e: any) {
        setSyncMsg(`同步失败：${e?.message || e}`);
      } finally {
        setSyncBusy(false);
      }
    },
    [syncBusy, syncCfg, gistId, holdings, watchlist, tombstones]
  );

  const value = useMemo<StoreCtx>(
    () => ({
      tab, setTab,
      holdings, watchlist,
      addHolding, removeHolding, addWatch, removeWatch, clearAll, importData,
      syncCfg, setSyncCfg, lastSyncAt, syncBusy, syncMsg, syncNow,
      quotes, quotesAt, quotesLoading, quotesError, refreshQuotes,
      ai, setAi,
      marketColors, setMarketColors,
    }),
    [tab, holdings, watchlist, quotes, quotesAt, quotesLoading, quotesError, ai, marketColors,
     syncCfg, lastSyncAt, syncBusy, syncMsg,
     addHolding, removeHolding, addWatch, removeWatch, clearAll, importData, refreshQuotes,
     setAi, setMarketColors, setSyncCfg, syncNow]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/** 从行情表中取某资产的报价 */
export function useQuote(market: string, code: string): Quote | undefined {
  const { quotes } = useStore();
  const key = market === "FUND" ? "fund:" + code : quoteKey(market, code);
  return quotes[key];
}

export { normalizeAStockCode, normalizeFundCode, normalizeUSTicker };
