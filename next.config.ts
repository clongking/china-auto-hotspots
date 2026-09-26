import type { NextConfig } from "next";

/**
 * 静态模式（GitHub Pages 等无服务端环境）：
 *   NEXT_PUBLIC_STATIC_MODE=1  前端改为读取 public/data/hotspots.json
 *   NEXT_PUBLIC_BASE_PATH      站点子路径，如 /china-auto-hotspots
 * 静态导出不支持 API Route，构建时需先移除 src/app/api（见 .github/workflows/pages.yml）。
 */
const isStatic = process.env.NEXT_PUBLIC_STATIC_MODE === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // 开发环境允许通过 127.0.0.1 / 局域网 IP 访问预览
  allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0", "172.30.0.2"],
  ...(isStatic
    ? {
        output: "export",
        basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
