import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
