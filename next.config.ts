import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    APP_VERSION: version,
  },
  turbopack: {
    resolveAlias: {
      // 确保FFmpeg安装器被正确解析
      "@ffmpeg-installer/ffmpeg": "@ffmpeg-installer/ffmpeg",
    },
    rules: { 
      // 处理.node文件
      "*.node": {
        loaders: ["file-loader"],
        as: "*.js", 
      },
    },
  },
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "fluent-ffmpeg"],
};

export default nextConfig;
