# 视频下载器 - Media Crawler

[中文版本](README.md) | [English Version](README.en.md)

一个基于 `Next.js` 和 `Playwright` 的智能视频下载器，支持从网页中提取、下载和转换视频文件。

## 功能特性

- 🎥 支持从网页中提取视频链接
- ⬇️ 自动下载视频文件
- 🔄 格式转换（HLS to MP4）
- 📸 视频截图功能
- 🌙 暗黑模式支持
- 📱 响应式设计
- 🔄 实时进度显示
- 🗂️ 文件管理和自动清理
- 📱 支持自定义设备类型
- 📝 支持自定义视频文件名
- 🔧 断点续传

## 环境变量配置

创建 `.env.local` 文件并配置以下环境变量：

```env
# 视频文件存储路径
DOWNLOAD_FOLDER=/tmp/media-crawler

# 文件超时时间（秒）
FILE_TIMEOUT_SECONDS=43200

# 输出视频格式
VIDEO_FORMAT=mp4

# HLS 爬取并发数
CRAWLER_HLS_CONCURRENCY=10

# Redis 连接地址（可选，用于任务管理）
REDIS_URL=redis://default:123456@localhost:6379

# Playwright 配置
# Playwright 可执行文件路径（可选）
PLAYWRIGHT_EXECUTABLE_PATH=
# 是否启用无头模式（true/false，默认：true）
PLAYWRIGHT_HEADLESS=true
# 设备类型（默认：Desktop Chrome）
# 可选值：iPhone 15 Pro Max, Desktop Chrome 等
PLAYWRIGHT_DEVICE=Desktop Chrome
# Playwright 超时时间（秒）
PLAYWRIGHT_TIMEOUT_SECONDS=60
# Playwright 服务器端点（可选）
PLAYWRIGHT_SERVER_ENDPOINT=

# AI 功能配置（可选）
# OpenAI API 基础 URL
OPENAI_BASE_URL=https://openrouter.ai/api/v1
# OpenAI API 密钥
OPENAI_API_KEY=
# AI 模型名称
MODEL_NAME=qwen/qwen3-coder:free
```

## 开始使用

首先安装依赖：

```bash
pnpm install
```

然后启动开发服务器：

```bash
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## API 接口

- `POST /api/download` - 创建下载任务
- `GET /api/progress?id=` - 获取任务进度
- `GET /api/video?id=` - 获取视频文件流
- `GET /api/screenshot?id=` - 获取视频截图

## 技术栈

- Next.js 15.5.3
- React 19.1.0
- TypeScript 5.9.2
- Tailwind CSS 4.1.13
- shadcn/ui
- Playwright (视频提取)
- FFmpeg (格式转换与截图)
- Redis (存储管理)
- LLM (标题生成)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
