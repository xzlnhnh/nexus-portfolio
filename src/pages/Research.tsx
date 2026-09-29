// AI 研究 — 接口配置 + 持仓分析（OpenAI 兼容 Chat Completions）
import { useState } from "react";
import { Send, Sparkles, Save, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { useStore } from "@/lib/store";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const PROVIDERS = [
  { key: "deepseek", label: "DeepSeek", url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
  { key: "openai", label: "OpenAI", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  { key: "custom", label: "自定义", url: "", model: "" },
] as const;

function buildPortfolioPrompt(holdings: { name: string; market: string; code: string; shares: number; cost: number; price: number | null; changePct: number | null }[]): string {
  const lines = holdings.map((h) => {
    const pnl = h.price != null ? ((h.price - h.cost) / h.cost) * 100 : null;
    return `- ${h.name}（${h.market === "FUND" ? "基金" : h.market === "US" ? "美股" : "A股"} ${h.code}）持仓 ${h.shares}，成本 ${h.cost}，现价 ${h.price ?? "未知"}，浮动盈亏 ${pnl !== null ? pnl.toFixed(2) + "%" : "未知"}，当日 ${h.changePct !== null ? h.changePct.toFixed(2) + "%" : "未知"}`;
  });
  return `你是我的私人投资研究助理。以下是我当前的持仓明细：\n${lines.join("\n")}\n\n请从行业分布、集中度风险、近期需要关注的事件和后续操作思路四个角度给出简明分析。用中文回答，控制在 400 字以内。`;
}

export function Research() {
  const { ai, setAi, holdings, quotes } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const provider = PROVIDERS.find((p) => p.key === ai.provider)!;

  const save = () => {
    setAi({ ...ai });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    if (!ai.apiKey) {
      setErr("请先在下方配置 API KEY（仅保存在本机浏览器）");
      return;
    }
    setErr("");
    const userMsg: Msg = { role: "user", content: text.trim() };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(ai.apiUrl || provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ai.apiKey}`,
        },
        body: JSON.stringify({
          model: ai.model || provider.model,
          messages: [
            { role: "system", content: "你是 Nexus 持仓智能的内置投资研究助手，回答简明、专业、用中文。" },
            ...next,
          ],
          temperature: 0.6,
        }),
      });
      if (!res.ok) throw new Error(`接口返回 ${res.status}`);
      const data = await res.json();
      const content: string =
        data.choices?.[0]?.message?.content ?? JSON.stringify(data).slice(0, 500);
      setMsgs([...next, { role: "assistant", content }]);
    } catch (e: any) {
      setMsgs([
        ...next,
        {
          role: "assistant",
          content: `⚠️ 请求失败：${e?.message || e}。如果接口不允许浏览器跨域请求，需要通过你自己的网关或代理访问。`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const analyzePortfolio = () => {
    const rows = holdings.map((h) => {
      const key =
        h.market === "FUND" ? "fund:" + h.code : h.market === "US" ? ("us" + h.code).toLowerCase() : h.code;
      const q = quotes[key];
      return {
        name: q?.name && q.name !== h.code ? q.name : h.name,
        market: h.market,
        code: h.code,
        shares: h.shares,
        cost: h.cost,
        price: q?.price ?? null,
        changePct: q?.changePct ?? null,
      };
    });
    if (!rows.length) return setErr("暂无持仓可分析");
    send(buildPortfolioPrompt(rows));
  };

  return (
    <div className="anim-in px-4 pb-32">
      <header style={{ paddingTop: "max(10px, var(--sat))" }} className="px-1 pb-4 pt-2">
        <h1 className="text-[22px] font-bold t1">AI 研究</h1>
        <p className="text-[12px] t3">直连你配置的模型接口，密钥只存在本机</p>
      </header>

      <button onClick={analyzePortfolio} className="btn-primary pressable flex w-full items-center justify-center gap-1.5">
        <Sparkles size={16} /> 一键分析整体组合
      </button>

      {/* 对话区 */}
      <GlassCard radius={22} className="mt-3 px-4 py-3">
        {msgs.length === 0 ? (
          <div className="py-6 text-center text-[13px] t3">
            点击上方按钮分析组合，或在下方直接提问
          </div>
        ) : (
          <div className="space-y-2.5">
            {msgs.map((m, i) => (
              <div
                key={i}
                className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed"
                style={
                  m.role === "user"
                    ? { marginLeft: "auto", background: "rgba(122,168,255,0.22)", color: "#dfe8ff" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(230,238,252,0.9)" }
                }
              >
                {m.content}
              </div>
            ))}
            {busy && <div className="skeleton h-9 w-2/3" />}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input
            className="field flex-1"
            placeholder="追问一句，例如：宁德时代现在能加仓吗？"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
          />
          <button
            onClick={() => send(input)}
            className="pressable flex h-[46px] w-[46px] items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, rgba(122,168,255,0.9), rgba(150,120,255,0.9))" }}
            aria-label="发送"
          >
            <Send size={17} color="#0a0f1e" />
          </button>
        </div>
        {err && <div className="mt-2 text-[12px]" style={{ color: "#ff9d8a" }}>{err}</div>}
      </GlassCard>

      {/* 接口配置 */}
      <h2 className="mt-5 px-1 text-[16px] font-semibold t1">接口配置</h2>
      <GlassCard radius={22} className="mt-2 px-4 py-4">
        <div className="mb-3 flex gap-1.5">
          {PROVIDERS.map((p) => (
            <button
              key={p.key}
              onClick={() => setAi({ ...ai, provider: p.key, apiUrl: p.url || ai.apiUrl, model: p.model || ai.model })}
              className="pressable flex-1 rounded-xl py-2 text-[13px] transition-colors"
              style={{
                background: ai.provider === p.key ? "rgba(122,168,255,0.2)" : "rgba(255,255,255,0.05)",
                color: ai.provider === p.key ? "#9db9ff" : "rgba(200,212,235,0.55)",
                fontWeight: ai.provider === p.key ? 600 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-2.5">
          <input
            className="field tnum"
            placeholder="API URL"
            value={ai.apiUrl}
            onChange={(e) => setAi({ ...ai, apiUrl: e.target.value })}
          />
          <input
            className="field"
            placeholder="模型名"
            value={ai.model}
            onChange={(e) => setAi({ ...ai, model: e.target.value })}
          />
          <input
            className="field"
            type="password"
            placeholder="API KEY（仅本机保存，只粘贴密钥本体）"
            value={ai.apiKey}
            onChange={(e) => setAi({ ...ai, apiKey: e.target.value.trim() })}
          />
        </div>
        <button onClick={save} className="btn-ghost pressable mt-3 flex w-full items-center justify-center gap-1.5">
          {saved ? <CheckCircle2 size={15} color="#2fd08c" /> : <Save size={15} />} {saved ? "已保存" : "保存设置"}
        </button>
      </GlassCard>
    </div>
  );
}
