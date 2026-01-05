import { getVideoFile, nodeStreamToWebStream } from "@/app/utils";
import { logger } from "@/app/utils/logger";
import { VideoFileInfo } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, stat } from "node:fs";
import { basename } from "node:path";

const createCommonHeaders = (
  videoFileInfo: VideoFileInfo,
  download?: boolean | string | null
): HeadersInit => {
  let isDownload = false;
  if (typeof download === "string") {
    isDownload = download === "true";
  } else if (typeof download === "boolean") {
    isDownload = download;
  }

  // 处理包含中文字符的文件名，使用URL编码
  const encodedFileName = encodeURIComponent(
    basename(
      `${videoFileInfo.videoInfo.title}.${videoFileInfo.videoInfo.format}`
    )
  );

  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "Content-Type": `video/${videoFileInfo.videoInfo.format}`,
    "Content-Disposition": isDownload
      ? `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
      : `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
  };
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("id");
  const isDownload = searchParams.get("download");

  if (!videoId) {
    return NextResponse.json(
      { error: "Video ID is required" },
      { status: 400 }
    );
  }

  try {
    // 获取视频文件信息
    const videoFileInfo = await getVideoFile(videoId);
    if (!videoFileInfo) {
      return NextResponse.json(
        { error: "Video not found or expired" },
        { status: 404 }
      );
    }

    // 检查文件是否存在
    const filePath = videoFileInfo.filePath;
    try {
      const stats = await new Promise<import("node:fs").Stats>(
        (resolve, reject) => {
          stat(filePath, (err, stats) => {
            if (err) reject(err);
            else resolve(stats);
          });
        }
      );

      if (!stats.isFile()) {
        return NextResponse.json(
          { error: "Video file not found" },
          { status: 404 }
        );
      }

      // 获取Range请求头
      const range = request.headers.get("range");
      const fileSize = stats.size;

      const commonHeaders = createCommonHeaders(videoFileInfo, isDownload);

      if (range) {
        // 处理Range请求（断点续传）
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const fileStream = createReadStream(filePath, { start, end });

        return new NextResponse(nodeStreamToWebStream(fileStream), {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Content-Length": chunkSize.toString(),
            ...commonHeaders,
          },
        });
      } else {
        // 返回完整文件
        const nodeStream = createReadStream(filePath);

        return new NextResponse(nodeStreamToWebStream(nodeStream), {
          status: 200,
          headers: {
            "Content-Length": fileSize.toString(),
            ...commonHeaders,
          },
        });
      }
    } catch (fileError) {
      logger.error([`读取视频文件失败: ${filePath}`, fileError]);
      return NextResponse.json(
        { error: "Failed to read video file" },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error([`获取视频文件失败: ${videoId}`, error]);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 支持HEAD请求，用于获取文件信息
export async function HEAD(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("id");
  const isDownload = searchParams.get("download");
  try {
    if (!videoId) {
      return new NextResponse(null, { status: 400 });
    }

    // 获取视频文件信息
    const videoFileInfo = await getVideoFile(videoId);
    if (!videoFileInfo) {
      return new NextResponse(null, { status: 404 });
    }

    // 检查文件是否存在
    const filePath = videoFileInfo.filePath;
    try {
      const stats = await new Promise<import("node:fs").Stats>(
        (resolve, reject) => {
          stat(filePath, (err, stats) => {
            if (err) reject(err);
            else resolve(stats);
          });
        }
      );

      if (!stats.isFile()) {
        return new NextResponse(null, { status: 404 });
      }

      const commonHeaders = createCommonHeaders(videoFileInfo, isDownload);

      return new NextResponse(null, {
        status: 200,
        headers: {
          "Content-Length": stats.size.toString(),
          ...commonHeaders,
        },
      });
    } catch (fileError) {
      logger.error([`读取视频文件信息失败: ${filePath}`, fileError]);
      return new NextResponse(null, { status: 500 });
    }
  } catch (error) {
    logger.error([`获取视频文件信息失败: ${videoId}`, error]);
    return new NextResponse(null, { status: 500 });
  }
}
