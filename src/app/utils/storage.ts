import { TaskStatus, VideoFileInfo, VideoInfo } from "@/lib/types";
import KeyvRedis from "@keyv/redis";
import Keyv from "keyv";
import { logger } from "./logger";

const DEFAULT_EXPIRE_SECONDS = 12 * 60 * 60;
const REDIS_URL = process.env.REDIS_URL;

const FILE_TTL =
  parseInt(process.env.FILE_TIMEOUT_SECONDS || `${DEFAULT_EXPIRE_SECONDS}`) *
  1000;

export const taskStorage = new Keyv<TaskStatus>(
  {
    store: REDIS_URL
      ? new KeyvRedis(REDIS_URL, {
          namespace: "tasks",
          keyPrefixSeparator: "->",
        })
      : undefined,
  },
  {
    namespace: "tasks",
    ttl: FILE_TTL,
  }
);

const fileStorage = new Keyv<VideoFileInfo>(
  {
    store: REDIS_URL
      ? new KeyvRedis(REDIS_URL, {
          namespace: "files",
          keyPrefixSeparator: "->",
        })
      : undefined,
  },
  {
    namespace: "files",
    ttl: FILE_TTL,
  }
);

const screenshotStorage = new Keyv<string>(
  {
    store: REDIS_URL
      ? new KeyvRedis(REDIS_URL, {
          namespace: "screenshots",
          keyPrefixSeparator: "->",
        })
      : undefined,
  },
  {
    namespace: "screenshots",
    ttl: FILE_TTL,
  }
);

/**
 * 存储视频文件信息
 * @param videoId 视频ID
 * @param filePath 文件路径
 * @param expireSeconds 过期时间（秒），默认12小时
 */
export async function storeVideoFile({
  videoId,
  filePath,
  videoInfo,
  expireSeconds = DEFAULT_EXPIRE_SECONDS,
}: {
  videoId: string;
  filePath: string;
  videoInfo: VideoInfo;
  expireSeconds?: number;
}): Promise<void> {
  const expiresAt = Date.now() + expireSeconds * 1000;
  const videoFileInfo: VideoFileInfo = {
    id: videoId,
    filePath,
    videoInfo,
    expiresAt,
  };

  await fileStorage.set(videoId, videoFileInfo, expireSeconds * 1000);
  logger.debug(`视频文件信息已存储: ${videoId} -> ${filePath}`);
}

/**
 * 获取视频文件信息
 * @param videoId 视频ID
 * @returns 视频文件信息或null
 */
export async function getVideoFile(
  videoId: string
): Promise<VideoFileInfo | null> {
  const videoFileInfo = await fileStorage.get(videoId);
  if (!videoFileInfo) {
    return null;
  }

  // 检查是否过期
  if (Date.now() > videoFileInfo.expiresAt) {
    await fileStorage.delete(videoId);
    logger.debug(`视频文件已过期，已删除: ${videoId}`, {
      verbose: true,
    });
    return null;
  }

  return videoFileInfo;
}

/**
 * 删除视频文件信息
 * @param videoId 视频ID
 */
export async function deleteVideoFile(videoId: string): Promise<void> {
  await fileStorage.delete(videoId);
  logger.debug(`视频文件信息已删除: ${videoId}`, {
    verbose: true,
  });
}

/**
 * 存储截图
 * @param videoId 视频ID
 * @param screenshot 截图
 * @param expireHours 过期时间（小时），默认24小时
 */
export async function storeScreenshot(
  videoId: string,
  screenshot: string,
  expireSeconds: number = DEFAULT_EXPIRE_SECONDS
): Promise<void> {
  await screenshotStorage.set(videoId, screenshot, expireSeconds * 1000);
  logger.debug(`截图已存储: ${videoId} -> ${screenshot}`);
}

/**
 * 获取截图
 * @param videoId 视频ID
 * @returns 截图或null
 */
export async function getScreenshot(videoId: string): Promise<string | null> {
  const screenshot = await screenshotStorage.get(videoId);
  if (!screenshot) {
    return null;
  }
  return screenshot;
}
