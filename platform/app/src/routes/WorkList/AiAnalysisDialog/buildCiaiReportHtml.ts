/**
 * Builds the printable CIAI Teleradiology AI report.
 *
 * The layout follows the team-draft specification: every finding is presented
 * as original image first, then the human/lab marking, then the CIAI AI marking,
 * with the heatmap retained at the end as supporting evidence — AI overlays are
 * never allowed to stand in for the diagnostic image.
 *
 * Output is a self-contained HTML document sized for A4 printing. Each sheet
 * carries its own header and footer band so the page furniture survives the
 * browser's print pipeline, which does not support `@page` margin boxes.
 */

import {
  AiCompletePayload,
  AiFindingSummary,
  CONSISTENCY_LABELS,
  EvidenceFinding,
  GroupedFinding,
  buildAllFindingRecords,
  formatConfidence,
  formatDicomDate,
  getAnomalyFindings,
  getImageSrc,
  getMeasurementRange,
  getReportableFindings,
  getTier,
  groupEvidenceFindings,
  TIER_LABELS,
  summarizeSeverities,
} from './aiReportModel';
import {
  escapeHtml,
  renderSafeReportMarkdown,
  splitReportSections,
  stripLowPriorityFindings,
} from './reportMarkdown';

export type ReportBuildOptions = {
  payload: AiCompletePayload;
  evidence: EvidenceFinding[];
  study: {
    studyInstanceUid: string;
    patientName?: string;
    description?: string;
    date?: string;
  };
  /** Absolute URL for the CIAI Teleradiology logo. */
  logoUrl: string;
  /** Include the full narrative report after the evidence sheets. */
  includeNarrative?: boolean;
  /**
   * Verification state of the report. Everything this pipeline produces is a
   * draft until a radiologist signs it, and the team asked for that to be
   * unmissable rather than implied by a "TEAM DRAFT" label.
   */
  reportStatus?: 'draft' | 'verified';
  /**
   * Append the team-facing workflow specification and approval block.
   *
   * Off for patient reports: that page is the reference document's build
   * instruction rather than study data, and it states requirements this
   * pipeline does not yet meet (source-DICOM originals, stored measurement
   * coordinates).
   */
  includeSpecificationAppendix?: boolean;
  generatedAt?: Date;
};

/**
 * The backend narrative repeats every inspected structure in this table. The
 * report replaces it with an anomaly-only table, so the section is dropped to
 * avoid printing ~200 rows of normal anatomy.
 */
const REPLACED_NARRATIVE_SECTIONS = [/^all findings/i];

const WORKFLOW_STAGES: [string, string][] = [
  [
    '1. Original',
    'Exact unmodified DICOM image at the AI-detected location. This is the largest and primary clinical image.',
  ],
  [
    '2. Human / lab',
    'Same DICOM slice with manual caliper/marking. Measurement in mm must appear directly above the measurement line.',
  ],
  [
    '3. CIAI AI',
    'Same DICOM slice with CIAI localization and calibrated AI calipers. AI measurement in mm appears directly above the line.',
  ],
  [
    '4. Compare',
    'Manual mm, CIAI mm, absolute difference, image-level AI score and radiologist-confirmed value together.',
  ],
  [
    '5. Heatmap - final evidence',
    'Heatmap/segmentation shown after the original and measurement views. It supports the finding but does not replace the original DICOM.',
  ],
  [
    '6. Mismatch engine',
    'Image-level measurement/score and narrative measurement/score are compared automatically. Differences are visibly flagged.',
  ],
  [
    '7. DICOM proof',
    'Save Study UID, Series UID/Number, SOP Instance UID/Image Number, Frame Number and measurement coordinates.',
  ],
  [
    '8. Radiologist control',
    'Open exact slice, toggle Human / CIAI / Heatmap, then Accept / Modify / Reject. Final signed measurement is radiologist-controlled.',
  ],
  [
    '9. Audit',
    'Preserve AI engine/model version, image measurement, narrative output, manual value, radiologist value and timestamps.',
  ],
];

