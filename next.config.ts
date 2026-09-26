import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开发环境允许通过 127.0.0.1 / 局域网 IP 访问预览
  allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0", "172.30.0.2"],
};

export default nextConfig;
