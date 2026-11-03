/**
 * Report export for the AI report editor (2026-11-03): the file name, the
 * report header (logo, lab, timestamp, study date) and the Word document.
 *
 * The .docx is written here, without a library: a Word document is a zip of a
 * few XML parts, and the report is headings, paragraphs, lists and tables. A4,
 * Calibri, same structure for every modality as the printed (PDF) report.
 */
import type { StudyHeader } from './reportsApi';

// ---- names ------------------------------------------------------------------

const MODALITY_NAMES: Record<string, string> = {
  MR: 'MRI',
  CT: 'CT',
  CR: 'X-RAY',
  DX: 'X-RAY',
  DR: 'X-RAY',
  US: 'ULTRASOUND',
  MG: 'MAMMOGRAPHY',
  PT: 'PET',
  NM: 'NUCLEAR MEDICINE',
  XA: 'ANGIOGRAPHY',
  RF: 'FLUOROSCOPY',
};
// Not imaging: structured reports, presentation states, key images, other.
const NON_IMAGE_MODALITIES = new Set(['SR', 'PR', 'KO', 'OT', 'DOC', 'REG', 'SEG']);

/** "MRI BRAIN – REPORT", "CT BRAIN ROUTINE(ADULT) – REPORT", "X-RAY CHEST PA – REPORT". */
export function reportTitle(header: StudyHeader | null) {
  const modality = (header?.modalities || '')
    .split(/[/\\,]/)
    .map(value => value.trim().toUpperCase())
    .find(value => value && !NON_IMAGE_MODALITIES.has(value));
  const kind = modality ? MODALITY_NAMES[modality] || modality : '';
  // "01_Brain Routine(Adult)": the leading protocol number is not part of the name.
  const study = (header?.description || '').replace(/^\d+[_\s-]+/, '').trim().toUpperCase();
  const words = study.startsWith(kind) ? study : [kind, study].filter(Boolean).join(' ');
  return `${words || 'RADIOLOGY'} – REPORT`;
}

/** YYYYMMDD → "29-10-2026"; anything else unchanged. */
export function formatStudyDate(value?: string) {
  return /^\d{8}$/.test(value || '') ? `${value!.slice(6, 8)}-${value!.slice(4, 6)}-${value!.slice(0, 4)}` : value || '';
}