const REPORT_CSS = `
  :root {
    --navy: #082a4b;
    --navy-soft: #16496f;
    --teal: #0b7c69;
    --teal-soft: #e6f4f1;
    --panel: #f0f6f9;
    --line: #dfe7ee;
    --line-strong: #c3d2dd;
    --muted: #667787;
    --ink: #1f2c38;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #8f9aa5;
    color: var(--ink);
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    position: relative;
    width: 210mm;
    /* Deliberately a few mm under A4's 297mm. At exactly 297 any sub-pixel
       rounding in the print pipeline tips the sheet onto a second page, which
       shows up as a blank page carrying nothing but the footer. */
    min-height: 288mm;
    margin: 0 auto 8mm;
    padding: 12mm 14mm 14mm;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; margin-bottom: 0; }
  .sheet-body { flex: 1 1 auto; }
  .sheet-cover { padding-top: 0; }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12mm;
    border-bottom: 2px solid var(--teal);
    padding-bottom: 3.5mm;
    margin-bottom: 6mm;
  }
  .sheet-header img { height: 10mm; width: auto; object-fit: contain; }
  .sheet-header .ident { text-align: right; line-height: 1.35; }
  .sheet-header .ident strong { display: block; font-size: 8pt; letter-spacing: 0.06em; color: var(--navy); }
  .sheet-header .ident span { font-size: 7pt; color: var(--muted); letter-spacing: 0.04em; }

  .sheet-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--line);
    margin-top: 6mm;
    padding-top: 2.5mm;
    color: var(--muted);
    font-size: 7pt;
    letter-spacing: 0.02em;
  }

  /* ---- cover ---- */
  .cover-brand { display: flex; align-items: center; justify-content: space-between; padding: 6mm 0 5mm; }
  .cover-brand img { height: 13mm; width: auto; }
  .cover-brand .stamp { text-align: right; font-size: 7.5pt; color: var(--muted); line-height: 1.5; }
  .cover-brand .stamp b { display: block; color: var(--navy); font-size: 8pt; letter-spacing: 0.06em; }

  .hero {
    background: linear-gradient(135deg, var(--navy) 0%, #0d3c66 100%);
    color: #ffffff;
    padding: 10mm 12mm;
    margin-bottom: 5mm;
    border-left: 3mm solid var(--teal);
  }
  .hero h1 { margin: 0; font-size: 26pt; line-height: 1.12; letter-spacing: -0.015em; }
  .hero .pipeline {
    margin-top: 10mm;
    font-size: 9.5pt;
    color: #cfe3f2;
    letter-spacing: 0.04em;
    border-top: 1px solid rgba(255,255,255,0.25);
    padding-top: 4mm;
  }
  .cover-tagline { color: var(--navy); font-size: 16pt; font-weight: bold; margin: 0 0 2.5mm; }
  .cover-lede { margin: 0 0 4mm; font-size: 9pt; color: #3d4c5a; }

  .verdict {
    display: flex;
    align-items: center;
    gap: 5mm;
    border: 1px solid var(--line-strong);
    border-left: 2.5mm solid var(--teal);
    background: var(--teal-soft);
    padding: 3.5mm 5mm;
    margin-bottom: 5mm;
  }
  .verdict .headline { font-size: 13pt; font-weight: bold; color: var(--navy); }
  .verdict .detail { font-size: 8.5pt; color: #3d4c5a; margin-top: 0.8mm; }
  .verdict.is-critical { border-left-color: #b3261e; background: #fdf0ef; }

  .tiles { display: flex; gap: 3mm; margin-bottom: 6mm; }
  .tile {
    flex: 1 1 0;
    background: var(--panel);
    border: 1px solid var(--line);
    border-top: 1.2mm solid var(--teal);
    text-align: center;
    padding: 3.5mm 2mm;
  }
  .tile .value { font-size: 16pt; font-weight: bold; color: var(--navy); }
  .tile .label { margin-top: 1.5mm; font-size: 6pt; font-weight: bold; letter-spacing: 0.06em; color: var(--muted); text-transform: uppercase; line-height: 1.4; }

  .facts { font-size: 8.5pt; margin-bottom: 5mm; border: 1px solid var(--line); }
  .facts .row { display: flex; border-bottom: 1px solid var(--line); }
  .facts .row:last-child { border-bottom: 0; }
  .facts .key { width: 32mm; background: var(--panel); color: var(--muted); font-weight: bold; font-size: 7.5pt; padding: 2.2mm 3mm; text-transform: uppercase; letter-spacing: 0.04em; }
  .facts .val { flex: 1; padding: 2.2mm 3mm; word-break: break-word; }

  /* ---- shared ---- */
  h2.section { color: var(--navy); font-size: 14pt; margin: 0 0 1.5mm; }
  .section-rule { width: 18mm; height: 1mm; background: var(--teal); margin-bottom: 4mm; }
  h2.finding { color: var(--navy); font-size: 18pt; margin: 0 0 2mm; line-height: 1.2; }
  .finding-meta { font-size: 8.5pt; color: var(--ink); margin-bottom: 4mm; }
  .finding-meta b { color: var(--navy); }

  .sev { display: inline-block; padding: 0.5mm 2mm; border-radius: 1mm; font-size: 7pt; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Pastel severity with deep same-hue text; stays legible in print. */
  .sev-critical { background: #ffd9d3; color: #8e2414; }
  .sev-high { background: #ffe3c7; color: #8a4510; }
  .sev-medium { background: #fbf0bf; color: #6b5500; }
  .sev-low { background: #e3e9ef; color: #3b4f60; }
  .ident-draft { color: #b3261e !important; font-weight: bold; }
  .ident-verified { color: #157f68 !important; font-weight: bold; }

  .statusbar {
    border: 1px solid #f0b5c0;
    background: #fbeaee;
    color: #ad2d45;
    font-size: 9pt;
    font-weight: bold;
    letter-spacing: 0.08em;
    text-align: center;
    padding: 2.2mm;
    margin-bottom: 3.5mm;
  }
  .statusbar.is-verified { border-color: #a5e2d3; background: #e6f7f2; color: #157f68; }

  .trace { color: var(--muted); font-size: 6.5pt; font-weight: normal; margin-top: 0.8mm; word-break: break-all; }

  .stages { display: flex; gap: 2mm; margin-bottom: 4mm; }
  .stage-step { flex: 1 1 0; border: 1px solid var(--line); border-top: 1mm solid var(--line-strong); padding: 2mm; }
  .stage-step.is-done { border-top-color: var(--teal); background: var(--panel); }
  .stage-num { display: block; font-size: 7pt; font-weight: bold; color: var(--muted); }
  .stage-label { display: block; font-size: 7.5pt; font-weight: bold; color: var(--navy); margin-top: 0.5mm; line-height: 1.25; }
  .stage-note { display: block; font-size: 6.5pt; color: var(--muted); margin-top: 0.5mm; }
  .stage-step.is-pending .stage-label { color: var(--muted); }

  .sevdot { display: inline-block; width: 2mm; height: 2mm; border-radius: 50%; vertical-align: middle; margin-right: 1.5mm; }
  /* A 2 mm dot needs the palette's mid-tone; the pastel fill would vanish. */
  .sevdot { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sevdot.sev-critical { background: #ef6b54; }
  .sevdot.sev-high { background: #f0a060; }
  .sevdot.sev-medium { background: #e3c04a; }
  .sevdot.sev-low { background: #94a3b8; }
  .sevword { font-size: 7.5pt; text-transform: capitalize; color: var(--muted); vertical-align: middle; }
  .occ { display: inline-block; margin-left: 1.5mm; padding: 0.3mm 1.6mm; border-radius: 1mm; background: var(--panel); border: 1px solid var(--line); color: var(--muted); font-size: 6.5pt; font-weight: bold; white-space: nowrap; }

  table.grid { width: 100%; border-collapse: collapse; font-size: 8pt; }
  table.grid th { background: var(--navy); color: #ffffff; text-align: left; font-size: 7pt; letter-spacing: 0.06em; text-transform: uppercase; padding: 2.4mm; }
  table.grid td { border: 1px solid var(--line); padding: 2.2mm 2.4mm; vertical-align: top; }
  table.grid tr { page-break-inside: avoid; break-inside: avoid; }
  table.grid tbody tr:nth-child(even) td { background: #f8fbfc; }
  table.grid .id { font-weight: bold; color: var(--navy); white-space: nowrap; }
  table.grid .sub { color: var(--muted); font-size: 7pt; }
  .note { font-size: 7.5pt; color: var(--muted); margin-top: 3.5mm; line-height: 1.5; }

  .group-head { background: var(--teal-soft) !important; }
  .group-head td { font-weight: bold; color: var(--navy); font-size: 7.5pt; letter-spacing: 0.06em; text-transform: uppercase; border-color: var(--line-strong); }

  /* ---- evidence panels ---- */
  .panel { border: 1px solid var(--line); margin-bottom: 3.5mm; page-break-inside: avoid; break-inside: avoid; }
  .panel > .panel-label { background: var(--panel); color: var(--navy); font-size: 7pt; font-weight: bold; letter-spacing: 0.07em; text-transform: uppercase; padding: 2mm 3mm; border-bottom: 1px solid var(--line); }
  .panel .stage { background: #000000; text-align: center; padding: 3mm; }
  .panel .caption { font-size: 7pt; color: var(--muted); padding: 2mm 3mm; border-top: 1px solid var(--line); line-height: 1.5; }
  .panel .caption b { color: var(--ink); }
  .panel-row { display: flex; gap: 3.5mm; }
  .panel-row > .panel { flex: 1 1 0; min-width: 0; }

  .frame { position: relative; display: inline-block; max-width: 100%; line-height: 0; }
  .frame img { display: block; max-width: 100%; height: auto; }
  /* A finding's evidence fits one printed page: the three images sit side by
     side (original first), so the verification panel no longer continues
     overleaf onto a page carrying nothing else. */
  .evidence { break-inside: avoid; page-break-inside: avoid; }
  .evidence h2.finding { font-size: 15pt; margin-bottom: 1.5mm; }
  .evidence .finding-meta { margin-bottom: 3mm; }
  .evidence .stages { margin-bottom: 3mm; }
  .evidence .stage-step { padding: 1.2mm 1.8mm; }
  .evidence .panel-row { gap: 2.5mm; }
  .evidence .panel { margin-bottom: 3mm; }
  /* Equal label heights keep the three images level when one label wraps. */
  .evidence .panel > .panel-label { min-height: 8mm; display: flex; align-items: center; }
  /* Two panels instead of three, so each image can be half as large again. */
  .evidence .panel .stage { padding: 2mm; min-height: calc(var(--evidence-img, 88mm) + 4mm); display: flex; align-items: center; justify-content: center; }
  .evidence .panel .frame img { max-height: var(--evidence-img, 88mm); }
  .evidence table.evidence-findings { margin-bottom: 3mm; font-size: 7.5pt; }
  /* Fixed layout: the long source-frame id under each finding id used to set
     the ID column's width and squeeze the finding text into tall rows. */
  table.grid { table-layout: fixed; }
  table.grid .id .trace { white-space: normal; }
  .verify-flag { color: #ad2d45; font-size: 7pt; font-weight: bold; margin-top: 0.6mm; }
  table.grid .flag, .flag { color: #ad2d45; font-size: 7pt; font-weight: bold; }
  .evidence .panel .caption { padding: 1.5mm 2.5mm; font-size: 6.5pt; }
  .evidence table.verify { font-size: 7.5pt; }
  .evidence table.verify th, .evidence table.verify td { padding: 1.4mm 2.5mm; }
  .evidence .note { margin-top: 2.5mm; }


  .verify-title { background: var(--navy); color: #ffffff; font-size: 7.5pt; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 2.4mm 3mm; }
  table.verify { width: 100%; border-collapse: collapse; font-size: 8pt; table-layout: fixed; }
  table.verify tr { page-break-inside: avoid; break-inside: avoid; }
  table.verify th { background: var(--panel); color: var(--muted); font-weight: normal; text-align: left; width: 22%; padding: 2.1mm 3mm; border: 1px solid var(--line); }
  table.verify td { padding: 2.1mm 3mm; border: 1px solid var(--line); width: 28%; word-wrap: break-word; }
  .flag { color: #b3261e; font-weight: bold; }
  .ok { color: #1c6b3f; font-weight: bold; }

  .block + .block { margin-top: 7mm; }
  .narrative + .narrative { margin-top: 6mm; }

  /* ---- narrative ---- */
  .narrative h2 { color: var(--navy); font-size: 14pt; margin: 0 0 3mm; }
  .narrative h3 { color: var(--navy); font-size: 12pt; margin: 0 0 3mm; }
  .narrative h4 { color: var(--navy); font-size: 9.5pt; margin: 4mm 0 1.5mm; padding-left: 2.5mm; border-left: 0.8mm solid var(--teal); }
  .narrative p { margin: 2mm 0; }
  .narrative ul, .narrative ol { margin: 2mm 0; padding-left: 6mm; }
  .narrative li { margin: 1mm 0; }
  .narrative table { width: 100%; border-collapse: collapse; font-size: 7.5pt; margin: 3mm 0; }
  .narrative th, .narrative td { border: 1px solid var(--line); padding: 1.6mm; text-align: left; vertical-align: top; }
  .narrative th { background: var(--panel); color: var(--navy); }
  .narrative tr { page-break-inside: avoid; break-inside: avoid; }
  .narrative hr { border: 0; border-top: 1px solid var(--line); margin: 4mm 0; }

  .signatures { display: flex; gap: 8mm; margin-top: 6mm; }
  .signatures div { flex: 1 1 0; font-size: 8pt; }
  .signatures .rule { margin-top: 12mm; border-top: 1px solid var(--navy); padding-top: 1.5mm; color: var(--muted); }

  .disclaimer { margin-top: 5mm; border: 1px solid var(--line); background: var(--panel); padding: 3mm 4mm; font-size: 7.5pt; color: var(--muted); line-height: 1.55; }

  @page { size: A4; margin: 0; }
  @media print {
    body { background: #ffffff; }
    .sheet { margin: 0; box-shadow: none; }
  }
`;

