# 视频下载器 - Media Crawler

一个基于 Next.js 的智能视频下载器，支持从网页中提取、下载和转换视频文件。

## 功能特性

- 🎥 支持从网页中提取视频链接
- ⬇️ 自动下载视频文件
- 🔄 格式转换（HLS to MP4）
- 🌙 暗黑模式支持
- 📱 响应式设计
- 🔄 实时进度显示
- 🗂️ 文件管理和自动清理

## 环境变量配置

创建 `.env.local` 文件并配置以下环境变量：

```env
# 视频文件存储路径
DOWNLOAD_FOLDER=/tmp/media-crawler

# 文件过期时间（小时）
VIDEO_EXPIRE_HOURS=24

# 清理任务间隔（分钟）
CLEANUP_INTERVAL_MINUTES=60
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

## 技术栈

- Next.js 15.5.3
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- Playwright (视频提取)
- FFmpeg (格式转换)
- Keyv (存储管理)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
