import { CrawlerHLSTask } from "@/app/utils/crawler";
import { downloadEventEmitter } from "@/app/utils/event";
import { logger } from "@/app/utils/logger";
import { createTask, getTaskStatus } from "@/app/utils/task-manager";
import { TaskStatus, TaskStatusEnum, TaskStepEnum } from "@/lib/types";
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
        step: TaskStepEnum.Extract,
        percent: 0,
        message: "任务创建成功",
      },
      videoInfo: null,
      error: null,
    };

    await createTask(taskId, taskStatus);

    // 异步执行下载任务
    const crawlerTask = new CrawlerHLSTask(url, {
      taskId,
    });

    crawlerTask.start();
    crawlerTask.eventEmitter.on("progress", (id, dto) => {
      downloadEventEmitter.emit("progress", id, dto);
    });
    crawlerTask.eventEmitter.on("success", (id, data) => {
      downloadEventEmitter.emit("success", id, data);
      crawlerTask.destroy();
    });
    crawlerTask.eventEmitter.on("error", (id, error) => {
      downloadEventEmitter.emit("error", id, error);
      crawlerTask.destroy();
    });
    // downloadVideoFromWebsite(url, { fileName, taskId });

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

  const taskStatus = await getTaskStatus(taskId);

  if (!taskStatus) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(taskStatus);
}
