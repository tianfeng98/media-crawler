import Keyv from "keyv";

export const mediaFileCache = new Keyv({
  namespace: "media-crawler-files",
});