/** "03 Nov 2026, 14:05". */
export function formatTimestamp(date: Date) {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "047Y" → "47Y", "018M" → "18M"; '' when not a DICOM age. */
function formatAge(value?: string) {
  const match = /^0*(\d+)\s*([DWMY])$/i.exec((value || '').trim());
  return match ? `${match[1]}${match[2].toUpperCase()}` : '';
}

// The labs write age and sex into the patient name ("B.SRINIVASA RAO 47Y/M",
// "R. GAGAN BABU 18MONTHS/M"); then they are not added again.
const AGE_SEX_AT_END = /\b\d+\s*(?:Y|YRS?|YEARS?|M|MONTHS?|W|WEEKS?|D|DAYS?)\s*[/_\s]\s*[MFO]\s*$/i;

/** Patient name with age and sex: "B.SRINIVASA RAO 47Y/M". */
export function patientWithAgeSex(header: StudyHeader | null) {
  const name = (header?.patientName || '').replace(/\s+/g, ' ').trim();
  if (AGE_SEX_AT_END.test(name)) {
    return name;
  }
  const tail = [formatAge(header?.patientAge), (header?.patientSex || '').trim().toUpperCase().slice(0, 1)]
    .filter(Boolean)
    .join('/');
  return [name, tail].filter(Boolean).join(' ');
}

const FILE_UNSAFE = /[\\/:*?"<>|]+/g;

/**
 * Download / print file name:
 *   accepted  29102026_B.SRINIVASA RAO 47Y_M_012.pdf
 *   otherwise 29102026_DRAFT_B.SRINIVASA RAO 47Y_M_012.pdf
 * The date is the study date (today when the study has none).
 */
export function reportFileName(header: StudyHeader | null, accepted: boolean, ext: 'pdf' | 'docx') {
  const today = new Date();
  const date = /^\d{8}$/.test(header?.studyDate || '')
    ? `${header!.studyDate.slice(6, 8)}${header!.studyDate.slice(4, 6)}${header!.studyDate.slice(0, 4)}`
    : `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
  const parts = [date, accepted ? '' : 'DRAFT', patientWithAgeSex(header) || 'PATIENT', header?.patientId || '']
    .filter(Boolean)
    .map(part => part.replace(FILE_UNSAFE, '_').replace(/\s+/g, ' ').trim());
  return `${parts.join('_')}.${ext}`;
}

/** The lab's name: the worklist caches it for the session; else the study's institution. */
export function labName(header: StudyHeader | null) {
  try {
    const cached = JSON.parse(sessionStorage.getItem('userInfoData') || '{}');
    if (cached?.lab_name) {
      return String(cached.lab_name);
    }
  } catch {
    // fall through
  }
  return header?.institution || '';
}

// ---- logo -------------------------------------------------------------------

export type ReportLogo = { dataUrl: string; png: Uint8Array; width: number; height: number };

/** The lab's logo (mounted at /logo.jpg), else the CIAI logo; PNG, at most 120 px high. */
export async function loadReportLogo(urls = ['/logo.jpg', '/ohif-whitebg-logo.svg']): Promise<ReportLogo | null> {
  for (const url of urls) {
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const scale = Math.min(1, 120 / (image.naturalHeight || 120));
      const width = Math.max(1, Math.round((image.naturalWidth || 240) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || 120) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        continue;
      }
      context.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/png');
      const binary = atob(dataUrl.split(',')[1] || '');
      const png = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        png[i] = binary.charCodeAt(i);
      }
      return { dataUrl, png, width, height };
    } catch {
      // next one
    }
  }
  return null;
}

/** Rows of the patient table, two label/value pairs per row (as on the radiologists' reports). */
export function patientRows(header: StudyHeader | null, generatedAt: Date): [string, string, string, string][] {
  const ageSex = [formatAge(header?.patientAge), (header?.patientSex || '').toUpperCase()].filter(Boolean).join(' / ');
  return [
    ['Patient Name', header?.patientName || '', 'Patient ID', header?.patientId || ''],
    ['Age / Sex', ageSex, 'Study Date', formatStudyDate(header?.studyDate)],
    ['Referred By', header?.referringPhysician || '', 'Accession', header?.accession || ''],
    ['Study', header?.description || '', 'Report Date', formatTimestamp(generatedAt)],
  ];
}

// ---- zip (stored, no compression) ---------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipStored(files: { name: string; data: Uint8Array }[]) {
  const encoder = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  files.forEach(file => {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, file.data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, file.data.length, true);
    entry.setUint32(24, file.data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + file.data.length;
  });
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  parts.forEach(part => {
    out.set(part, at);
    at += part.length;
  });
  return out;
}

// ---- Word document --------------------------------------------------------------

const xml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type RunStyle = { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; vert?: 'superscript' | 'subscript'; size?: number; color?: string };

function run(text: string, style: RunStyle = {}) {
  const props = [
    style.bold ? '<w:b/>' : '',
    style.italic ? '<w:i/>' : '',
    style.strike ? '<w:strike/>' : '',
    style.color ? `<w:color w:val="${style.color}"/>` : '',
    style.size ? `<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>` : '',
    style.underline ? '<w:u w:val="single"/>' : '',
    style.vert ? `<w:vertAlign w:val="${style.vert}"/>` : '',
  ].join('');
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function paragraph(runs: string, { style, align, indent, spacingAfter, border }: {
  style?: string; align?: string; indent?: number; spacingAfter?: number; border?: boolean;
} = {}) {
  const props = [
    style ? `<w:pStyle w:val="${style}"/>` : '',
    border ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="0A7C6C"/></w:pBdr>' : '',
    spacingAfter !== undefined ? `<w:spacing w:after="${spacingAfter}"/>` : '',
    indent ? `<w:ind w:left="${indent}" w:hanging="280"/>` : '',
    align ? `<w:jc w:val="${align}"/>` : '',
  ].join('');
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${runs}</w:p>`;
}

const ALIGN: Record<string, string> = { left: 'left', center: 'center', right: 'right', justify: 'both' };

function alignOf(element: Element) {
  const value = (element.getAttribute('style') || '').match(/text-align:\s*(\w+)/i)?.[1]?.toLowerCase();
  return value ? ALIGN[value] : undefined;
}

/** Runs for the inline content of a node: bold / italic / underline / strike / super / sub, line breaks. */
function inlineRuns(node: Node, style: RunStyle = {}): string {
  let out = '';
  node.childNodes.forEach(child => {
    if (child.nodeType === 3) {
      const text = (child.textContent || '').replace(/\s+/g, ' ');
      if (text) {
        out += run(text, style);
      }
      return;
    }
    if (child.nodeType !== 1) {
      return;
    }
    const element = child as Element;
    const tag = element.tagName.toUpperCase();
    if (tag === 'BR') {
      out += '<w:r><w:br/></w:r>';
      return;
    }
    const css = element.getAttribute('style') || '';
    const next: RunStyle = {
      ...style,
      bold: style.bold || tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/i.test(css),
      italic: style.italic || tag === 'I' || tag === 'EM',
      underline: style.underline || tag === 'U' || /text-decoration:[^;]*underline/i.test(css),
      strike: style.strike || tag === 'S' || tag === 'STRIKE' || tag === 'DEL',
      vert: tag === 'SUP' ? 'superscript' : tag === 'SUB' ? 'subscript' : style.vert,
    };
    out += inlineRuns(element, next);
  });
  return out;
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'BLOCKQUOTE', 'HR', 'PRE']);

function cellXml(content: string, { width, shade }: { width?: number; shade?: string } = {}) {
  const props = [
    width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : '<w:tcW w:w="0" w:type="auto"/>',
    shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '',
  ].join('');
  const body = content || paragraph('');
  return `<w:tc><w:tcPr>${props}</w:tcPr>${body}</w:tc>`;
}

const TABLE_BORDERS = (color: string) =>
  `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(side => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${color}"/>`)
    .join('')}</w:tblBorders>`;

/** WordprocessingML blocks for the report body (the editor's HTML). */
function blocks(parent: Node, depth = 0): string {
  let out = '';
  let loose = '';
  const flushLoose = () => {
    if (loose) {
      out += paragraph(loose);
      loose = '';
    }
  };
  parent.childNodes.forEach(child => {
    if (child.nodeType === 3) {
      if ((child.textContent || '').trim()) {
        loose += run((child.textContent || '').replace(/\s+/g, ' '));
      }
      return;
    }
    if (child.nodeType !== 1) {
      return;
    }
    const element = child as Element;
    const tag = element.tagName.toUpperCase();
    if (!BLOCK_TAGS.has(tag)) {
      loose += tag === 'BR' ? '<w:r><w:br/></w:r>' : inlineRuns({ childNodes: [element] } as unknown as Node);
      return;
    }
    flushLoose();
    if (/^H[1-6]$/.test(tag)) {
      out += paragraph(inlineRuns(element), { style: tag === 'H1' || tag === 'H2' ? 'ReportHeading' : 'ReportSubheading', align: alignOf(element) });
    } else if (tag === 'UL' || tag === 'OL') {
      let number = 0;
      element.childNodes.forEach(item => {
        if (item.nodeType !== 1 || (item as Element).tagName.toUpperCase() !== 'LI') {
          return;
        }
        number += 1;
        const li = item as Element;
        const nested = Array.from(li.children).filter(c => ['UL', 'OL'].includes(c.tagName.toUpperCase()));
        const own = li.cloneNode(true) as Element;
        Array.from(own.children)
          .filter(c => ['UL', 'OL'].includes(c.tagName.toUpperCase()))
          .forEach(c => c.remove());
        const marker = tag === 'OL' ? `${number}.\t` : '•\t';
        out += paragraph(run(marker) + inlineRuns(own), { indent: 360 * (depth + 1) + 280 });
        nested.forEach(list => {
          out += blocks({ childNodes: [list] } as unknown as Node, depth + 1);
        });
      });
    } else if (tag === 'TABLE') {
      const rows = Array.from(element.querySelectorAll('tr'));
      const rowXml = rows
        .map(row => {
          const cells = Array.from(row.children).filter(c => ['TD', 'TH'].includes(c.tagName.toUpperCase()));
          return `<w:tr>${cells
            .map(cell => {
              const head = cell.tagName.toUpperCase() === 'TH';
              const content = Array.from(cell.childNodes).some(n => n.nodeType === 1 && BLOCK_TAGS.has((n as Element).tagName.toUpperCase()))
                ? blocks(cell, depth)
                : paragraph(inlineRuns(cell, { bold: head }));
              return cellXml(content, { shade: head ? 'EEF3F5' : undefined });
            })
            .join('')}</w:tr>`;
        })
        .join('');
      if (rowXml) {
        out += `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${TABLE_BORDERS('C9D3D6')}<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>${rowXml}</w:tbl>${paragraph('', { spacingAfter: 0 })}`;
      }
    } else if (tag === 'HR') {
      out += paragraph('', { border: true });
    } else if (tag === 'LI') {
      out += paragraph(run('•\t') + inlineRuns(element), { indent: 640 });
    } else if (
      tag === 'DIV' || tag === 'BLOCKQUOTE'
        ? Array.from(element.childNodes).some(n => n.nodeType === 1 && BLOCK_TAGS.has((n as Element).tagName.toUpperCase()))
        : false
    ) {
      out += blocks(element, depth);
    } else {
      out += paragraph(inlineRuns(element), { align: alignOf(element) });
    }
  });
  flushLoose();
  return out;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="ReportHeading"><w:name w:val="Report Heading"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="D6E4E1"/></w:pBdr></w:pPr>
<w:rPr><w:b/><w:caps/><w:color w:val="0A5C51"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ReportSubheading"><w:name w:val="Report Subheading"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ReportTitle"><w:name w:val="Report Title"/><w:basedOn w:val="Normal"/><w:qFormat/>
<w:pPr><w:jc w:val="center"/><w:spacing w:before="160" w:after="160"/></w:pPr><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

function logoDrawing(logo: ReportLogo) {
  // 1.4 cm high, width from the image's aspect ratio (EMU: 360000 per cm).
  const cy = 504000;
  const cx = Math.round((cy * logo.width) / logo.height);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

export type ReportDocumentOptions = {
  header: StudyHeader | null;
  bodyHtml: string;
  isDraft: boolean;
  lab: string;
  logo: ReportLogo | null;
  generatedAt: Date;
  versionLabel: string;
};

/** The report as a Word document (.docx): A4, Calibri, header, patient table, report, footer note. */
export function buildReportDocx(options: ReportDocumentOptions): Blob {
  const { header, bodyHtml, isDraft, lab, logo, generatedAt, versionLabel } = options;
  const encoder = new TextEncoder();

  // Header: logo | lab name, report timestamp, study date.
  const headRight = [
    paragraph(run(lab || 'Radiology report', { bold: true, size: 30, color: '0A7C6C' }), { align: 'right', spacingAfter: 0 }),
    paragraph(run(`Generated: ${formatTimestamp(generatedAt)}`, { size: 18, color: '4B5B63' }), { align: 'right', spacingAfter: 0 }),
    paragraph(run(`Study date: ${formatStudyDate(header?.studyDate) || 'Not recorded'}`, { size: 18, color: '4B5B63' }), {
      align: 'right',
      spacingAfter: 0,
    }),
    versionLabel ? paragraph(run(versionLabel, { size: 18, color: '4B5B63' }), { align: 'right', spacingAfter: 0 }) : '',
  ].join('');
  const headTable = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:bottom w:val="single" w:sz="12" w:space="0" w:color="0A7C6C"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4800"/><w:gridCol w:w="5292"/></w:tblGrid><w:tr>${cellXml(
    paragraph(logo ? logoDrawing(logo) : '', { spacingAfter: 60 }),
    { width: 4800 }
  )}${cellXml(headRight, { width: 5292 })}</w:tr></w:tbl>`;

  // Patient table, label cells shaded (as on the radiologists' printed reports).
  const patientTable = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${TABLE_BORDERS('BFBFBF')}</w:tblPr><w:tblGrid><w:gridCol w:w="1800"/><w:gridCol w:w="3246"/><w:gridCol w:w="1800"/><w:gridCol w:w="3246"/></w:tblGrid>${patientRows(header, generatedAt)
    .map(
      ([l1, v1, l2, v2]) =>
        `<w:tr>${cellXml(paragraph(run(l1, { bold: true }), { spacingAfter: 0 }), { width: 1800, shade: 'D9D9D9' })}${cellXml(
          paragraph(run(v1), { spacingAfter: 0 }),
          { width: 3246 }
        )}${cellXml(paragraph(run(l2, { bold: true }), { spacingAfter: 0 }), { width: 1800, shade: 'D9D9D9' })}${cellXml(
          paragraph(run(v2), { spacingAfter: 0 }),
          { width: 3246 }
        )}</w:tr>`
    )
    .join('')}</w:tbl>`;

  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${bodyHtml || ''}</body></html>`, 'text/html');
  const body = [
    headTable,
    paragraph('', { spacingAfter: 0 }),
    patientTable,
    paragraph(run(reportTitle(header)), { style: 'ReportTitle' }),
    isDraft ? paragraph(run('DRAFT · NOT SIGNED', { bold: true, color: 'C81E1E' }), { align: 'center' }) : '',
    blocks(doc.body),
    paragraph(
      run(
        isDraft
          ? 'Draft — not signed. Prepared with AI assistance; to be verified and signed by a qualified radiologist.'
          : 'Prepared with AI assistance and verified by the reporting radiologist.',
        { size: 17, color: '5F6E74', italic: true }
      ),
      { border: false }
    ),
  ].join('');
  // A4 (210 x 297 mm), margins 18 / 16 / 20 mm (1 mm = 56.7 twips).
  const section =
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="907" w:bottom="1134" w:left="907" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}${section}</w:body></w:document>`;

  const files: { name: string; data: Uint8Array }[] = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`
      ),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
      ),
    },
    {
      name: 'docProps/core.xml',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(reportTitle(header))}</dc:title><dc:creator>${xml(lab || 'CIAI Teleradiology')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${generatedAt.toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`
      ),
    },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
    { name: 'word/styles.xml', data: encoder.encode(STYLES_XML) },
    {
      name: 'word/_rels/document.xml.rels',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${
          logo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : ''
        }</Relationships>`
      ),
    },
  ];
  if (logo) {
    files.push({ name: 'word/media/logo.png', data: logo.png });
  }
  return new Blob([zipStored(files)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Saves a blob under the given file name. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
