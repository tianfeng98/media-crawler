import { DownloadItem } from "@/lib/types";
import { M3uParser, type M3uPlaylist } from "m3u-parser-generator";
import { basename, resolve } from "path-browserify";
import { deepClone } from "../common";
import { M3uKey } from "./M3uKey";
import { M3uLabel } from "./types";

const generateLocalM3u8FileContent = (playlist: M3uPlaylist) => {
  // 生成本地m3u8文件
  for (let i = 0, len = playlist.medias.length; i < len; i += 1) {
    const uri = playlist.medias[i]!.location;
    if (uri.startsWith("http")) {
      const urlObj = new URL(uri);
      playlist.medias[i]!.location = basename(urlObj.pathname);
    } else {
      playlist.medias[i]!.location = basename(uri);
    }
  }
  const keyIndex = playlist.customData.findIndex(
    (d) => d.directive === M3uLabel.KEY
  );
  if (keyIndex > -1) {
    const m3uKey = new M3uKey(playlist.customData[keyIndex]!.value);
    if (m3uKey.uri) {
      if (m3uKey.uri.startsWith("http")) {
        const urlObj = new URL(m3uKey.uri);
        m3uKey.uri = basename(urlObj.pathname);
      } else {
        m3uKey.uri = basename(m3uKey.uri);
      }
      playlist.customData[keyIndex]!.value = m3uKey.toString();
    }
  }
  let localM3u8FileContent = playlist.getM3uString();
  if (!localM3u8FileContent.includes(M3uLabel.ENDLIST)) {
    localM3u8FileContent += `\n${M3uLabel.ENDLIST}`;
  }
  return localM3u8FileContent;
};



const generateDownloadItem = (
  m3u8Url: string,
  itemUri: string,
  type: "key" | "media"
): DownloadItem => {
  let input = itemUri;
  let filename = itemUri;
  if (itemUri.startsWith("http")) {
    const urlObj = new URL(itemUri);
    filename = basename(urlObj.pathname);
  } else {
    filename = basename(itemUri);
    const urlObj = new URL(m3u8Url);
    urlObj.pathname = resolve(urlObj.pathname, "..", itemUri);
    input = urlObj.toString();
  }
  return {
    input,
    filename,
    type
  };
};

interface ParseM3u8Result {
  downloadItems: DownloadItem[];
  localM3u8FileContent: string;
  keyDownloadItem?: DownloadItem;
  error?: string;
}

export const parseM3u8 = (
  m3u8Url: string,
  m3u8Content: string
): ParseM3u8Result => {
  let keyDownloadItem: DownloadItem | undefined = void 0;
  if (!m3u8Content!.trim().startsWith("#EXT")) {
    return { downloadItems: [], localM3u8FileContent: "", error: "非m3u8文件" };
  }
  const downloadItems: DownloadItem[] = [];
  let localM3u8FileContent = m3u8Content;
  if (m3u8Content) {
    const parser = new M3uParser({
      customDataMapping: {
        playlist: [
          M3uLabel.KEY,
          M3uLabel.TARGETDURATION,
          M3uLabel.MEDIA_SEQUENCE,
          M3uLabel.PLAYLIST_TYPE,
        ],
      },
    });

    const playlist = parser.parse(m3u8Content);
    const mediaList = deepClone(playlist.medias);

    const keyIndex = playlist.customData.findIndex(
      (d) => d.directive === M3uLabel.KEY
    );
    if (keyIndex > -1) {
      const m3uKey = new M3uKey(playlist.customData[keyIndex]!.value);
      if (m3uKey.uri) {
        keyDownloadItem = generateDownloadItem(m3u8Url, m3uKey.uri, "key");
      }
    }
    for (let i = 0, len = mediaList.length; i < len; i += 1) {
      const media = mediaList[i]!;
      if (media.location) {
        downloadItems.push(generateDownloadItem(m3u8Url, media.location, "media"));
      }
    }

    localM3u8FileContent = generateLocalM3u8FileContent(playlist);
  }
  return { downloadItems, localM3u8FileContent, keyDownloadItem };
};
