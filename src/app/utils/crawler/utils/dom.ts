export interface CleanBodyConfig {
  closeTags?: string[];
  openTags?: string[];
  whitelistTags?: string[];
}

export const getPageTitleInDom = () => {
  /**
   * lv 表示标签清除优先级，数字越大优先级越高，先清除的标签优先级越高
   */
  // lv1
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
  // lv2
  const whitelistTags = [
    "video",
    "audio",
    "source",
    "track",
    "embed",
    "object",
    "param",
  ];
  // lv3
  // 父标签包含指定的子孙标签时，需要整个删除
  const parentChildrenTagsMap: Record<string, string[]> = {
    a: ["img"],
  };
  // class中包含指定的类名时，需要整个删除父标签
  const invalidClassNameReg: RegExp[] = [/nav/, /menu/, /list/];

  function cleanBodyWithDom(config: CleanBodyConfig): string {
    const { openTags = [], closeTags = [], whitelistTags = [] } = config;
    const removeTagsSet = new Set(
      [...openTags, ...closeTags].map((t) => t.toLowerCase()),
    );
    const whitelistSet = new Set(whitelistTags.map((t) => t.toLowerCase()));

    // 克隆 body
    const bodyClone = document.body.cloneNode(true) as HTMLBodyElement;

    /**
     * 核心递归清理函数（一次遍历）
     */
    function processNode(node: Node): void {
      const childNodes = Array.from(node.childNodes);

      for (const child of childNodes) {
        // 1. 处理注释节点
        if (child.nodeType === Node.COMMENT_NODE) {
          node.removeChild(child);
          continue;
        }

        // 2. 处理文本节点
        if (child.nodeType === Node.TEXT_NODE) {
          if (child.textContent) {
            // 规范化空白字符
            child.textContent = child.textContent.replace(/\s+/g, " ");
          }
          continue;
        }

        // 3. 处理元素节点
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as HTMLElement;
          const tagName = element.tagName.toLowerCase();
          const isWhitelisted = whitelistSet.has(tagName);

          // 检查是否需要删除父标签
          if (parentChildrenTagsMap[tagName]) {
            if (
              parentChildrenTagsMap[tagName].some((childTag) =>
                element.querySelector(childTag),
              )
            ) {
              node.removeChild(element);
              continue;
            }
          }
          if (
            invalidClassNameReg.some((reg) => reg.test(element.className || ""))
          ) {
            node.removeChild(element);
            continue;
          }

          // 检查是否需要直接移除整个标签及其内容
          // 注意：computedStyleMap 在克隆的、未挂载到 DOM 的节点上可能无法正常工作
          // 如果需要处理 display: none，建议在克隆前处理或检查 inline style
          const isHidden = element.style.display === "none";

          if (!isWhitelisted && (removeTagsSet.has(tagName) || isHidden)) {
            node.removeChild(element);
            continue;
          }

          // 清理属性 (非白名单标签)
          if (!isWhitelisted) {
            element.removeAttribute("onclick");
            element.removeAttribute("style");
            // 如果class中包含video title等相似概念的含义，不移除该class的相关内容
            if (
              element.className?.includes("video-") ||
              element.className?.includes("title")
            ) {
              element.classList.forEach((c) => {
                if (!c.includes("video-") && !c.includes("title")) {
                  element.classList.remove(c);
                }
              });
            } else {
              element.removeAttribute("class");
            }

            // 移除 data-* 属性
            const attrs = Array.from(element.attributes);
            for (const attr of attrs) {
              if (attr.name.startsWith("data-")) {
                element.removeAttribute(attr.name);
              }
            }
          }

          // 递归处理子节点
          processNode(element);

          // 移除无意义的空标签（回溯阶段处理）
          // 如果不是白名单，且没有直接文本内容，则将其子节点提升，移除自身
          if (!isWhitelisted && !hasDirectTextContent(element)) {
            const fragment = document.createDocumentFragment();
            while (element.firstChild) {
              fragment.appendChild(element.firstChild);
            }
            node.replaceChild(fragment, element);
          }
        }
      }
    }

    /**
     * 检查节点是否直接包含有效文本
     */
    function hasDirectTextContent(node: Node): boolean {
      return Array.from(node.childNodes).some(
        (child) =>
          child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
    }

    // 执行单次递归清理
    processNode(bodyClone);

    return bodyClone.innerHTML.replace(/\s+/g, " ").trim();
  }

  return cleanBodyWithDom({ openTags, closeTags, whitelistTags });
};
