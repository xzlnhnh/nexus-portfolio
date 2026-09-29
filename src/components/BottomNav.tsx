// iOS 风格底部玻璃导航栏
import { Home, Layers, Star, FlaskConical, Settings } from "lucide-react";
import type { TabKey } from "@/types";
import { useStore } from "@/lib/store";

const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "overview", label: "总览", icon: Home },
  { key: "holdings", label: "持仓", icon: Layers },
  { key: "watchlist", label: "自选", icon: Star },
  { key: "research", label: "研究", icon: FlaskConical },
  { key: "settings", label: "设置", icon: Settings },
];

export function BottomNav() {
  const { tab, setTab } = useStore();
  return (
    <nav
      className="fixed left-3 right-3 z-40 glass"
      style={{ borderRadius: 24, bottom: "max(12px, calc(var(--sab) + 8px))" }}
    >
      <div className="flex items-stretch justify-between px-2 py-1.5">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="pressable flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 min-w-[56px] transition-colors"
              aria-label={label}
            >
              <span
                className="flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300"
                style={{
                  background: active ? "rgba(122,168,255,0.22)" : "transparent",
                  boxShadow: active ? "0 0 18px rgba(122,168,255,0.35)" : "none",
                }}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 1.8} color={active ? "#9db9ff" : "rgba(200,212,235,0.5)"} />
              </span>
              <span
                className="text-[10px] tracking-wide"
                style={{ color: active ? "#9db9ff" : "rgba(200,212,235,0.45)", fontWeight: active ? 600 : 400 }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
