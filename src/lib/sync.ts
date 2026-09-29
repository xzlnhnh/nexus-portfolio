// ═══════════════════════════════════════════
// 免费云端同步 — GitHub Gist 通道
// · Gist API 完整支持浏览器 CORS，免费、无需服务器
// · 同步内容用同步密码做 AES-GCM 256 端到端加密，GitHub 也看不到明文
// · 双向合并：按 id 并集，同 id 取 updatedAt 较新者，删除通过墓碑传播
// ═══════════════════════════════════════════
import type { AnyHolding, WatchItem } from "@/types";

export interface SyncConfig {
  token: string; // GitHub PAT（仅 gist 权限即可），只存本机
  password: string; // 同步密码，AES 密钥来源，只存本机
}

export interface Tombstone {
  id: string;
  at: number;
}

export interface SyncPayload {
  version: 1;
  updatedAt: number;
  holdings: AnyHolding[];
  watchlist: WatchItem[];
  tombstones: { holdings: Tombstone[]; watchlist: Tombstone[] };
}

const GIST_DESC = "nexus-glass-sync";
const FILE_NAME = "nexus-sync.json";
const API = "https://api.github.com";

// ── 端到端加密（WebCrypto）────────────────
const te = new TextEncoder();
const td = new TextDecoder();

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** 加密：返回可 JSON 化的信封；密码为空则明文存储（不推荐） */
export async function encryptPayload(payload: SyncPayload, password: string): Promise<unknown> {
  const plain = te.encode(JSON.stringify(payload));
  if (!password) return { v: 1, plain: true, data: b64encode(plain) };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plain as BufferSource);
  return { v: 1, plain: false, salt: b64encode(salt), iv: b64encode(iv), data: b64encode(data) };
}

export async function decryptEnvelope(env: any, password: string): Promise<SyncPayload> {
  try {
    let plain: Uint8Array;
    if (env?.plain) {
      plain = b64decode(env.data);
    } else {
      if (!password) throw new Error("该备份已加密，请填写同步密码");
      const salt = b64decode(env.salt);
      const iv = b64decode(env.iv);
      const key = await deriveKey(password, salt);
      plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, b64decode(env.data) as BufferSource));
    }
    const payload = JSON.parse(td.decode(plain)) as SyncPayload;
    if (payload.version !== 1 || !Array.isArray(payload.holdings) || !Array.isArray(payload.watchlist)) {
      throw new Error("数据格式不正确");
    }
    payload.tombstones = payload.tombstones || { holdings: [], watchlist: [] };
    return payload;
  } catch (e: any) {
    if (e?.message) throw e;
    throw new Error("解密失败：同步密码不正确或数据已损坏");
  }
}

// ── Gist API ─────────────────────────────
async function gh<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) throw new Error("访问令牌无效，请检查 GitHub Token");
  if (res.status === 403) throw new Error("API 速率受限或 Token 权限不足（需要 gist 权限）");
  if (res.status === 404 && init?.method !== "PATCH") throw new Error("同步文件不存在");
  if (!res.ok) throw new Error(`GitHub API 错误 (${res.status})`);
  return res.json() as Promise<T>;
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}
interface Gist {
  id: string;
  description: string | null;
  files: Record<string, GistFile>;
}

async function findGistId(token: string): Promise<string | null> {
  const gists = await gh<Gist[]>("/gists?per_page=100", token);
  return gists.find((g) => g.description === GIST_DESC)?.id ?? null;
}

/** 从 Gist 拉取加密信封；不存在返回 null */
export async function pullEnvelope(cfg: SyncConfig, gistId: string | null): Promise<{ env: any; gistId: string } | null> {
  let id = gistId;
  if (!id) id = await findGistId(cfg.token);
  if (!id) return null;
  const gist = await gh<Gist>(`/gists/${id}`, cfg.token);
  const file = gist.files?.[FILE_NAME];
  if (!file) return { env: null, gistId: id };
  let content = file.content ?? "";
  if (file.truncated && file.raw_url) {
    const res = await fetch(file.raw_url);
    if (!res.ok) throw new Error("读取同步文件失败");
    content = await res.text();
  }
  if (!content.trim()) return { env: null, gistId: id };
  return { env: JSON.parse(content), gistId: id };
}

/** 上传加密信封；Gist 不存在则自动创建 */
export async function pushEnvelope(cfg: SyncConfig, gistId: string | null, envelope: unknown): Promise<string> {
  const content = JSON.stringify(envelope);
  let id = gistId;
  if (!id) id = await findGistId(cfg.token);
  if (id) {
    await gh(`/gists/${id}`, cfg.token, {
      method: "PATCH",
      body: JSON.stringify({ files: { [FILE_NAME]: { content } } }),
    });
    return id;
  }
  const created = await gh<Gist>("/gists", cfg.token, {
    method: "POST",
    body: JSON.stringify({
      description: GIST_DESC,
      public: false, // 密文存储；secret gist 仅知道链接者可访问
      files: { [FILE_NAME]: { content } },
    }),
  });
  return created.id;
}

// ── 双向合并 ─────────────────────────────
const TOMBSTONE_TTL = 30 * 24 * 3600 * 1000;

function freshTombstones(list: Tombstone[]): Tombstone[] {
  const cutoff = Date.now() - TOMBSTONE_TTL;
  return list.filter((t) => t.at > cutoff);
}

export interface MergeResult {
  holdings: AnyHolding[];
  watchlist: WatchItem[];
  tombstones: { holdings: Tombstone[]; watchlist: Tombstone[] };
  updatedAt: number;
}

/** 本地与远端合并：id 并集、同 id 取新、墓碑删除并集 */
export function mergePayloads(local: SyncPayload, remote: SyncPayload): MergeResult {
  const tombs = {
    holdings: freshTombstones([...(local.tombstones?.holdings || []), ...(remote.tombstones?.holdings || [])]),
    watchlist: freshTombstones([...(local.tombstones?.watchlist || []), ...(remote.tombstones?.watchlist || [])]),
  };
  const tombIds = {
    holdings: new Set(tombs.holdings.map((t) => t.id)),
    watchlist: new Set(tombs.watchlist.map((t) => t.id)),
  };

  function mergeItems<L extends { id: string; updatedAt?: number; createdAt: number }>(
    a: L[],
    b: L[],
    tomb: Set<string>
  ): L[] {
    const map = new Map<string, L>();
    for (const item of [...a, ...b]) {
      if (tomb.has(item.id)) continue;
      const prev = map.get(item.id);
      const t = item.updatedAt ?? item.createdAt;
      if (!prev || t >= (prev.updatedAt ?? prev.createdAt)) map.set(item.id, item);
    }
    return [...map.values()];
  }

  return {
    holdings: mergeItems(local.holdings, remote.holdings, tombIds.holdings),
    watchlist: mergeItems(local.watchlist, remote.watchlist, tombIds.watchlist),
    tombstones: tombs,
    updatedAt: Date.now(),
  };
}
