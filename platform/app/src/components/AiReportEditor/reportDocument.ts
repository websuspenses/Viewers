/**
 * Pure helpers for the AI report editor: AI draft → editor HTML, removing and
 * restoring one finding's block, word-level "show changes", local autosave and
 * the printable (PDF) document. No React here, so they stay cheap to call.
 */
import { renderSafeReportMarkdown } from '../../routes/WorkList/AiAnalysisDialog/reportMarkdown';
import type { AiDraftSection, StudyHeader } from './reportsApi';
import { formatStudyDate, formatTimestamp, patientRows, reportTitle } from './reportExport';

export const DEFAULT_SECTIONS = ['Clinical Indication', 'Technique', 'Findings', 'Impression', 'Recommendations'];

export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Editor HTML: one <h2> per section, the AI's markdown rendered beneath. */
export function aiDraftToHtml(sections: AiDraftSection[]) {
  return sections
    .map(section => `<h2>${escapeHtml(section.title)}</h2>${renderSafeReportMarkdown(section.markdown) || '<p><br></p>'}`)
    .join('');
}

/** Empty report with the standard sections, for a report written from scratch. */
export function emptyReportHtml() {
  return DEFAULT_SECTIONS.map(title => `<h2>${title}</h2><p><br></p>`).join('');
}

export function htmlToText(html: string) {
  if (!html) {
    return '';
  }
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  doc.querySelectorAll('p,div,li,h1,h2,h3,h4,tr').forEach(el => el.append('\n'));
  return (doc.body.textContent || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Lower-case words without "[Verify: …]" notes, priority labels or punctuation. */
export function normalizeName(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const isHeading = (el: Element | null, levels: string[]) => !!el && levels.includes(el.tagName);

/**
 * Removes the report block for one finding: the <h3> whose text names the
 * finding (the AI writes "### [HIGH PRIORITY] Name") and everything after it up
 * to the next <h2>/<h3>. Returns the removed HTML so it can be restored.
 */
export function removeFindingBlock(html: string, findingName: string) {
  const target = normalizeName(findingName);
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const heading = Array.from(doc.body.querySelectorAll('h3,h4')).find(el => {
    const text = normalizeName(el.textContent || '');
    return target && (text === target || text.includes(target) || (text.length > 8 && target.includes(text)));
  });
  if (!heading) {
    return { html, removedHtml: '', found: false };
  }
  const removed: Element[] = [heading];
  let next = heading.nextElementSibling;
  while (next && !isHeading(next, ['H1', 'H2', 'H3', 'H4'])) {
    removed.push(next);
    next = next.nextElementSibling;
  }
  const removedHtml = removed.map(el => el.outerHTML).join('');
  removed.forEach(el => el.remove());
  return { html: doc.body.innerHTML, removedHtml, found: true };
}

/** Puts a removed finding block back at the end of the Findings section. */
export function restoreFindingBlock(html: string, removedHtml: string) {
  if (!removedHtml) {
    return html;
  }
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const fragment = new DOMParser().parseFromString(`<body>${removedHtml}</body>`, 'text/html').body;
  const findingsHeading = Array.from(doc.body.querySelectorAll('h2')).find(el =>
    /^findings\b/i.test((el.textContent || '').trim())
  );
  let anchor: Element | null = null;
  if (findingsHeading) {
    anchor = findingsHeading.nextElementSibling;
    while (anchor && anchor.tagName !== 'H2') {
      anchor = anchor.nextElementSibling;
    }
  }
  Array.from(fragment.children).forEach(child => {
    const node = doc.importNode(child, true);
    if (anchor) {
      anchor.before(node);
    } else {
      doc.body.append(node);
    }
  });
  return doc.body.innerHTML;
}

const tokenize = (text: string) => text.match(/\s+|[^\s]+/g) || [];

/**
 * Word-level diff of two plain texts as HTML (<ins>/<del>). LCS over words; for
 * very long texts (beyond ~4M cell comparisons) it falls back to a block diff.
 */
export function wordDiffHtml(before: string, after: string) {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length * b.length > 4_000_000) {
    return before === after
      ? escapeHtml(after)
      : `<del>${escapeHtml(before)}</del><ins>${escapeHtml(after)}</ins>`;
  }
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i * width + j] = a[i] === b[j]
        ? lcs[(i + 1) * width + j + 1] + 1
        : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  const push = (tag: '' | 'ins' | 'del', text: string) => {
    const last = out.length ? out[out.length - 1] : '';
    const open = tag ? `<${tag}>` : '';
    if (tag && last.startsWith(open)) {
      out[out.length - 1] = last.replace(new RegExp(`</${tag}>$`), `${escapeHtml(text)}</${tag}>`);
    } else {
      out.push(tag ? `${open}${escapeHtml(text)}</${tag}>` : escapeHtml(text));
    }
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('', a[i]);
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      push('del', a[i]);
      i += 1;
    } else {
      push('ins', b[j]);
      j += 1;
    }
  }
  while (i < n) {
    push('del', a[i]);
    i += 1;
  }
  while (j < m) {
    push('ins', b[j]);
    j += 1;
  }
  return out.join('').replace(/\n/g, '<br>');
}

