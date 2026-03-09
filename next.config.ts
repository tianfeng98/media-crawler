import { NextConfig } from "next";
import os from "os";
import { version } from "./package.json";

function getIPAdressList() {
  const interfaces = os.networkInterfaces();
  const result: string[] = [];
  for (const devName in interfaces) {
    const iface = interfaces[devName]!;
    for (let i = 0; i < iface.length; i++) {
      let alias = iface[i];
      if (
        alias.family === "IPv4" &&
        alias.address !== "127.0.0.1" &&
        !alias.internal
      ) {
        result.push(alias.address);
      }
    }
  }
  return result;
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    APP_VERSION: version,
  },
  turbopack: {
    resolveAlias: {
      // 确保FFmpeg安装器被正确解析
      "@ffmpeg-installer/ffmpeg": "@ffmpeg-installer/ffmpeg",
      "@ffprobe-installer/ffmpeg": "@ffprobe-installer/ffprobe",
    },
    rules: {
      // 处理.node文件
      "*.node": {
        loaders: ["file-loader"],
        as: "*.js",
      },
    },
  },
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
    "fluent-ffmpeg",
  ],
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...getIPAdressList().map((ip) => ip),
  ],
};

export default nextConfig;
