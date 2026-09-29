// 设置 — 涨跌配色、云端同步、数据备份/恢复、安装到主屏幕、关于
import { useRef, useState } from "react";
import { Download, Upload, Trash2, Share, Info, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { useStore } from "@/lib/store";

export function Settings() {
  const { marketColors, setMarketColors, clearAll, importData, holdings, watchlist,
    syncCfg, setSyncCfg, lastSyncAt, syncBusy, syncMsg, syncNow } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [showInstall, setShowInstall] = useState(false);

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(""), 2000);
  };

  const exportData = () => {
    const payload = JSON.stringify(
      { app: "nexus-glass", version: 1, exportedAt: new Date().toISOString(), holdings, watchlist },
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("已导出备份文件");
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    if (importData(text)) flash("导入成功");
    else flash("导入失败：文件格式不正确");
  };

  return (
    <div className="anim-in px-4 pb-32">
      <header style={{ paddingTop: "max(10px, var(--sat))" }} className="px-1 pb-4 pt-2">
        <h1 className="text-[22px] font-bold t1">设置</h1>
        <p className="text-[12px] t3">本机运行 · 无云端依赖 · 零费用</p>
      </header>

      {note && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl px-4 py-3 text-[13px]" style={{ background: "rgba(47,208,140,0.12)", color: "#7fe8bb" }}>
          <CheckCircle2 size={15} /> {note}
        </div>
      )}

      <GlassCard radius={22} className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-medium t1">涨跌配色</div>
            <div className="text-[12px] t3">中国市场习惯红涨绿跌</div>
          </div>
          <div className="flex gap-1.5">
            {(["CN", "US"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMarketColors(m)}
                className="pressable rounded-xl px-3.5 py-2 text-[13px]"
                style={{
                  background: marketColors === m ? "rgba(122,168,255,0.2)" : "rgba(255,255,255,0.05)",
                  color: marketColors === m ? "#9db9ff" : "rgba(200,212,235,0.55)",
                  fontWeight: marketColors === m ? 600 : 400,
                }}
              >
                {m === "CN" ? "红涨绿跌" : "绿涨红跌"}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <h2 className="mt-5 px-1 text-[16px] font-semibold t1">云端同步 · 免费</h2>
      <GlassCard radius={22} className="mt-2 px-4 py-4">
        <p className="mb-3 text-[12px] leading-relaxed t3">
          通过 GitHub Gist 免费同步，手机和电脑填同样的令牌与同步密码即可合并数据。
          内容用同步密码端到端加密，GitHub 也看不到明文；令牌只保存在本机。
          没有 GitHub 账号可到 github.com 免费注册，然后在 Settings → Developer settings → Personal access tokens
          创建只勾选 <b className="t2">gist</b> 权限的令牌。
        </p>
        <div className="space-y-2.5">
          <input
            className="field"
            type="password"
            placeholder="GitHub 访问令牌（仅 gist 权限）"
            value={syncCfg.token}
            onChange={(e) => setSyncCfg({ ...syncCfg, token: e.target.value.trim() })}
          />
          <input
            className="field"
            type="password"
            placeholder="同步密码（加密用，两端必须一致；留空则明文存储）"
            value={syncCfg.password}
            onChange={(e) => setSyncCfg({ ...syncCfg, password: e.target.value })}
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={() => syncNow("merge")} disabled={syncBusy} className="btn-primary pressable text-[13px]">
            {syncBusy ? "同步中…" : "立即同步"}
          </button>
          <button onClick={() => syncNow("pull")} disabled={syncBusy} className="btn-ghost pressable text-[13px]">
            只拉取云端
          </button>
          <button onClick={() => syncNow("push")} disabled={syncBusy} className="btn-ghost pressable text-[13px]">
            只上传本机
          </button>
        </div>
        {(syncMsg || lastSyncAt) && (
          <div className="mt-2.5 flex items-center justify-between rounded-xl px-3 py-2 text-[12px]" style={{ background: "rgba(255,255,255,0.05)" }}>
            <span className="t2">
              {syncMsg || (lastSyncAt ? `上次同步 ${new Date(lastSyncAt).toLocaleString("zh-CN")}` : "尚未同步")}
            </span>
            {lastSyncAt && !syncMsg && <span className="t3">自动合并 · 删除也会同步</span>}
          </div>
        )}
      </GlassCard>

      <h2 className="mt-5 px-1 text-[16px] font-semibold t1">数据备份</h2>
      <GlassCard radius={22} className="mt-2 px-4 py-4">
        <p className="mb-3 text-[12px] t3">
          数据只保存在本机浏览器。换设备或清理浏览器前，请先导出备份；旧版 Nexus 导出的 JSON 也可在此导入。
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={exportData} className="btn-ghost pressable flex items-center justify-center gap-1.5">
            <Download size={15} /> 导出备份
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost pressable flex items-center justify-center gap-1.5">
            <Upload size={15} /> 导入备份
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            onImportFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => {
            if (confirm("确定清空全部持仓和自选？建议先导出备份。")) {
              clearAll();
              flash("已清空");
            }
          }}
          className="pressable mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[14px]"
          style={{ background: "rgba(255,93,93,0.12)", color: "#ff8d8d" }}
        >
          <Trash2 size={15} /> 清空全部数据
        </button>
      </GlassCard>

      <h2 className="mt-5 px-1 text-[16px] font-semibold t1">安装到主屏幕</h2>
      <GlassCard radius={22} className="mt-2 px-4 py-4">
        <button onClick={() => setShowInstall(!showInstall)} className="pressable flex w-full items-center gap-2 text-[14px] t1">
          <Share size={15} className="accent" /> iPhone / iPad 安装指南
        </button>
        {showInstall && (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px] t2">
            <li>用 Safari 打开本页面</li>
            <li>点击底部分享按钮</li>
            <li>选择「添加到主屏幕」</li>
            <li>从主屏幕启动，即获全屏独立应用体验</li>
          </ol>
        )}
      </GlassCard>

      <h2 className="mt-5 px-1 text-[16px] font-semibold t1">关于</h2>
      <GlassCard radius={22} className="mt-2 px-4 py-4">
        <div className="flex items-start gap-2.5">
          <Info size={15} className="mt-0.5 accent" />
          <div className="text-[12px] leading-relaxed t3">
            Nexus 持仓智能 · Glass 版。行情来自腾讯财经公开接口，基金净值来自东方财富公开数据；AI 分析直连你自配的模型接口。
            本版由 CloudBase 迁移至 Kimi Work 本地运行，无需任何云端费用。所有数据仅存储在当前设备浏览器中。
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
