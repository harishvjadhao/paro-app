/** Minimal markdown → React nodes (bold, italic, code, lists, paragraphs). */

import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(
        createElement("strong", { key: `${keyBase}-b${i}` }, token.slice(2, -2)),
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        createElement("em", { key: `${keyBase}-i${i}` }, token.slice(1, -1)),
      );
    } else {
      nodes.push(
        createElement("code", { key: `${keyBase}-c${i}` }, token.slice(1, -1)),
      );
    }
    last = m.index + token.length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdown(md: string): ReactNode {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  let bi = 0;

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      createElement(
        "ul",
        { key: `ul-${bi++}`, className: "md-ul" },
        list.map((item, idx) =>
          createElement("li", { key: idx }, ...inline(item, `li-${bi}-${idx}`)),
        ),
      ),
    );
    list = [];
  };

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ");
    blocks.push(
      createElement(
        "p",
        { key: `p-${bi++}`, className: "md-p" },
        ...inline(text, `p-${bi}`),
      ),
    );
    para = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1]);
      continue;
    }
    if (!line.trim()) {
      flushList();
      flushPara();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushList();
  flushPara();

  return createElement(Fragment, null, ...blocks);
}

/** Pull likely stock tickers (2–12 uppercase letters) from AI text. */
export function extractSymbols(text: string, allowed: Set<string>): string[] {
  const found = new Set<string>();
  const re = /\b([A-Z]{2,12})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (allowed.has(m[1])) found.add(m[1]);
  }
  return [...found];
}