function severityClass(severity: string) {
  const value = (severity || 'low').toLowerCase();
  return ['critical', 'high', 'medium', 'low'].includes(value) ? `sev-${value}` : 'sev-low';
}

/** Stable short code so a reprint of the same study keeps its draft identifier. */
function draftHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
}

function buildDraftId(payload: AiCompletePayload, studyInstanceUid: string) {
  const studyDate = payload.study_info?.study_date || '00000000';
  const patientId = payload.patient_info?.patient_id || '000';
  return `CIAI-RAD-${studyDate}-${patientId}-${draftHash(studyInstanceUid)}`;
}

function renderFrame(image: string, alt: string) {
  if (!image) {
    return `<div style="color:#8fa2b3;font-size:8pt;padding:10mm 0">Image not returned by the analysis service.</div>`;
  }

  return `<span class="frame"><img src="${getImageSrc(image)}" alt="${escapeHtml(alt)}" /></span>`;
}

const STATUS_TEXT: Record<'draft' | 'verified', string> = {
  draft: 'AI DRAFT — RADIOLOGIST VERIFICATION PENDING',
  verified: 'RADIOLOGIST VERIFIED',
};

function sheetHeader(logoUrl: string, draftId: string, status: 'draft' | 'verified') {
  const statusLabel = STATUS_TEXT[status];
  const statusClass = status === 'draft' ? 'ident-draft' : 'ident-verified';
  return `
    <header class="sheet-header">
      <img src="${logoUrl}" alt="CIAI Teleradiology" />
      <div class="ident">
        <strong>AI ANALYSIS REPORT</strong>
        <span class="${statusClass}">${escapeHtml(statusLabel)} | ${escapeHtml(draftId)}</span>
      </div>
    </header>
  `;
}

