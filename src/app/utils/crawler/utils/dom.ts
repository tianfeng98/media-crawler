/**
 * 清理配置接口
 */
export interface CleanBodyConfig {
  closeTags?: string[];
  openTags?: string[]; // 需要移除的标签（连同内容一起移除）
  whitelistTags?: string[]; // 白名单标签（不会被移除，即使在 removeTags 中）
}

export const getPageTitleInDom = () => {
  /**
   * 数据清洗
   * 移除注释，移除以下标签，移除所有标签中的onclick事件、style属性、class属性、data-*属性、文本中间的间隔
   */
  const openTags = ["noscript", "img"];
  const closeTags = [
    "script",
    "style",
    "svg",
    "form",
    "ul",
    "li",
    "nav",
    "button",
    "uni-image",
    "uni-swiper-item",
    "uni-modal",
    "uni-tabbar",
    "uni-actionsheet",
  ];
  const whitelistTags = [
    // 视频相关标签
    "video",
    "audio",
    "source",
    "track",
    // 媒体相关标签
    "iframe",
    "embed",
    "object",
    "param",
    // 可能还需要保留的图片标签（如果业务需要）
    // "img",
    // "picture",
  ];
  /**
   * 清理 body 内容，使用DOM
   * @param config - 清理配置
   * @returns 清理后的 body 克隆
   */
  function cleanBodyWithDom(config: CleanBodyConfig): string {
    const { openTags = [], closeTags = [], whitelistTags = [] } = config;

    const removeTags = [...openTags, ...closeTags];

    // 克隆整个 body
    const bodyClone = document.body.cloneNode(true) as HTMLBodyElement;

    /**
     * 检查标签是否在白名单中
     */
    function isWhitelisted(tagName: string): boolean {
      return whitelistTags.includes(tagName.toLowerCase());
    }

    /**
     * 移除注释节点
     */
    function removeComments(node: Node): void {
      const childNodes = Array.from(node.childNodes);

      for (let child of childNodes) {
        if (child.nodeType === Node.COMMENT_NODE) {
          // 移除注释节点
          child.parentNode?.removeChild(child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          // 递归处理子节点
          removeComments(child);
        }
      }
    }

    /**
     * 移除指定标签（连同内容），但跳过白名单标签
     */
    function removeSpecifiedTags(node: Node): void {
      const childNodes = Array.from(node.childNodes);

      for (let child of childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as Element;
          const tagName = element.tagName.toLowerCase();

          // 检查是否在白名单中
          if (isWhitelisted(tagName)) {
            // 白名单标签，跳过不删除，但继续处理其子节点
            removeSpecifiedTags(element);
          } else if (removeTags.includes(tagName)) {
            // 移除整个元素及其内容
            element.parentNode?.removeChild(element);
          } else {
            // 递归处理子节点
            removeSpecifiedTags(element);
          }
        }
      }
    }

    /**
     * 清理元素属性，但跳过白名单标签
     */
    function cleanAttributes(node: Node): void {
      const childNodes = Array.from(node.childNodes);

      for (let child of childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as Element;
          const tagName = element.tagName.toLowerCase();

          // 白名单标签不清理属性
          if (!isWhitelisted(tagName)) {
            // 移除 onclick 事件
            element.removeAttribute("onclick");

            // 移除 style 属性
            element.removeAttribute("style");

            // 移除 class 属性
            element.removeAttribute("class");

            // 移除所有 data-* 属性
            const attributes = Array.from(element.attributes);
            for (let attr of attributes) {
              if (attr.name.startsWith("data-")) {
                element.removeAttribute(attr.name);
              }
            }
          }

          // 递归处理子节点
          cleanAttributes(element);
        }
      }
    }

    /**
     * 移除文本中间的空白间隔
     */
    function normalizeTextContent(node: Node): void {
      const childNodes = Array.from(node.childNodes);

      for (let child of childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          // 将多个连续空白字符替换为单个空格
          if (child.textContent) {
            child.textContent = child.textContent.replace(/\s+/g, " ");
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          // 递归处理子节点
          normalizeTextContent(child);
        }
      }
    }

    /**
     * 检查节点是否直接包含文本内容
     */
    function hasDirectTextContent(node: Node): boolean {
      for (let child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim();
          if (text && text.length > 0) {
            return true;
          }
        }
      }
      return false;
    }

    /**
     * 移除无意义的空标签，但跳过白名单标签
     */
    function removeEmptyTags(node: Node): void {
      const childNodes = Array.from(node.childNodes);

      for (let child of childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as Element;
          const tagName = element.tagName.toLowerCase();

          // 先递归处理子节点
          removeEmptyTags(element);

          // 白名单标签不移除，即使是空的
          if (!isWhitelisted(tagName)) {
            // 检查该元素是否直接包含文本内容
            if (!hasDirectTextContent(element)) {
              // 没有直接文本内容，用其子节点替换该元素
              const parent = element.parentNode;
              if (parent) {
                // 将该元素的所有子节点移到该元素的位置
                const fragment = document.createDocumentFragment();
                while (element.firstChild) {
                  fragment.appendChild(element.firstChild);
                }
                parent.replaceChild(fragment, element);
              }
            }
          }
        }
      }
    }

    // 执行清理步骤
    removeComments(bodyClone); // 1. 移除注释
    removeSpecifiedTags(bodyClone); // 2. 移除指定标签（连同内容），跳过白名单
    cleanAttributes(bodyClone); // 3. 清理属性，跳过白名单
    normalizeTextContent(bodyClone); // 4. 规范化文本内容
    removeEmptyTags(bodyClone); // 5. 移除无意义的空标签，跳过白名单

    return bodyClone.innerHTML.replace(/\s+/g, " ");
  }

  /**
   * @deprecated 请使用 cleanBodyWithDom 代替
   * 清理 body 内容，使用正则表达式
   * @param config - 清理配置
   * @returns 清理后的 body 克隆
   */
  //   function cleanBodyWithReg(config: CleanBodyConfig): string {
  //     const { openTags = [], closeTags = [] } = config;
  //     const openTagsStr = openTags.map((tag) => `<${tag}[^>]*>`).join("|");
  //     const closeTagsStr = closeTags
  //       .map((tag) => `<${tag}[^>]*>.*?<\/${tag}>`)
  //       .join("|");
  //     const regStr = `(<!--.*?-->|${closeTagsStr}|${openTagsStr}|(<[^>]*?)\\s+(onclick|style|class|data-[^\\s=]+)[^>]*?(\\s*?>)|\\s+)`;
  //     const reg = new RegExp(regStr, "gs");
  //     return (
  //       document
  //         .querySelector("body")
  //         ?.innerHTML?.replace(reg, (match, p1, p2, p3, p4) => {
  //           if (p1) {
  //             // 注释、script、style、img 标签，直接移除
  //             return "";
  //           } else if (p2 && p3) {
  //             // 移除标签内的属性，保留标签和其他属性
  //             return `${p2}${p4}`;
  //           } else {
  //             // 多个空格替换为单个空格
  //             return " ";
  //           }
  //         })
  //         .trim() || ""
  //     );
  //   }
  return cleanBodyWithDom({ openTags, closeTags, whitelistTags });
};
