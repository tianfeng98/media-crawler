import { logger } from "@/app/utils/logger";
import { getScreenshot } from "@/app/utils/storage";
import { NextRequest, NextResponse } from "next/server";
import { createReadStream, stat } from "node:fs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("id");

  if (!videoId) {
    return NextResponse.json(
      { error: "Video ID is required" },
      { status: 400 }
    );
  }

  try {
    // 获取视频文件信息
    const screenshot = await getScreenshot(videoId);
    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot file not found or expired" },
        { status: 404 }
      );
    }

    // 检查文件是否存在
    const filePath = screenshot;
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
          { error: "Screenshot file not found" },
          { status: 404 }
        );
      }

      // 获取Range请求头
      const fileSize = stats.size;
      // 返回完整文件
      const fileStream = createReadStream(filePath);

      return new NextResponse(fileStream as any, {
        status: 200,
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": "image/png",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (fileError) {
      logger.error([`读取截图文件失败: ${filePath}`, fileError]);
      return NextResponse.json(
        { error: "Failed to read screenshot file" },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error([`获取截图文件失败: ${videoId}`, error]);
    return NextResponse.json(
      { error: "Failed to get screenshot file" },
      { status: 500 }
    );
  }
}
