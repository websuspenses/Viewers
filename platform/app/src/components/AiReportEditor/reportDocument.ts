/**
 * Pure helpers for the AI report editor: AI draft → editor HTML, removing and
 * restoring one finding's block, word-level "show changes", local autosave and
 * the printable (PDF) document. No React here, so they stay cheap to call.
 */
import { renderSafeReportMarkdown } from '../../routes/WorkList/AiAnalysisDialog/reportMarkdown';
import type { AiDraftSection, StudyHeader } from './reportsApi';

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

const formatDicomDate = (value: string) =>
  /^\d{8}$/.test(value || '') ? `${value.slice(6, 8)}-${value.slice(4, 6)}-${value.slice(0, 4)}` : value || '';

/**
 * A4 report page: CIAI header, patient/study table, the report, and a DRAFT mark
 * on every page until the report is finalised (sign-off comes in §10.6).
 */
export function buildPrintableReport({
  header,
  bodyHtml,
  isDraft,
  versionLabel,
}: {
  header: StudyHeader | null;
  bodyHtml: string;
  isDraft: boolean;
  versionLabel: string;
}) {
  const rows: [string, string][] = header
    ? [
        ['Patient', header.patientName],
        ['Patient ID', header.patientId],
        ['Age / Sex', [header.patientAge, header.patientSex].filter(Boolean).join(' / ')],
        ['Study', header.description],
        ['Modality', header.modalities],
        ['Study date', formatDicomDate(header.studyDate)],
        ['Accession', header.accession],
        ['Referred by', header.referringPhysician],
      ].filter(([, value]) => value) as [string, string][]
    : [];
  const printed = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Radiology report${header?.patientName ? ` — ${escapeHtml(header.patientName)}` : ''}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.5 "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0a7c6c; padding-bottom: 6px; margin-bottom: 12px; }
  .brand { font-size: 16pt; font-weight: 800; color: #0a7c6c; letter-spacing: .02em; }
  .brand small { display: block; font-size: 9pt; font-weight: 600; color: #4b5b63; letter-spacing: 0; }
  .meta { font-size: 9pt; color: #4b5b63; text-align: right; }
  table.study { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10pt; }
  table.study th { text-align: left; width: 22%; color: #4b5b63; font-weight: 600; padding: 3px 8px 3px 0; vertical-align: top; }
  table.study td { padding: 3px 0; }
  .report h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: .04em; color: #0a5c51; border-bottom: 1px solid #d6e4e1; padding-bottom: 2px; margin: 16px 0 6px; page-break-after: avoid; }
  .report h3, .report h4 { font-size: 11pt; margin: 10px 0 4px; page-break-after: avoid; }
  .report p, .report li { orphans: 3; widows: 3; }
  .report table { border-collapse: collapse; width: 100%; }
  .report td, .report th { border: 1px solid #c9d3d6; padding: 4px 6px; font-size: 10pt; }
  .draft-mark { position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-28deg); font-size: 64pt; font-weight: 900; color: rgba(200, 30, 30, .10); pointer-events: none; }
  .foot { margin-top: 22px; padding-top: 6px; border-top: 1px solid #d6e4e1; font-size: 8.5pt; color: #5f6e74; }
</style></head><body>
${isDraft ? '<div class="draft-mark">DRAFT · NOT SIGNED</div>' : ''}
<div class="head"><div class="brand">CIAI Teleradiology<small>Radiology report</small></div>
<div class="meta">${escapeHtml(versionLabel)}<br>Printed ${escapeHtml(printed)}</div></div>
${rows.length ? `<table class="study">${rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('')}</table>` : ''}
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
