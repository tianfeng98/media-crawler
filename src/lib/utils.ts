import { ClassValue, clsx } from "clsx";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { round } from "radashi";
import { twMerge } from "tailwind-merge";

dayjs.extend(duration);

export { dayjs };

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 格式化时长
export const formatDuration = (fullMilliseconds?: number) => {
  if (typeof fullMilliseconds !== "number") {
    return "-";
  }
  const duration = dayjs.duration(fullMilliseconds, "milliseconds");

  const hours = Math.floor(duration.asHours())
    .toString()
    .padStart(2, "0");
  const minutes = duration
    .minutes()
    .toString()
    .padStart(2, "0");
  const seconds = duration
    .seconds()
    .toString()
    .padStart(2, "0");

  return [hours, minutes, seconds].join(":");
};
export interface FormatFileSizeOptions {
  fixed?: number;
  lowerCase?: boolean;
}

export const formatFileSize = (
  value: number,
  options: FormatFileSizeOptions = {}
) => {
  if (!value) {
    return "0 B";
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

export const formatPercent = (percent: number) => {
  return Math.min(100, round(percent, 2));
};
