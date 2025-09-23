import { downloadVideoFromWebsite } from "@/app/utils/download";
import { logger } from "@/app/utils/logger";
import { createTask, getTaskStatus } from "@/app/utils/task-manager";
import { TaskStatusEnum, TaskStepEnum, type TaskStatus } from "@/lib/types";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, fileName } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const taskId = randomUUID();

    // 创建任务状态
    const taskStatus: TaskStatus = {
      taskId,
      status: TaskStatusEnum.Created,
      progress: {
        step: TaskStepEnum.Convert,
        percent: 0,
      },
      videoInfo: null,
      error: null,
    };

    createTask(taskId, taskStatus);

    // 异步执行下载任务
    downloadVideoFromWebsite(url, { fileName, taskId });

    return NextResponse.json({
      taskId,
      status: "created",
    });
  } catch (error) {
    logger.error(["创建下载任务失败", error]);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// 获取任务状态（用于调试）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("id");

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const taskStatus = getTaskStatus(taskId);

  if (!taskStatus) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(taskStatus);
}
