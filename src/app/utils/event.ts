import { TaskStepEnum, type VideoInfo } from "@/lib/types";
import EventEmitter from "events";

export const downloadEventEmitter = new EventEmitter<{
  progress: [id: string, { percent: number; step: TaskStepEnum; progressMessage: string }];
  success: [id: string, { videoInfo: VideoInfo; output: string; progressMessage: string }];
  error: [id: string, { error: string }];
}>();