/**
 * A sheet can flow onto more than one printed page, so the footer names the
 * section rather than a page number it cannot compute — the browser's own print
 * settings remain available for true page numbering.
 */
function sheetFooter(sectionLabel: string) {
  return `
    <footer class="sheet-footer">
      <span>CIAI Teleradiology — AI analysis, radiologist verification required</span>
      <span>${escapeHtml(sectionLabel)}</span>
    </footer>
  `;
}

function makeSheet(body: string, sectionLabel: string, header: string) {
  return `
    <section class="sheet">
      ${header}
      <div class="sheet-body">${body}</div>
      ${sheetFooter(sectionLabel)}
    </section>
  `;
}

function sectionHeading(title: string) {
  return `<h2 class="section">${escapeHtml(title)}</h2><div class="section-rule"></div>`;
}

type CoverTotals = {
  anomalies: AiFindingSummary[];
  grouped: GroupedFinding[];
  measured: GroupedFinding[];
  reported: GroupedFinding[];
  excludedCount: number;
  lowSeverityCount: number;
};

function renderCoverBody(options: ReportBuildOptions, draftId: string, totals: CoverTotals) {
  const { payload, study, logoUrl } = options;
  const { grouped, measured, reported, excludedCount, lowSeverityCount } = totals;
  const patient = payload.patient_info || {};
  const studyInfo = payload.study_info || {};
  // Severity is reported over the findings that survive grouping, not over the
  // raw entry list where two thirds are duplicates and background noise.
  const counts = summarizeSeverities(grouped);
  const worst = counts.critical ? 'critical' : counts.high ? 'high' : counts.medium ? 'medium' : 'low';
  const toVerify = grouped.filter(finding => /^\[Verify:/.test(finding.description || '')).length;
  const images = new Set(measured.map(finding => finding.frameKey).filter(Boolean)).size;

  const tiles: [string, string][] = [
    [String(measured.length), `Marked on ${images} image${images === 1 ? '' : 's'}`],
    [String(reported.length), 'Not marked on an image'],
    [getMeasurementRange(measured), 'Marked box sizes'],
    [String(toVerify), 'Flagged for verification'],
  ];

  const facts: [string, string][] = [
    ['Patient', patient.patient_name || study.patientName || 'Not available'],
    [
      'Sex / ID',
      [patient.patient_sex, patient.patient_id ? `ID ${patient.patient_id}` : '']
        .filter(Boolean)
        .join('  |  ') || 'Not available',
    ],
    ['Study date', formatDicomDate(studyInfo.study_date || study.date)],
    ['Study UID', study.studyInstanceUid],
    [
      'Coverage',
      `${payload.total_series_analyzed ?? 0} series  |  ${
        payload.total_frames_processed ?? 0
      } frames  |  ${(payload.findings_summary || []).length} entries reviewed  |  ${
        totals.anomalies.length
      } anomalies  |  ${grouped.length} after merging duplicates`,
    ],
  ];

  return `
    <div class="cover-brand">
      <img src="${logoUrl}" alt="CIAI Teleradiology" />
      <div class="stamp">
        <b>AI ANALYSIS REPORT</b>
        <span class="${
          options.reportStatus === 'verified' ? 'ident-verified' : 'ident-draft'
        }">${escapeHtml(STATUS_TEXT[options.reportStatus || 'draft'])}</span><br />
        ${escapeHtml(draftId)}
      </div>
    </div>
    <div class="hero">
      <h1>CIAI TELERADIOLOGY<br />AI PART</h1>
      <div class="pipeline">ORIGINAL IMAGE&nbsp;&nbsp;|&nbsp;&nbsp;CIAI AI MARKING&nbsp;&nbsp;|&nbsp;&nbsp;RADIOLOGIST VERIFY</div>
    </div>
    <p class="cover-tagline">AI evidence should never hide the diagnostic image.</p>
    <p class="cover-lede">
      Each marked image is presented as the original diagnostic image first, then the CIAI AI
      marking, with every finding on that image listed above them. Every image shown is returned by
      the analysis service; nothing is redrawn or inferred. The radiologist remains the final
      decision-maker.
    </p>

    <div class="statusbar ${options.reportStatus === 'verified' ? 'is-verified' : ''}">
      ${escapeHtml(STATUS_TEXT[options.reportStatus || 'draft'])}
    </div>
    <div class="verdict ${worst === 'critical' ? 'is-critical' : ''}">
      <span class="sev ${severityClass(worst)}">${escapeHtml(worst)}</span>
      <div>
        <div class="headline">Study result: ${
          grouped.length ? `${grouped.length} distinct findings` : 'No anomalies reported'
        }</div>
        <div class="detail">
          <b>${measured.length}</b> marked on image &middot; <b>${reported.length}</b> not marked
          &nbsp;|&nbsp; ${counts.critical} critical &middot; ${counts.high} high &middot; ${counts.medium} medium
        </div>
        <div class="detail">
          ${excludedCount} normal-structure and negative entries and ${lowSeverityCount} low-severity
          findings excluded; repeat observations of the same finding across slices merged.
        </div>
      </div>
    </div>

    <div class="tiles">
      ${tiles
        .map(
          ([value, label]) => `
        <div class="tile">
          <div class="value">${escapeHtml(value)}</div>
          <div class="label">${escapeHtml(label)}</div>
        </div>`
        )
        .join('')}
    </div>

    <div class="facts">
      ${facts
        .map(
          ([key, value]) =>
            `<div class="row"><div class="key">${escapeHtml(key)}</div><div class="val">${escapeHtml(
              value
            )}</div></div>`
        )
        .join('')}
    </div>

    <div class="disclaimer">
      This document is AI-generated decision support, not a diagnosis. Every measurement, marking and
      impression requires radiologist verification before clinical use. Marked-box sizes are
      measured from DICOM pixel spacing around the AI's box and are upper bounds; AI size estimates
      are the model's wording. Findings an automated check could not support are flagged
      "Verify" rather than removed.
    </div>
  `;
}

/** Severity as a compact dot + word, so it stays visible without owning a column. */
function severityTag(severity: string) {
  const value = (severity || 'low').toLowerCase();
  return `<span class="sevdot ${severityClass(value)}"></span><span class="sevword">${escapeHtml(
    value
  )}</span>`;
}

function occurrenceNote(finding: GroupedFinding) {
  if (finding.occurrences < 2) {
    return '';
  }
  return `<span class="occ">seen ${finding.occurrences}&times;</span>`;
}

const VERIFY_PREFIX = /^\[Verify: ([^\]]*)\]\s*/;

