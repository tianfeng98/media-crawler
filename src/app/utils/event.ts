import { TaskStepEnum, type VideoInfo } from "@/lib/types";
import EventEmitter from "events";

export const downloadEventEmitter = new EventEmitter<{
  progress: [string, { percent: number; step: TaskStepEnum; progressMessage?: string }];
  success: [string, { videoInfo: VideoInfo; output: string; screenshot: string; progressMessage?: string }];
  error: [string, { error: string, screenshot: string }];
}>();
