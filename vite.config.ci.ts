import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// CI 构建配置：与本地 vite.config.ts 相同，但不使用 Kimi Work 专属的检查插件
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