/** Description with the study review's "[Verify: …]" note set apart as a flag. */
function renderDescription(description: string) {
  if (!description) {
    return '';
  }
  const match = description.match(VERIFY_PREFIX);
  const rest = match ? description.slice(match[0].length) : description;
  return `${match ? `<div class="verify-flag">Verify: ${escapeHtml(match[1])}</div>` : ''}${
    rest ? `<div class="sub">${escapeHtml(rest)}</div>` : ''
  }`;
}

/**
 * The one findings table. It replaces separate Priority, Measured, Narrative
 * and Image-level tables that listed the same rows up to three times.
 */
function renderFindingsTableBody(rows: GroupedFinding[], part: number, partCount: number) {
  const body = rows
    .map(
      finding => `
      <tr>
        <td>${severityTag(finding.severity)}</td>
        <td class="id">${escapeHtml(finding.findingId || '—')}</td>
        <td>
          <b>${escapeHtml(finding.name)}</b> ${occurrenceNote(finding)}
          ${renderDescription(finding.description)}
        </td>
        <td class="${finding.tier === 'measured' ? 'ok' : 'sub'}">${escapeHtml(
          TIER_LABELS[finding.tier]
        )}</td>
        <td><b>${escapeHtml(finding.tier === 'measured' ? finding.imageMeasurement.display : '—')}</b></td>
        <td>${escapeHtml(finding.narrativeMeasurement.display)}${
          finding.consistency === 'mismatch'
            ? `<div class="flag">${escapeHtml(CONSISTENCY_LABELS.mismatch)}</div>`
            : ''
        }</td>
        <td>${escapeHtml(finding.locations.join('; ') || '—')}</td>
      </tr>`
    )
    .join('');

  return `
    ${sectionHeading(`Findings${partCount > 1 ? ` (${part} of ${partCount})` : ''}`)}
    ${
      part === 1
        ? `<p class="note" style="margin-top:0;margin-bottom:3.5mm">
             Most severe first. "Marked on image" findings have a locating box on a source frame and an
             evidence page later in this report. The marked box is measured from the DICOM pixel
             spacing; it is the box drawn around the finding, so it is an upper bound, not a traced
             measurement. The AI size estimate is the model's own wording.
           </p>`
        : ''
    }
    <table class="grid">
      <thead>
        <tr>
          <th style="width:9%">Severity</th>
          <th style="width:8%">ID</th>
          <th style="width:39%">Finding</th>
          <th style="width:9%">Evidence</th>
          <th style="width:10%">Marked box</th>
          <th style="width:11%">AI size estimate</th>
          <th style="width:14%">Location</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

/**
 * Rough printed height of one findings row. A fixed rows-per-sheet count cannot
 * work here: descriptions run from four words to three lines, so ten short rows
 * fit comfortably while ten long ones overflow and strand the footer on a page
 * of its own.
 */
function estimateRowMm(finding: GroupedFinding, descriptionColumnChars: number) {
  // Calibrated on a printed findings table (fixed layout): ~0.7 of the
  // description width fits the bold 8pt name; the 7pt flag and description
  // lines are 3.2 mm; the wrapped source-frame id under the finding id is
  // ~11 characters per 2.8 mm line.
  const description = finding.description || '';
  const flag = description.match(/^\[Verify: [^\]]*\]\s*/);
  const rest = flag ? description.slice(flag[0].length) : description;
  const text =
    Math.ceil((finding.name || '').length / (descriptionColumnChars * 0.7)) * 3.6 +
    (flag ? Math.ceil(flag[0].length / descriptionColumnChars) * 3.2 : 0) +
    (rest ? Math.ceil(rest.length / descriptionColumnChars) * 3.2 : 0);
  const id = 3.5;
  const location = Math.ceil((finding.locations.join('; ') || '-').length / 16) * 3.6;
  return Math.max(text, id, location, 4) + 5.5;
}

/** Heading, intro note and header row of one table block, plus the gap before it. */
const TABLE_BLOCK_OVERHEAD_MM = 36;
/** Sheet body height left for blocks once the header and footer bands are taken out. */
const SHEET_BODY_BUDGET_MM = 188;

type SheetBlock = { body: string; label: string };

type TableSpec = {
  rows: GroupedFinding[];
  descriptionColumnChars: number;
  label: string;
  render: (rows: GroupedFinding[], part: number, partCount: number) => string;
};

/**
 * Flows the findings tables across sheets as one continuous run. Each table
 * used to open a sheet of its own and be split on its own, so a short table,
 * or the last few rows of a long one, printed as a page that was mostly white
 * space. Here a table starts wherever the previous one ended and only breaks
 * to a new sheet when its next row would not fit.
 */
function flowTables(tables: TableSpec[], budgetMm = SHEET_BODY_BUDGET_MM) {
  const placed: { table: TableSpec; rows: GroupedFinding[]; sheet: number }[] = [];
  let sheet = 0;
  let used = 0;

  tables.forEach(table => {
    let index = 0;
    while (index < table.rows.length) {
      const rows: GroupedFinding[] = [];
      let height = TABLE_BLOCK_OVERHEAD_MM;
      while (index < table.rows.length) {
        const rowMm = estimateRowMm(table.rows[index], table.descriptionColumnChars);
        // A row taller than a whole sheet still has to go somewhere, so an
        // empty sheet always takes at least one.
        if (used + height + rowMm > budgetMm && (rows.length || used > 0)) {
          break;
        }
        rows.push(table.rows[index]);
        height += rowMm;
        index += 1;
      }
      if (rows.length) {
        placed.push({ table, rows, sheet });
        used += height;
      }
      if (index < table.rows.length) {
        sheet += 1;
        used = 0;
      }
    }
  });

  // Part numbers ("2 of 3") are only known once every table has been placed.
  const sheets: SheetBlock[][] = [];
  tables.forEach(table => {
    const parts = placed.filter(part => part.table === table);
    parts.forEach((part, index) => {
      if (!sheets[part.sheet]) {
        sheets[part.sheet] = [];
      }
      sheets[part.sheet].push({
        body: table.render(part.rows, index + 1, parts.length),
        label: `${table.label}${parts.length > 1 ? ` ${index + 1}/${parts.length}` : ''}`,
      });
    });
  });

  return { sheets: sheets.filter(Boolean), lastSheetUsedMm: used };
}


/**
 * The verification workflow as a progress strip.
 *
 * The team asked for the full sequence — original, human/lab marking, CIAI AI,
 * heatmap, radiologist verification — to stay visible. The human marking and
 * the verification are shown as *pending stages*, not as pictures: the analysis
 * service returns no manual measurement, so the only way to render that panel
 * would be to draw the AI's own box and caption it as a person's work.
 */
function renderStageStrip(finding: EvidenceFinding) {
  const stages: [string, boolean, string][] = [
    ['Original', Boolean(finding.originalImage), 'shown'],
    ['Human / lab marking', false, 'not supplied'],
    [
      'CIAI AI marking',
      Boolean(finding.annotatedImage || finding.heatmapImage),
      finding.annotatedImage || finding.heatmapImage ? 'shown' : 'none',
    ],
    ['Radiologist verify', false, 'pending'],
  ];

  return `
    <div class="stages">
      ${stages
        .map(
          ([label, done, note], index) => `
        <div class="stage-step ${done ? 'is-done' : 'is-pending'}">
          <span class="stage-num">${index + 1}</span>
          <span class="stage-label">${escapeHtml(label)}</span>
          <span class="stage-note">${escapeHtml(note)}</span>
        </div>`
        )
        .join('')}
    </div>`;
}

/**
 * One evidence page per image, listing every finding marked on it. A frame
 * with several findings used to get a page per finding, repeating the same
 * pictures up to eleven times in one report.
 */
function renderEvidenceBody(findings: GroupedFinding[], studyInstanceUid: string, imageNumber: number) {
  const lead = findings[0];
  // The marked scan is the second panel; the composite (scan + findings panel)
  // is only a fallback — its panel text is unreadable at this size and the
  // same details are in the table above it.
  const marking = lead.annotatedImage || lead.heatmapImage;
  const panels: { label: string; image: string; caption: string }[] = [
    {
      label: '1. Original diagnostic image',
      image: lead.originalImage,
      caption: 'Unmodified frame at the AI-detected location. No overlay applied.',
    },
  ];
  if (marking) {
    panels.push({
      label: '2. CIAI AI marking',
      image: marking,
      caption:
        'Locating box and glow drawn by the analysis service. The glow marks the box; it is not a model attention map.',
    });
  }

  const renderPanel = (panel: typeof panels[number]) => `
    <div class="panel">
      <div class="panel-label">${panel.label}</div>
      <div class="stage">${renderFrame(panel.image, `${lead.name} — ${panel.label}`)}</div>
      <div class="caption">${panel.caption}</div>
    </div>`;

  const rows = findings
    .map(
      finding => `
      <tr>
        <td class="id">${escapeHtml(finding.findingId || '—')}</td>
        <td><span class="sev ${severityClass(finding.severity)}">${escapeHtml(finding.severity)}</span>
          <b>${escapeHtml(finding.name)}</b>
          ${renderDescription(finding.description)}
          ${
            finding.imageRegionName && finding.imageRegionName !== finding.name
              ? `<div class="sub">Marked as: ${escapeHtml(finding.imageRegionName)}</div>`
              : ''
          }</td>
        <td><b>${escapeHtml(finding.imageMeasurement.display)}</b></td>
        <td>${escapeHtml(finding.narrativeMeasurement.display)}</td>
        <td class="${finding.consistency === 'match' ? 'ok' : finding.consistency === 'mismatch' ? 'flag' : 'sub'}">${escapeHtml(
          CONSISTENCY_LABELS[finding.consistency]
        )}</td>
        <td>${escapeHtml(formatConfidence(finding.imageScore ?? finding.narrativeScore))}</td>
      </tr>`
    )
    .join('');

  // Each extra finding row takes ~14 mm, so the images shrink to keep the
  // page to one sheet (2 findings on one image used to spill a blank page).
  const imageMm = Math.max(55, 88 - Math.max(0, findings.length - 1) * 16);

  return `
    <div class="evidence" style="--evidence-img:${imageMm}mm">
    <h2 class="finding">Image ${imageNumber} — ${escapeHtml(
      findings.length === 1 ? lead.name : `${findings.length} findings`
    )}</h2>
    <div class="finding-meta">
      <b>Series:</b> ${escapeHtml(lead.seriesLabel || 'Not stated')}
      &nbsp;&nbsp;|&nbsp;&nbsp;<b>Location:</b> ${escapeHtml(lead.location || 'Not stated')}
    </div>

    ${renderStageStrip(lead)}

    <table class="grid evidence-findings">
      <thead>
        <tr>
          <th style="width:10%">ID</th>
          <th style="width:40%">Finding</th>
          <th style="width:13%">Marked box</th>
          <th style="width:13%">AI estimate</th>
          <th style="width:16%">Estimate vs box</th>
          <th style="width:8%">Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="panel-row">${panels.map(renderPanel).join('')}</div>

    <table class="verify">
      <tbody>
        <tr>
          <th>Source frame</th><td>${escapeHtml(lead.frameKey || 'Not stated')}</td>
          <th>DICOM identifiers</th><td>Study ${escapeHtml(studyInstanceUid)}<br />Series ${escapeHtml(
            lead.seriesId || 'Not stated'
          )}</td>
        </tr>
        <tr>
          <th>Radiologist confirmed value</th><td>_____________________</td>
          <th>Radiologist action</th><td>Verify / Accept / Modify / Reject</td>
        </tr>
        <tr>
          <th>Final report value</th><td>_____________________</td>
          <th>Reported by</th><td>_____________________</td>
        </tr>
      </tbody>
    </table>
    </div>
  `;
}

function renderWorkflowBody() {
  return `
    ${sectionHeading('Final Team Draft - Build This Workflow')}
    <p class="cover-lede">This is the CIAI AI-part output structure this report implements.</p>
    <table class="grid">
      <thead>
        <tr><th style="width:26%">Stage</th><th>What must appear</th></tr>
      </thead>
      <tbody>
        ${WORKFLOW_STAGES.map(
          ([stage, detail]) =>
            `<tr><td class="id">${escapeHtml(stage)}</td><td>${escapeHtml(detail)}</td></tr>`
        ).join('')}
      </tbody>
    </table>
    <p class="note">
      Implementation note: the original panel is populated from the frame returned by the analysis
      service for the detected location. Manual and AI calipers are drawn from the stored image-level
      region coordinates; once a radiologist records a manual caliper in the viewer, the manual value
      replaces the seeded draft.
    </p>
    <div class="verify-title" style="margin-top:6mm">Team approval / notes</div>
    <div class="signatures">
      <div><div class="rule">Engineering</div></div>
      <div><div class="rule">Radiology / Clinical</div></div>
      <div><div class="rule">Product</div></div>
    </div>
  `;
}

export function buildCiaiReportHtml(options: ReportBuildOptions) {
  const {
    payload,
    study,
    logoUrl,
    includeNarrative = true,
    includeSpecificationAppendix = false,
    reportStatus = 'draft',
  } = options;
  const generatedAt = options.generatedAt || new Date();
  const draftId = buildDraftId(payload, study.studyInstanceUid);
  const header = sheetHeader(logoUrl, draftId, reportStatus);

  const allFindings = payload.findings_summary || [];
  const anomalies = getAnomalyFindings(allFindings);

  // One row per distinct finding, sorted by what can actually be done with it.
  // The analysis runs per frame, so the same lesion arrives once per slice it
  // appears on; grouping is what stops a single calcification filling six rows.
  // Low-severity findings are excluded from the report: they are two thirds of
  // a study and none of them has ever carried a measurement recoverable from
  // the image, so nothing verifiable is lost.
  const grouped = getReportableFindings(groupEvidenceFindings(buildAllFindingRecords(payload)));
  const measured = getTier(grouped, 'measured');
  const reported = getTier(grouped, 'reported');
  const excludedCount = allFindings.length - anomalies.length;
  const lowSeverityCount = anomalies.filter(
    finding => (finding.severity || 'low').toLowerCase() === 'low'
  ).length;

  const sheets: string[] = [];
  const addSheet = (body: string, sectionLabel: string) => {
    sheets.push(makeSheet(body, sectionLabel, header));
  };

  // Cover carries its own brand band instead of the running header.
  sheets.push(
    `<section class="sheet sheet-cover">
      <div class="sheet-body">${renderCoverBody(options, draftId, {
        anomalies,
        grouped,
        measured,
        reported,
        excludedCount,
        lowSeverityCount,
      })}</div>
      ${sheetFooter(draftId)}
    </section>`
  );

  const tables: TableSpec[] = [
    {
      rows: grouped,
      descriptionColumnChars: 58,
      label: 'Findings',
      render: renderFindingsTableBody,
    },
  ];

  const { sheets: tableSheets, lastSheetUsedMm } = flowTables(tables);

  if (!measured.length) {
    const note: SheetBlock = {
      body: `${sectionHeading('Evidence')}
       <p class="note">No finding in this study was marked on an image, so there is no evidence
       section to verify.</p>`,
      label: 'Evidence',
    };
    if (tableSheets.length && lastSheetUsedMm + 30 <= SHEET_BODY_BUDGET_MM) {
      tableSheets[tableSheets.length - 1].push(note);
    } else {
      tableSheets.push([note]);
    }
  }

  tableSheets.forEach(blocks => {
    addSheet(
      blocks.map(block => `<div class="block">${block.body}</div>`).join(''),
      blocks.map(block => block.label).join(' · ')
    );
  });

  // One evidence page per image, in order of each image's most severe finding.
  const byFrame = new Map<string, GroupedFinding[]>();
  measured.forEach(finding => {
    const key = finding.frameKey || finding.findingId || finding.name;
    byFrame.set(key, [...(byFrame.get(key) || []), finding]);
  });
  Array.from(byFrame.values()).forEach((findings, index) =>
    addSheet(
      renderEvidenceBody(findings, study.studyInstanceUid, index + 1),
      `Image ${index + 1} · ${findings.map(finding => finding.findingId || finding.name).join(', ')}`
    )
  );

  if (includeNarrative && payload.report?.report_text) {
    // One flowing sheet: a page per section printed one-sentence sections such
    // as Technique on a page of their own. The untitled lead section is the
    // patient/study table the narrative model prepends, which the cover already
    // shows, so it is left out.
    const narrative = splitReportSections(stripLowPriorityFindings(payload.report.report_text))
      .filter(
        section => !REPLACED_NARRATIVE_SECTIONS.some(pattern => pattern.test(section.title || ''))
      )
      .filter(section => section.title || !/^#\s+radiology report\b/i.test(section.body))
      .map(section => ({
        ...section,
        // The narrative ends with an AI-assistance disclaimer that every sheet's
        // footer and the cover already carry; on its own it spilled onto a page.
        body: section.body.replace(/\n[*_]*This report was generated with AI assistance[\s\S]*$/i, '\n'),
      }))
      .map(
        section => `
          <div class="narrative">
            ${section.title ? sectionHeading(section.title) : ''}
            ${renderSafeReportMarkdown(section.body)}
          </div>`
      );
    if (narrative.length) {
      addSheet(narrative.join(''), 'Narrative report');
    }
  }

  if (includeSpecificationAppendix) {
    addSheet(renderWorkflowBody(), 'Workflow specification');
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>CIAI AI Analysis Report — ${escapeHtml(
      payload.patient_info?.patient_name || study.patientName || study.studyInstanceUid
    )}</title>
    <style>${REPORT_CSS}</style>
  </head>
  <body>
    ${sheets.join('')}
    <div style="display:none" data-generated-at="${generatedAt.toISOString()}"></div>
  </body>
</html>`;
}

export { buildDraftId };
