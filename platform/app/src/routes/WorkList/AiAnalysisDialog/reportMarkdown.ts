/**
 * Minimal, escape-first markdown renderer for the narrative report text.
 *
 * The report is model-generated, so it is escaped before any formatting is
 * applied and only a fixed set of constructs is ever emitted as HTML.
 */

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1<em>$2</em>');
}

export function renderSafeReportMarkdown(markdown: string) {
  const lines = (markdown || '').split(/\r?\n/);
  const html: string[] = [];
  let orderedOpen = false;
  let bulletOpen = false;
  let tableRows: string[][] = [];

  const closeOrdered = () => {
    if (orderedOpen) {
      html.push('</ol>');
      orderedOpen = false;
    }
  };

  const closeBullets = () => {
    if (bulletOpen) {
      html.push('</ul>');
      bulletOpen = false;
    }
  };

  const closeLists = () => {
    closeOrdered();
    closeBullets();
  };

  const flushTable = () => {
    if (!tableRows.length) {
      return;
    }

    html.push('<table>');
    tableRows.forEach((cells, index) => {
      if (index === 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()))) {
        return;
      }
      const tag = index === 0 ? 'th' : 'td';
      html.push(
        `<tr>${cells
          .map(cell => `<${tag}>${formatInlineMarkdown(cell.trim())}</${tag}>`)
          .join('')}</tr>`
      );
    });
    html.push('</table>');
    tableRows = [];
  };

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      flushTable();
      return;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeLists();
      tableRows.push(trimmed.slice(1, -1).split('|'));
      return;
    }

    flushTable();

    if (/^-{3,}$/.test(trimmed)) {
      closeLists();
      html.push('<hr />');
      return;
    }

    if (trimmed.startsWith('### ')) {
      closeLists();
      html.push(`<h4>${formatInlineMarkdown(trimmed.slice(4))}</h4>`);
      return;
    }

    if (trimmed.startsWith('## ')) {
      closeLists();
      html.push(`<h3>${formatInlineMarkdown(trimmed.slice(3))}</h3>`);
      return;
    }

    if (trimmed.startsWith('# ')) {
      closeLists();
      html.push(`<h2>${formatInlineMarkdown(trimmed.slice(2))}</h2>`);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      closeBullets();
      if (!orderedOpen) {
        html.push('<ol>');
        orderedOpen = true;
      }
      html.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      closeOrdered();
      if (!bulletOpen) {
        html.push('<ul>');
        bulletOpen = true;
      }
      html.push(`<li>${formatInlineMarkdown(bulletMatch[1])}</li>`);
      return;
    }

    closeLists();
    html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
  });

  closeLists();
  flushTable();
  return html.join('');
}

/**
 * Splits the narrative report into its `##` sections so the printed document
 * can page-break between them instead of mid-finding.
 */
export function splitReportSections(markdown: string) {
  const lines = (markdown || '').split(/\r?\n/);
  const sections: { title: string; body: string }[] = [];
  let title = '';
  let body: string[] = [];

  const flush = () => {
    const text = body.join('\n').trim();
    if (title || text) {
      sections.push({ title, body: text });
    }
    body = [];
  };

  lines.forEach(line => {
    const match = line.trim().match(/^##\s+(.*)$/);
    if (match) {
      flush();
      title = match[1];
      return;
    }
    body.push(line);
  });

  flush();
  return sections.filter(section => section.title || section.body);
}

/**
 * Removes the `[LOW PRIORITY]` finding blocks from the narrative's Findings
 * section, so the prose agrees with the tables rather than reintroducing the
 * severity the report excludes.
 *
 * Scoped deliberately narrowly: only `###` blocks inside `## Findings`, which
 * are self-contained (heading plus its own bullets). Impression and
 * Recommendations are left untouched — they are numbered summary judgements,
 * and dropping an item there would renumber a list the radiologist may be
 * citing.
 */
export function stripLowPriorityFindings(markdown: string) {
  const lines = (markdown || '').split(/\r?\n/);
  const kept: string[] = [];
  let inFindings = false;
  let skipping = false;

  lines.forEach(line => {
    const trimmed = line.trim();

    if (/^##\s+/.test(trimmed)) {
      inFindings = /^##\s+findings\b/i.test(trimmed);
      skipping = false;
      kept.push(line);
      return;
    }

    if (inFindings && /^###\s+/.test(trimmed)) {
      skipping = /\[LOW PRIORITY\]/i.test(trimmed);
      if (skipping) {
        return;
      }
    }

    if (!skipping) {
      kept.push(line);
    }
  });

  return kept.join('\n');
}
