import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export { dayjs };

export const replaceIllegalCharsInPath = (filePath: string) => {
  // 匹配 Windows 系统中非法字符的正则表达式（包括 POSIX 系统中的 '/'）
  const illegalCharsRegex = /[\s#<>:"/\\|?*]/g;
  // 替换非法字符为下划线
  return filePath.replace(illegalCharsRegex, "_");
};

/**
 * 深拷贝
 * @param _obj
 * @param {WeakMap<object, any>} hash
 * @returns {any}
 */
export const deepClone = <T>(_obj: T, hash = new WeakMap()) => {
  const obj: any = _obj;
  if (typeof obj !== "object") {
    return obj as T;
  }
  if (hash.has(obj)) {
    return obj as T;
  }
  let res: any = null;
  const reference = [Date, RegExp, Set, WeakSet, Map, WeakMap, Error];
  if (obj instanceof Blob) {
    // 文件对象直接赋值
    res = obj;
  } else if (reference.includes(obj?.constructor)) {
    res = new obj.constructor(obj);
  } else if (Array.isArray(obj)) {
    res = [];
    obj.forEach((e, i) => {
      res[i] = deepClone(e);
    });
  } else if (typeof obj === "object" && obj !== null) {
    res = {};
    hash.set(obj, res);
    for (const key in obj) {
      if (Object.hasOwnProperty.call(obj, key)) {
        res[key] = deepClone(obj[key], hash);
      }
    }
  } else {
    res = obj;
  }
  return res as T;
};
