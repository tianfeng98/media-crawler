export const logger = {
  info: (message: any | any[]) => {
    const arr = Array.isArray(message) ? message : [message];
    console.debug(...arr);
  },
  debug: (message: any | any[], options?: { verbose?: boolean }) => {
    const arr = Array.isArray(message) ? message : [message];
    if (options?.verbose || process.env.LOG_LEVEL === "debug") {
      console.log(...arr);
    }
  },
  error: (message: any | any[]) => {
    const arr = Array.isArray(message) ? message : [message];
    console.error(...arr);
  },
};
