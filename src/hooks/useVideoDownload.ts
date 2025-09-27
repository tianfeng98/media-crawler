"use client";

import {
  TaskStatus,
  TaskStatusEnum,
  TaskStepEnum,
  VideoInfo,
} from "@/lib/types";
import { useMemoizedFn } from "ahooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStep } from "./useStep";

export function useVideoDownload() {
  const { steps, isProcessing, currentStep, initSteps, updateStep } = useStep();
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTaskId = useRef<string | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // 创建下载任务
  const createDownloadTask = async (
    url: string,
    fileName?: string
  ): Promise<string> => {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, fileName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create download task");
    }

    const result = await response.json();
    return result.taskId;
  };

  // 获取任务进度
  const getTaskProgress = async (taskId: string): Promise<TaskStatus> => {
    const response = await fetch(`/api/progress?id=${taskId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get task progress");
    }

    return await response.json();
  };

  // 开始进度轮询
  const startProgressPolling = useCallback(
    async (taskId: string) => {
      try {
        const taskStatus = await getTaskProgress(taskId);

        if (!taskStatus) {
          return;
        }

        const {
          progress: { step, percent },
          status,
          videoInfo,
        } = taskStatus;

        // 更新步骤状态
        updateStep(step, {
          status,
          progress: percent,
        });

        // 任务完成或错误时停止轮询
        switch (status) {
          case TaskStatusEnum.Completed:
            setVideoInfo(videoInfo);
            return;
          case TaskStatusEnum.Error:
            return;
          default:
            break;
        }

        setTimeout(() => {
          startProgressPolling(taskId);
        }, 1000);
      } catch (error) {
        console.error("获取任务进度失败:", error);
      }
    },
    [updateStep]
  );

  // 停止进度轮询
  const stopProgressPolling = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, []);

  const init = useMemoizedFn(() => {
    initSteps();
    setVideoInfo(null);
    setError(null);
  });

  // 开始下载流程
  const startDownload = useMemoizedFn(async (url: string) => {
    if (isProcessing) return;

    init();

    try {
      // 步骤1：提取视频信息
      updateStep(TaskStepEnum.Extract, {
        status: TaskStatusEnum.Processing,
      });

      // 创建下载任务
      const taskId = await createDownloadTask(url);
      currentTaskId.current = taskId;

      // 开始进度轮询
      startProgressPolling(taskId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      setError(errorMessage);

      // 标记当前步骤为错误
      updateStep(TaskStepEnum.Extract, {
        status: TaskStatusEnum.Error,
      });
    }
  });

  // 重置状态
  const reset = useMemoizedFn(() => {
    stopProgressPolling();
    currentTaskId.current = null;
    init();
  });

  // 清理函数
  useEffect(() => {
    return () => {
      stopProgressPolling();
    };
  }, [stopProgressPolling]);

  return {
    steps,
    isProcessing,
    videoInfo,
    error,
    currentStep,
    startDownload,
    reset,
  };
}