// ---- local autosave (per browser, never the record of truth) ----

export type LocalDraft = { html: string; baseVersion: number; basedOn: number | null; savedAt: string };
const draftKey = (studyUid: string) => `aiReportEditorDraft:${studyUid}`;

export function readLocalDraft(studyUid: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(studyUid));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(studyUid: string, draft: LocalDraft) {
  try {
    localStorage.setItem(draftKey(studyUid), JSON.stringify(draft));
  } catch {
    // storage full or blocked: the editor still works, only crash recovery is lost
  }
}

export function clearLocalDraft(studyUid: string) {
  try {
    localStorage.removeItem(draftKey(studyUid));
  } catch {
    // ignore
  }
}

// ---- printable document (PDF via the browser's print dialog) ----

/**
 * A4 report page, the same for every modality and for the Word export
 * (reportExport.ts): header with the lab's logo, lab name, generated time and
 * study date; the patient table; the title ("MRI BRAIN – REPORT"); the report;
 * a DRAFT mark on every page until the report is accepted. Calibri. The window
 * title is the file name, so "Save as PDF" proposes it.
 */
export function buildPrintableReport({
  header,
  bodyHtml,
  isDraft,
  versionLabel,
  lab,
  logoUrl,
  fileTitle,
  generatedAt = new Date(),
}: {
  header: StudyHeader | null;
  bodyHtml: string;
  isDraft: boolean;
  versionLabel: string;
  lab: string;
  logoUrl: string;
  fileTitle: string;
  generatedAt?: Date;
}) {
  const rows = patientRows(header, generatedAt);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(fileTitle)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.5 Calibri, Carlito, "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 2px solid #0a7c6c; padding-bottom: 6px; margin-bottom: 10px; }
  .head img { height: 14mm; max-width: 70mm; object-fit: contain; }
  .lab { text-align: right; }
  .lab b { display: block; font-size: 15pt; color: #0a7c6c; }
  .lab span { display: block; font-size: 9pt; color: #4b5b63; }
  table.patient { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 10pt; }
  table.patient th { background: #d9d9d9; text-align: left; width: 17%; padding: 3px 6px; border: 1px solid #bfbfbf; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.patient td { width: 33%; padding: 3px 6px; border: 1px solid #bfbfbf; }
  h1.title { text-align: center; font-size: 14pt; text-decoration: underline; margin: 12px 0 8px; }
  .draft { text-align: center; color: #c81e1e; font-weight: bold; margin: 0 0 6px; }
  .report h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: .04em; color: #0a5c51; border-bottom: 1px solid #d6e4e1; padding-bottom: 2px; margin: 16px 0 6px; page-break-after: avoid; }
  .report h3, .report h4 { font-size: 11pt; margin: 10px 0 4px; page-break-after: avoid; }
  .report p, .report li { orphans: 3; widows: 3; }
  .report table { border-collapse: collapse; width: 100%; }
  .report td, .report th { border: 1px solid #c9d3d6; padding: 4px 6px; font-size: 10pt; }
  .draft-mark { position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-28deg); font-size: 64pt; font-weight: 900; color: rgba(200, 30, 30, .10); pointer-events: none; }
  .foot { margin-top: 22px; padding-top: 6px; border-top: 1px solid #d6e4e1; font-size: 8.5pt; color: #5f6e74; }
</style></head><body>
${isDraft ? '<div class="draft-mark">DRAFT · NOT SIGNED</div>' : ''}
<div class="head">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo">` : '<span></span>'}
<div class="lab"><b>${escapeHtml(lab || 'Radiology report')}</b><span>Generated: ${escapeHtml(formatTimestamp(generatedAt))}</span>
<span>Study date: ${escapeHtml(formatStudyDate(header?.studyDate) || 'Not recorded')}</span>${versionLabel ? `<span>${escapeHtml(versionLabel)}</span>` : ''}</div></div>
<table class="patient">${rows
    .map(([l1, v1, l2, v2]) => `<tr><th>${escapeHtml(l1)}</th><td>${escapeHtml(v1)}</td><th>${escapeHtml(l2)}</th><td>${escapeHtml(v2)}</td></tr>`)
    .join('')}</table>
<h1 class="title">${escapeHtml(reportTitle(header))}</h1>
${isDraft ? '<p class="draft">DRAFT · NOT SIGNED</p>' : ''}
<div class="report">${bodyHtml}</div>
<div class="foot">${isDraft
    ? 'Draft — not signed. Prepared with AI assistance; to be verified and signed by a qualified radiologist.'
    : 'Prepared with AI assistance and verified by the reporting radiologist.'}</div>
</body></html>`;
}

/** Opens the printable report in a new window and starts printing (Save as PDF). */
export function printReport(html: string) {
  const printWindow = window.open('', '_blank', 'width=1000,height=1200');
  if (!printWindow) {
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
  return true;
}
