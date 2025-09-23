import { basename } from "path-browserify";

export class M3uKey {
  /**
   * The URI of the key.
   */
  uri?: string;
  /**
   * The method of the key.
   */
  method?: string;
  /**
   * The IV of the key.
   */
  iv?: string;
  /**
   * The format of the key.
   */
  KEYFORMAT?: string;
  KEYFORMATVERSIONS?: string;
  constructor(str?: string) {
    str?.split(",").forEach((item) => {
      if (item.startsWith("METHOD=")) {
        this.method = item.slice(7);
      } else if (item.startsWith("URI=")) {
        this.uri = JSON.parse(item.slice(4));
      } else if (item.startsWith("IV=")) {
        this.iv = item.slice(3);
      } else if (item.startsWith("KEYFORMAT=")) {
        this.KEYFORMAT = item.slice(9);
      } else if (item.startsWith("KEYFORMATVERSIONS=")) {
        this.KEYFORMATVERSIONS = item.slice(17);
      }
    });
  }

  private convertToString(
    method?: string,
    uri?: string,
    iv?: string,
    KEYFORMAT?: string,
    KEYFORMATVERSIONS?: string
  ) {
    return [
      ["METHOD", method],
      ["URI", uri ? JSON.stringify(uri) : undefined],
      ["IV", iv],
      ["KEYFORMAT", KEYFORMAT],
      ["KEYFORMATVERSIONS", KEYFORMATVERSIONS],
    ]
      .filter((d) => !!d[1])
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
  }

  toString() {
    return this.convertToString(
      this.method,
      this.uri,
      this.iv,
      this.KEYFORMAT,
      this.KEYFORMATVERSIONS
    );
  }
  toLocalString() {
    let uri = this.uri;
    if (uri) {
      uri = basename(uri);
    }
    return this.convertToString(
      this.method,
      uri,
      this.iv,
      this.KEYFORMAT,
      this.KEYFORMATVERSIONS
    );
  }
}
