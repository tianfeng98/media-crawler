# Video Downloader - Media Crawler

[中文版本](README.md) | [English Version](README.en.md)

An intelligent video downloader based on `Next.js` and `Playwright`, supporting video extraction, download, and conversion from web pages.

## Features

- 🎥 Support for extracting video links from web pages
- ⬇️ Automatic video file downloading
- 🔄 Format conversion (HLS to MP4)
- 📸 Video screenshot functionality
- 🌙 Dark mode support
- 📱 Responsive design
- 🔄 Real-time progress display
- 🗂️ File management and automatic cleanup
- 📱 Support for custom device types
- 📝 Support for custom video filenames
- 🔧 Support for resuming downloads

## Environment Variables

Create a `.env.local` file and configure the following environment variables:

```env
# Video file storage path
DOWNLOAD_FOLDER=/tmp/media-crawler

# File timeout in seconds
FILE_TIMEOUT_SECONDS=43200

# Output video format
VIDEO_FORMAT=mp4

# HLS crawling concurrency
CRAWLER_HLS_CONCURRENCY=10

# Redis connection URL (optional, for task management)
REDIS_URL=redis://default:123456@localhost:6379

# Playwright configuration
# Playwright executable path (optional)
PLAYWRIGHT_EXECUTABLE_PATH=
# Whether to enable headless mode (true/false, default: true)
PLAYWRIGHT_HEADLESS=true
# Device type (default: Desktop Chrome)
# Optional values: iPhone 15 Pro Max, Desktop Chrome, etc.
PLAYWRIGHT_DEVICE=Desktop Chrome
# Playwright timeout in seconds
PLAYWRIGHT_TIMEOUT_SECONDS=60
# Playwright server endpoint (optional)
PLAYWRIGHT_SERVER_ENDPOINT=

# AI feature configuration (optional)
# OpenAI API base URL
OPENAI_BASE_URL=https://openrouter.ai/api/v1
# OpenAI API key
OPENAI_API_KEY=
# AI model name
MODEL_NAME=qwen/qwen3-coder:free
```

## Getting Started

First, install dependencies:

```bash
pnpm install
```

Then start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## API Endpoints

- `POST /api/download` - Create a download task
- `GET /api/progress?id=` - Get task progress
- `GET /api/video?id=` - Get video file stream
- `GET /api/screenshot?id=` - Get video screenshot

## Tech Stack

- Next.js 15.5.3
- React 19.1.0
- TypeScript 5.9.2
- Tailwind CSS 4.1.13
- shadcn/ui
- Playwright (video extraction)
- FFmpeg (format conversion and screenshots)
- Redis (storage management)
- LLM (title generation)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
