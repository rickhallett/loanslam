export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function inlineMarkdown(text: string): string {
  const codes: string[] = [];
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, (_, span: string) => {
      codes.push(`<code>${span}</code>`);
      return `\u0000${codes.length - 1}\u0000`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\u0000(\d+)\u0000/g, (_, index: string) => codes[Number(index)] ?? "");
}

interface ListNode {
  type: "ul" | "ol";
  items: Array<{
    text: string;
    children?: ListNode;
  }>;
}

export function renderMarkdown(source: string): string {
  const lines = source.split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: ListNode | null = null;
  let sawFirstH1 = false;
  let i = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const renderList = (node: ListNode): string =>
    `<${node.type}>${node.items
      .map((item) => {
        const child = item.children ? renderList(item.children) : "";
        return `<li>${inlineMarkdown(item.text)}${child}</li>`;
      })
      .join("")}</${node.type}>`;

  const flushList = () => {
    if (list) {
      html.push(renderList(list));
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (/^```/.test(line)) {
      flushParagraph();
      flushList();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i] ?? "")) {
        code.push(lines[i] ?? "");
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^\|/.test(line.trim())) {
      flushParagraph();
      flushList();
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test((lines[i] ?? "").trim())) {
        rows.push(
          (lines[i] ?? "")
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((cell) => cell.trim()),
        );
        i += 1;
      }
      const isSeparator = (row: string[]) =>
        row.every((cell) => /^:?-{3,}:?$/.test(cell));
      let body = rows;
      let head = "";
      if (rows.length > 1 && isSeparator(rows[1] ?? [])) {
        head = `<thead><tr>${(rows[0] ?? [])
          .map((cell) => `<th>${inlineMarkdown(cell)}</th>`)
          .join("")}</tr></thead>`;
        body = rows.slice(2);
      }
      const bodyHtml = body
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`,
        )
        .join("");
      html.push(`<table>${head}<tbody>${bodyHtml}</tbody></table>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]?.length ?? 1;
      if (level === 1 && !sawFirstH1) {
        sawFirstH1 = true;
      } else {
        html.push(`<h${level}>${inlineMarkdown(heading[2] ?? "")}</h${level}>`);
      }
      i += 1;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      flushParagraph();
      flushList();
      html.push("<hr>");
      i += 1;
      continue;
    }

    const topItem = line.match(/^([-*]|\d+\.)\s+(.*)$/);
    const nestedItem = line.match(/^\s{2,}([-*]|\d+\.)\s+(.*)$/);
    if (topItem || nestedItem) {
      flushParagraph();
      const match = topItem ?? nestedItem;
      const marker = match?.[1] ?? "-";
      const text = match?.[2] ?? "";
      const type = /\d+\./.test(marker) ? "ol" : "ul";
      if (topItem) {
        if (!list || list.type !== type) {
          flushList();
          list = { type, items: [] };
        }
        list.items.push({ text });
      } else if (list && list.items.length) {
        const parent = list.items[list.items.length - 1];
        if (parent) {
          parent.children ??= { type, items: [] };
          parent.children.items.push({ text });
        }
      } else {
        list = { type, items: [{ text }] };
      }
      i += 1;
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      i += 1;
      continue;
    }

    if (list && /^\s+/.test(line)) {
      const target = list.items[list.items.length - 1];
      if (target) {
        const node = target.children
          ? target.children.items[target.children.items.length - 1]
          : target;
        if (node) node.text += ` ${line.trim()}`;
      }
      i += 1;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
    i += 1;
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}
