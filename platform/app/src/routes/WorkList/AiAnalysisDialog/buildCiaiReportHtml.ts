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
  CONSISTENCY_LABELS,
  EvidenceFinding,
  GroupedFinding,
  buildAllFindingRecords,
  formatConfidence,
  formatDicomDate,
  getAnomalyFindings,
  getImageSrc,
  getMaxDifferenceMm,
  getMeasurementRange,
  getReportableFindings,
  getTier,
  groupEvidenceFindings,
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
  .cover-brand { display: flex; align-items: center; justify-content: space-between; padding: 8mm 0 6mm; }
  .cover-brand img { height: 13mm; width: auto; }
  .cover-brand .stamp { text-align: right; font-size: 7.5pt; color: var(--muted); line-height: 1.5; }
  .cover-brand .stamp b { display: block; color: var(--navy); font-size: 8pt; letter-spacing: 0.06em; }

  .hero {
    background: linear-gradient(135deg, var(--navy) 0%, #0d3c66 100%);
    color: #ffffff;
    padding: 11mm 12mm;
    margin-bottom: 6mm;
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
  .cover-lede { margin: 0 0 5mm; font-size: 9pt; color: #3d4c5a; }

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

  .sev { display: inline-block; padding: 0.5mm 2mm; border-radius: 1mm; font-size: 7pt; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; color: #ffffff; }
  .sev-critical { background: #b3261e; }
  .sev-high { background: #c2610a; }
  .sev-medium { background: #8a6d00; }
  .sev-low { background: #4a6076; }
  .sevdot { display: inline-block; width: 2mm; height: 2mm; border-radius: 50%; vertical-align: middle; margin-right: 1.5mm; }
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
  /* Caps keep a finding's evidence to two printed pages, matching the reference
     layout where only the verification panel continues overleaf. */
  .stage-primary .frame img { max-height: 68mm; }
  .stage-compare .frame img { max-height: 46mm; }
  .stage-support .frame img { max-height: 40mm; }


  .verify-title { background: var(--navy); color: #ffffff; font-size: 7.5pt; font-weight: bold; letter-spacing: 0.08em; text-transform: uppercase; padding: 2.4mm 3mm; }
  table.verify { width: 100%; border-collapse: collapse; font-size: 8pt; table-layout: fixed; }
  table.verify tr { page-break-inside: avoid; break-inside: avoid; }
  table.verify th { background: var(--panel); color: var(--muted); font-weight: normal; text-align: left; width: 22%; padding: 2.1mm 3mm; border: 1px solid var(--line); }
  table.verify td { padding: 2.1mm 3mm; border: 1px solid var(--line); width: 28%; word-wrap: break-word; }
  .flag { color: #b3261e; font-weight: bold; }
  .ok { color: #1c6b3f; font-weight: bold; }

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

function sheetHeader(logoUrl: string, draftId: string) {
  return `
    <header class="sheet-header">
      <img src="${logoUrl}" alt="CIAI Teleradiology" />
      <div class="ident">
        <strong>AI ANALYSIS REPORT</strong>
        <span>TEAM DRAFT | ${escapeHtml(draftId)}</span>
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
  const maxDifference = getMaxDifferenceMm(measured);

  const tiles: [string, string][] = [
    [String(measured.length), 'Measured — verifiable'],
    [String(reported.length), 'Reported — narrative only'],
    [getMeasurementRange(measured), 'Recovered image measurements'],
    [maxDifference ? `${maxDifference} mm` : 'None', 'Largest image vs narrative gap'],
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
        TEAM DRAFT | ${escapeHtml(draftId)}
      </div>
    </div>
    <div class="hero">
      <h1>CIAI TELERADIOLOGY<br />AI PART</h1>
      <div class="pipeline">ORIGINAL IMAGE&nbsp;&nbsp;|&nbsp;&nbsp;CIAI AI MARKING&nbsp;&nbsp;|&nbsp;&nbsp;HEATMAP&nbsp;&nbsp;|&nbsp;&nbsp;RADIOLOGIST VERIFY</div>
    </div>
    <p class="cover-tagline">AI evidence should never hide the diagnostic image.</p>
    <p class="cover-lede">
      Each finding is presented as the original diagnostic image first, then the CIAI AI marking,
      with the heatmap retained at the end as supporting evidence. Every image shown is returned by
      the analysis service; nothing is redrawn or inferred. The radiologist remains the final
      decision-maker.
    </p>

    <div class="verdict ${worst === 'critical' ? 'is-critical' : ''}">
      <span class="sev ${severityClass(worst)}">${escapeHtml(worst)}</span>
      <div>
        <div class="headline">Study result: ${
          grouped.length ? `${grouped.length} distinct findings` : 'No anomalies reported'
        }</div>
        <div class="detail">
          <b>${measured.length}</b> measured &middot; <b>${reported.length}</b> narrative only
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
      impression requires radiologist verification before clinical use. Image-level and narrative
      values are kept as separate audit fields and any disagreement between them is flagged rather
      than reconciled automatically.
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

/**
 * Findings the radiologist can check against a picture: a recovered millimetre
 * value, a bounding box and a frame. These are the only rows that also get
 * evidence pages.
 */
function renderMeasuredTableBody(rows: GroupedFinding[], part: number, partCount: number) {
  const body = rows
    .map(
      finding => `
      <tr>
        <td>${severityTag(finding.severity)}</td>
        <td class="id">${escapeHtml(finding.findingId || '—')}</td>
        <td>
          <b>${escapeHtml(finding.name)}</b> ${occurrenceNote(finding)}
          ${finding.description ? `<div class="sub">${escapeHtml(finding.description)}</div>` : ''}
        </td>
        <td><b>${escapeHtml(finding.imageMeasurement.display)}</b></td>
        <td>${escapeHtml(formatConfidence(finding.imageScore))}</td>
        <td class="${finding.consistency === 'match' ? 'ok' : 'flag'}">${escapeHtml(
        CONSISTENCY_LABELS[finding.consistency]
      )}</td>
        <td>${escapeHtml(finding.locations.join('; ') || '—')}</td>
      </tr>`
    )
    .join('');

  return `
    ${sectionHeading(
      `Measured Findings${partCount > 1 ? ` (${part} of ${partCount})` : ''}`
    )}
    ${
      part === 1
        ? `<p class="note" style="margin-top:0;margin-bottom:3.5mm">
             Findings with a measurement recovered from the image itself, a locating box and a source
             frame — the only ones that can be verified against a picture. Each has an evidence
             section later in this report.
           </p>`
        : ''
    }
    <table class="grid">
      <thead>
        <tr>
          <th style="width:10%">Severity</th>
          <th style="width:10%">ID</th>
          <th style="width:30%">Finding</th>
          <th style="width:13%">Image size</th>
          <th style="width:8%">Score</th>
          <th style="width:15%">Consistency</th>
          <th style="width:14%">Location</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

/** Reported by the narrative model with no measurable image evidence behind them. */
function renderReportedTableBody(rows: GroupedFinding[], part: number, partCount: number) {
  const body = rows
    .map(
      finding => `
      <tr>
        <td>${severityTag(finding.severity)}</td>
        <td class="id">${escapeHtml(finding.findingId || '—')}</td>
        <td>
          <b>${escapeHtml(finding.name)}</b> ${occurrenceNote(finding)}
          ${finding.description ? `<div class="sub">${escapeHtml(finding.description)}</div>` : ''}
        </td>
        <td>${escapeHtml(finding.narrativeMeasurement.display)}</td>
        <td>${escapeHtml(finding.locations.join('; ') || '—')}</td>
        <td class="sub">${escapeHtml(finding.seriesLabels.join('; ') || '—')}</td>
      </tr>`
    )
    .join('');

  return `
    ${sectionHeading(
      `Reported Findings — Narrative Only${partCount > 1 ? ` (${part} of ${partCount})` : ''}`
    )}
    ${
      part === 1
        ? `<p class="note" style="margin-top:0;margin-bottom:3.5mm">
             Stated by the narrative model without a measurement recovered from the image, so there is
             nothing to measure against. Sizes below are the model's own wording.
           </p>`
        : ''
    }
    <table class="grid">
      <thead>
        <tr>
          <th style="width:10%">Severity</th>
          <th style="width:10%">ID</th>
          <th style="width:36%">Finding</th>
          <th style="width:14%">Stated size</th>
          <th style="width:16%">Location</th>
          <th style="width:14%">Series</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

/**
 * Usable height for a table body on one sheet, after the header band, section
 * heading, intro note, table head and footer band are taken out.
 */
const TABLE_BUDGET_MM = 188;

/**
 * Rough printed height of one findings row. A fixed rows-per-sheet count cannot
 * work here: descriptions run from four words to three lines, so ten short rows
 * fit comfortably while ten long ones overflow and strand the footer on a page
 * of its own.
 */
function estimateRowMm(finding: GroupedFinding, descriptionColumnChars: number) {
  const nameLines = Math.ceil((finding.name || '').length / (descriptionColumnChars * 0.7));
  const descriptionLines = finding.description
    ? Math.ceil(finding.description.length / descriptionColumnChars)
    : 0;
  const locationLines = Math.ceil((finding.locations.join('; ') || '-').length / 18);
  const lines = Math.max(nameLines + descriptionLines, locationLines, 1);
  return 4.5 + lines * 3.9;
}

/** Packs rows onto sheets by estimated height rather than by a fixed count. */
function chunkByHeight(
  rows: GroupedFinding[],
  descriptionColumnChars: number,
  budgetMm = TABLE_BUDGET_MM
): GroupedFinding[][] {
  const sheets: GroupedFinding[][] = [];
  let current: GroupedFinding[] = [];
  let used = 0;

  rows.forEach(row => {
    const height = estimateRowMm(row, descriptionColumnChars);
    if (current.length && used + height > budgetMm) {
      sheets.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += height;
  });

  if (current.length) {
    sheets.push(current);
  }

  return sheets.length ? sheets : [[]];
}

function renderMeasurementsBody(evidence: EvidenceFinding[], part: number, partCount: number) {
  const rows = evidence
    .map(
      finding => `
      <tr>
        <td>
          <span class="id">${escapeHtml(finding.findingId)}</span> — ${escapeHtml(finding.name)}
          <div class="sub">${escapeHtml(finding.seriesLabel)}</div>
        </td>
        <td>${escapeHtml(finding.imageMeasurement.display)}</td>
        <td>${escapeHtml(formatConfidence(finding.imageScore))}</td>
        <td>${escapeHtml(finding.narrativeMeasurement.display)} / ${escapeHtml(
        formatConfidence(finding.narrativeScore)
      )}</td>
        <td class="${finding.consistency === 'match' ? 'ok' : 'flag'}">${
        finding.consistency === 'match'
          ? 'Consistent — preserve both'
          : 'Preserve both + flag mismatch'
      }</td>
      </tr>`
    )
    .join('');

  return `
    ${sectionHeading(
      `Recovered Image-Level AI Measurements${partCount > 1 ? ` (${part} of ${partCount})` : ''}`
    )}
    <table class="grid">
      <thead>
        <tr>
          <th style="width:32%">Finding</th>
          <th style="width:16%">Image measurement</th>
          <th style="width:11%">Image score</th>
          <th style="width:20%">Narrative output</th>
          <th style="width:21%">CIAI action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${
      part === partCount
        ? `<p class="note">
      CIAI captures measurements visible at the image-analysis stage even when the generated narrative
      omits them. Image-level and narrative values remain separate audit fields until radiologist
      verification.
    </p>`
        : ''
    }
  `;
}


function renderEvidenceBody(finding: EvidenceFinding, studyInstanceUid: string) {
  const consistencyClass = finding.consistency === 'match' ? 'ok' : 'flag';
  const differenceText =
    finding.differenceMm === null
      ? 'Not comparable — only one layer measured'
      : `${finding.differenceMm} mm between image and narrative layers`;

  // Exactly the three images the analysis service returns, in the order the
  // format requires. There is deliberately no fourth panel: the service returns
  // no manual measurement, so a "human marking" panel could only be the AI's
  // own box drawn over the original and captioned as if a person had placed it.
  const panels: { label: string; image: string; caption: string; stage: string }[] = [
    {
      label: '1. Original diagnostic image',
      image: finding.originalImage,
      stage: 'stage-primary',
      caption: 'Unmodified frame at the AI-detected location. No overlay applied.',
    },
  ];

  if (finding.annotatedImage) {
    panels.push({
      label: '2. CIAI AI marking',
      image: finding.annotatedImage,
      stage: 'stage-compare',
      // The annotation is baked into this image by the analysis service. Drawing
      // our own caliper on top of it would double-annotate the same lesion.
      caption: `AI localization as returned by the analysis service. Image measurement: <b>${escapeHtml(
        finding.imageMeasurement.display
      )}</b>.`,
    });
  }

  if (finding.heatmapImage) {
    panels.push({
      label: `${finding.annotatedImage ? '3' : '2'}. Heatmap — final evidence layer`,
      image: finding.heatmapImage,
      stage: 'stage-compare',
      caption: 'Supports the finding. Does not replace the original DICOM image.',
    });
  }

  const [primary, ...rest] = panels;

  const renderPanel = (panel: typeof panels[number]) => `
    <div class="panel">
      <div class="panel-label">${panel.label}</div>
      <div class="stage ${panel.stage}">${renderFrame(panel.image, `${finding.name} — ${panel.label}`)}</div>
      <div class="caption">${panel.caption}</div>
    </div>`;

  return `
    <h2 class="finding">${escapeHtml(finding.findingId)} - ${escapeHtml(finding.name)}</h2>
    <div class="finding-meta">
      <span class="sev ${severityClass(finding.severity)}">${escapeHtml(finding.severity)}</span>
      &nbsp;&nbsp;<b>Image-supported measurement:</b> ${escapeHtml(
        finding.imageMeasurement.display
      )}
      &nbsp;&nbsp;|&nbsp;&nbsp;<b>Image AI score:</b> ${escapeHtml(
        formatConfidence(finding.imageScore)
      )}
      &nbsp;&nbsp;|&nbsp;&nbsp;<b>Location:</b> ${escapeHtml(finding.location || 'Not stated')}
    </div>

    ${renderPanel(primary)}
    ${rest.length ? `<div class="panel-row">${rest.map(renderPanel).join('')}</div>` : ''}

    <div class="verify-title">Clinical verification panel</div>
    <table class="verify">
      <tbody>
        <tr>
          <th>Image measurement</th><td>${escapeHtml(finding.imageMeasurement.display)}</td>
          <th>Image AI score</th><td>${escapeHtml(formatConfidence(finding.imageScore))}</td>
        </tr>
        <tr>
          <th>Narrative AI output</th><td>${escapeHtml(
            finding.narrativeMeasurement.display
          )} / ${escapeHtml(formatConfidence(finding.narrativeScore))}</td>
          <th>Consistency</th><td class="${consistencyClass}">${escapeHtml(
    CONSISTENCY_LABELS[finding.consistency]
  )}</td>
        </tr>
        <tr>
          <th>Difference</th><td>${escapeHtml(differenceText)}</td>
          <th>Series</th><td>${escapeHtml(finding.seriesLabel || 'Not stated')}</td>
        </tr>
        <tr>
          <th>Source frame reference</th><td>${escapeHtml(finding.frameKey || 'Not stated')}</td>
          <th>DICOM identifiers</th><td>Study ${escapeHtml(
            studyInstanceUid
          )}<br />Series ${escapeHtml(finding.seriesId || 'Not stated')}</td>
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
    ${
      finding.description
        ? `<p class="note"><b>AI description:</b> ${escapeHtml(finding.description)}</p>`
        : ''
    }
    ${
      finding.imageRegionName && finding.imageRegionName !== finding.name
        ? `<p class="note"><b>Image layer labelled this region:</b> ${escapeHtml(
            finding.imageRegionName
          )}</p>`
        : ''
    }
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
    evidence,
    study,
    logoUrl,
    includeNarrative = true,
    includeSpecificationAppendix = false,
  } = options;
  const generatedAt = options.generatedAt || new Date();
  const draftId = buildDraftId(payload, study.studyInstanceUid);
  const header = sheetHeader(logoUrl, draftId);

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

  if (measured.length) {
    const parts = chunkByHeight(measured, 46);
    parts.forEach((part, index) => {
      addSheet(
        renderMeasuredTableBody(part, index + 1, parts.length),
        `Measured findings${parts.length > 1 ? ` ${index + 1}/${parts.length}` : ''}`
      );
    });
  }

  if (reported.length) {
    const parts = chunkByHeight(reported, 54);
    parts.forEach((part, index) => {
      addSheet(
        renderReportedTableBody(part, index + 1, parts.length),
        `Reported findings${parts.length > 1 ? ` ${index + 1}/${parts.length}` : ''}`
      );
    });
  }

  // Evidence sections are reserved for findings there is something to verify.
  // Printing two pages of "Pending / Not measured" for a narrative-only finding
  // added length without adding anything a radiologist could check.
  if (measured.length) {
    const parts = chunkByHeight(measured, 40);
    parts.forEach((part, index) => {
      addSheet(
        renderMeasurementsBody(part, index + 1, parts.length),
        `Image-level measurements${parts.length > 1 ? ` ${index + 1}/${parts.length}` : ''}`
      );
    });
    measured.forEach(finding =>
      addSheet(
        renderEvidenceBody(finding, study.studyInstanceUid),
        `Finding ${finding.findingId || finding.name}`
      )
    );
  } else {
    addSheet(
      `${sectionHeading('Measured Findings')}
       <p class="note">No finding in this study carried a measurement recoverable from the image, so
       there is no evidence section to verify. The reported findings follow.</p>`,
      'Measured findings'
    );
  }

  if (includeNarrative && payload.report?.report_text) {
    splitReportSections(stripLowPriorityFindings(payload.report.report_text))
      .filter(
        section => !REPLACED_NARRATIVE_SECTIONS.some(pattern => pattern.test(section.title || ''))
      )
      .forEach(section => {
        const body = `
          <div class="narrative">
            ${section.title ? sectionHeading(section.title) : ''}
            ${renderSafeReportMarkdown(section.body)}
          </div>`;
        addSheet(body, section.title || 'Narrative report');
      });
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
