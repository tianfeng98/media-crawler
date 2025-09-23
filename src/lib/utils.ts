import { clsx, type ClassValue } from "clsx";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { twMerge } from "tailwind-merge";

dayjs.extend(duration);

export { dayjs };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 格式化时长
export const formatDuration = (fullSeconds?: number) => {
  if (typeof fullSeconds !== "number") {
    return "-";
  }
  const duration = dayjs.duration(fullSeconds, "seconds");

  const minutes = Math.floor(duration.asMinutes()).toString().padStart(2, "0");
  const seconds = duration.seconds().toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
};

export interface FormatFileSizeOptions {
  fixed?: number;
  lowerCase?: boolean;
}

export const formatFileSize = (
  value: number,
  options: FormatFileSizeOptions = {}
) => {
  if (value !== 0 && !value) {
    return "0";
  }
  const { fixed = 0, lowerCase } = options;
  let unitArr = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  if (lowerCase) {
    unitArr = unitArr.map((d) => d.toLocaleLowerCase());
  }
  const index = Math.floor(Math.log(value) / Math.log(1024));
  const size: number = value / 1024 ** index;
  return `${size.toFixed(fixed)} ${unitArr[index]}`;
};
