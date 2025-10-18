import Ffmpeg from "fluent-ffmpeg";
import { dayjs } from "./common";
import { logger } from "./logger";

const formatDurationStr = (duration: string) => {
  // 'hh:mm:ss.SSS'
  const [hh, mm, s] = duration.split(":");
  const hours = parseInt(hh, 10);
  const minutes = parseInt(mm, 10);
  const [ss, SSS] = s.split(".");
  const seconds = parseInt(ss, 10);
  const milliseconds = parseInt(SSS, 10);
  const result = dayjs.duration({
    milliseconds,
    seconds,
    minutes,
    hours,
  });
  return result.asMilliseconds();
};

export interface FFmpegProgressInfo {
  input: string;
  output: string;
  /**
   * 当前处理的媒体时长（毫秒）
   */
  currentMilliseconds: number;
  /**
   * 媒体的总时长（毫秒）
   * 如果总时长未知，则为0
   */
  totalMilliseconds: number;
}

export interface FFmpegOptions {
  userAgent?: string;
  threads?: number;
  headers?: Record<string, string>;
  verbose?: boolean;
  onProgress?: (progress: FFmpegProgressInfo) => void;
}

export const runFFmpeg = async (
  input: string,
  output: string,
  { userAgent, threads, headers, verbose, onProgress }: FFmpegOptions = {}
) => {
  // 动态导入FFmpeg安装器
  const ffmpegInstall = await import("@ffmpeg-installer/ffmpeg");
  Ffmpeg.setFfmpegPath(ffmpegInstall.path);

  return new Promise<FFmpegProgressInfo>((resolve, reject) => {
    const command = Ffmpeg();
    let totalMilliseconds = 0;

    command.input(input);

    if (userAgent) {
      command.inputOptions("-user_agent", userAgent);
    }

    if (threads) {
      command.inputOptions("-threads", threads.toString());
    }

    if (headers) {
      command.inputOptions(
        "-headers",
        Object.entries(headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("$'\r\n'")
      );
    }
    command
      .inputOptions(
        "-allowed_extensions",
        "ALL",
        "-protocol_whitelist",
        "file,http,https,tls,tcp,crypto"
      )
      .outputOptions("-c", "copy")
      .output(output)
      .on("start", function(commandLine) {
        logger.debug("Spawned FFmpeg with command: " + commandLine, {
          verbose,
        });
      })
      .on("progress", function(progress) {
        const currentMilliseconds = formatDurationStr(progress.timemark);
        if (totalMilliseconds && totalMilliseconds > 0) {
          onProgress?.({
            input,
            output,
            currentMilliseconds,
            totalMilliseconds,
          });
        }
      })
      .on("codecData", function(data) {
        totalMilliseconds = formatDurationStr(data.duration);
      })
      .on("end", function() {
        const finishInfo: FFmpegProgressInfo = {
          input,
          output,
          currentMilliseconds: totalMilliseconds,
          totalMilliseconds,
        };
        onProgress?.(finishInfo);
        resolve(finishInfo);
      })
      .on("error", function(err) {
        reject(err);
      })
      .run();
  });
};

export const runFFmpegScreenshot = async (
  input: string,
  output: string,
  { verbose }: FFmpegOptions = {}
) => {
  const ffmpegInstall = await import("@ffmpeg-installer/ffmpeg");
  Ffmpeg.setFfmpegPath(ffmpegInstall.path);
  return new Promise<FFmpegProgressInfo>((resolve, reject) => {
    const command = Ffmpeg();
    command
      .input(input)
      .outputOptions("-ss", "4.500")
      .outputOptions("-vframes", "1")
      .output(output)
      .on("start", function(commandLine) {
        logger.debug("Spawned FFmpeg with command: " + commandLine, {
          verbose,
        });
      })
      .on("end", function() {
        resolve({
          input,
          output,
          currentMilliseconds: 0,
          totalMilliseconds: 0,
        });
      })
      .on("error", function(err) {
        reject(err);
      })
      .run();
  });
};
