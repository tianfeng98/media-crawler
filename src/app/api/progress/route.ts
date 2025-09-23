import { logger } from "@/app/utils/logger";
import { getTaskStatus } from "@/app/utils/task-manager";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("id");

  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    const taskStatus = getTaskStatus(taskId);
    if (!taskStatus) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(taskStatus);
  } catch (error) {
    logger.error([`获取任务进度失败: ${taskId}`, error]);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
