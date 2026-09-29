// Nexus Glass — 领域模型

export type Market = "CN" | "US" | "FUND";

export interface Holding {
  id: string;
  market: "CN" | "US";
  name: string;
  code: string; // 规范代码: sh600519 / AAPL
  shares: number; // 股数
  cost: number; // 每股成本
  createdAt: number;
  updatedAt?: number; // 同步合并用，缺省时按 createdAt
}

export interface FundHolding {
  id: string;
  market: "FUND";
  name: string;
  code: string; // 6 位基金代码
  shares: number; // 持有份额
  cost: number; // 成本净值
  createdAt: number;
  updatedAt?: number;
}

export type AnyHolding = Holding | FundHolding;

export interface WatchItem {
  id: string;
  market: Market;
  name: string;
  code: string;
  createdAt: number;
  updatedAt?: number;
}

/** 统一行情快照 */
export interface Quote {
  symbol: string; // 请求符号: sh600519 / usAAPL / 000001
  name: string;
  price: number | null;
  prevClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number | null;
  changePct: number | null;
  time?: string;
  source: "tencent" | "eastmoney-nav" | "none";
}

export interface AiConfig {
  provider: "openai" | "deepseek" | "custom";
  apiUrl: string;
  model: string;
  apiKey: string; // 仅保存在本机浏览器
  webSearch: boolean;
}

export type TabKey = "overview" | "holdings" | "watchlist" | "research" | "settings";
