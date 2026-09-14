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
  CONSISTENCY_LABELS,
  EvidenceFinding,
  formatConfidence,
  formatDicomDate,
  getImageSrc,
  getImageSupportedFindings,
  getMaxDifferenceMm,
  getMeasurementRange,
  AiCompletePayload,
} from './aiReportModel';
import { escapeHtml, renderSafeReportMarkdown, splitReportSections } from './reportMarkdown';

export type ReportBuildOptions = {
  payload: AiCompletePayload;
  evidence: EvidenceFinding[];
  study: {
    studyInstanceUid: string;
    patientName?: string;
    description?: string;
    date?: string;
  };
  /** Absolute URL for the CIAI logo; embedded assets keep printing offline-safe. */
  logoUrl: string;
  /** Include the full narrative report after the evidence sheets. */
  includeNarrative?: boolean;
  generatedAt?: Date;
};

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
    --panel: #f0f6f9;
    --line: #dfe7ee;
    --muted: #667787;
    --ink: #1f2c38;
    --human: #00ffff;
    --ai: #ffe600;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #8f9aa5;
    color: var(--ink);
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
  }
  .sheet {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 8mm;
    padding: 12mm 14mm 16mm;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; margin-bottom: 0; }
  .sheet-body { flex: 1 1 auto; }

  .sheet-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12mm;
    border-bottom: 1px solid var(--line);
    padding-bottom: 4mm;
    margin-bottom: 6mm;
  }
  .sheet-header img { height: 11mm; width: auto; object-fit: contain; }
  .sheet-header .ident { text-align: right; line-height: 1.35; }
  .sheet-header .ident strong { display: block; font-size: 8pt; letter-spacing: 0.04em; color: var(--navy); }
  .sheet-header .ident span { font-size: 7.5pt; color: var(--muted); letter-spacing: 0.03em; }

  .sheet-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--line);
    margin-top: 6mm;
    padding-top: 3mm;
    color: var(--muted);
    font-size: 7.5pt;
  }

  .hero {
    background: var(--navy);
    color: #ffffff;
    padding: 16mm 12mm;
    margin-bottom: 10mm;
  }
  .hero h1 { margin: 0; font-size: 30pt; line-height: 1.12; letter-spacing: -0.01em; }
  .hero .pipeline { margin-top: 18mm; font-size: 11pt; color: #d6e2ee; }
  .cover-logo { text-align: center; margin-bottom: 8mm; }
  .cover-logo img { height: 13mm; width: auto; }
  .cover-tagline { color: var(--navy); font-size: 17pt; font-weight: bold; margin: 0 0 3mm; }
  .cover-lede { margin: 0 0 7mm; font-size: 9pt; }

  .tiles { display: flex; border: 1px solid var(--line); margin-bottom: 7mm; }
  .tile { flex: 1 1 0; background: var(--panel); text-align: center; padding: 4mm 2mm; border-right: 1px solid var(--line); }
  .tile:last-child { border-right: 0; }
  .tile .value { font-size: 17pt; font-weight: bold; color: var(--navy); }
  .tile .label { margin-top: 2mm; font-size: 6.5pt; font-weight: bold; letter-spacing: 0.05em; color: var(--muted); text-transform: uppercase; }

  .facts { font-size: 9pt; margin-bottom: 7mm; }
  .facts div { margin-bottom: 1mm; }
  .facts b { color: var(--navy); }

  h2.section { color: var(--navy); font-size: 15pt; margin: 0 0 4mm; }
  h2.finding { color: var(--navy); font-size: 19pt; margin: 0 0 2mm; line-height: 1.2; }
  .finding-meta { font-size: 9pt; color: var(--ink); margin-bottom: 5mm; }
  .finding-meta b { color: var(--navy); }
  .sev { display: inline-block; padding: 0.6mm 2mm; border-radius: 2px; font-size: 7.5pt; font-weight: bold; letter-spacing: 0.04em; text-transform: uppercase; color: #ffffff; }
  .sev-critical { background: #b3261e; }
  .sev-high { background: #c2610a; }
  .sev-medium { background: #8a6d00; }
  .sev-low { background: #4a6076; }

  table.grid { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.grid th { background: var(--navy); color: #ffffff; text-align: left; font-size: 7.5pt; letter-spacing: 0.05em; text-transform: uppercase; padding: 2.5mm; }
  table.grid td { border: 1px solid var(--line); padding: 2.5mm; vertical-align: top; }
  table.grid tr { page-break-inside: avoid; break-inside: avoid; }
  table.grid tbody tr:nth-child(even) td { background: #fafcfd; }
  .note { font-size: 8pt; color: var(--muted); margin-top: 4mm; }

  .panel { border: 1px solid var(--line); margin-bottom: 4mm; page-break-inside: avoid; break-inside: avoid; }
  .panel > .panel-label { background: var(--panel); color: var(--muted); font-size: 7.5pt; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; padding: 2mm 3mm; border-bottom: 1px solid var(--line); }
  .panel .stage { background: #000000; text-align: center; padding: 3mm; }
  .panel .caption { font-size: 7.5pt; color: var(--muted); padding: 2mm 3mm; border-top: 1px solid var(--line); }
  .panel .caption b { color: var(--ink); }
  .panel-row { display: flex; gap: 4mm; }
  .panel-row > .panel { flex: 1 1 0; min-width: 0; }

  .frame { position: relative; display: inline-block; max-width: 100%; line-height: 0; }
  .frame img { display: block; max-width: 100%; height: auto; }
  /* Caps keep a finding's evidence to two printed pages, matching the reference
     layout where only the verification panel continues overleaf. */
  .stage-primary .frame img { max-height: 68mm; }
  .stage-compare .frame img { max-height: 46mm; }
  .stage-support .frame img { max-height: 40mm; }
  .caliper-line { position: absolute; height: 2px; background: currentColor; }
  .caliper-tick { position: absolute; width: 2px; background: currentColor; }
  .caliper-label { position: absolute; transform: translate(-50%, -160%); background: #000000; color: #ffffff; font-size: 7pt; line-height: 1.5; padding: 0.4mm 1.6mm; white-space: nowrap; font-family: Helvetica, Arial, sans-serif; }
  .caliper-box { position: absolute; border: 1px dashed currentColor; }
  .human { color: var(--human); }
  .ai { color: var(--ai); }

  .verify-title { background: var(--navy); color: #ffffff; font-size: 8pt; font-weight: bold; letter-spacing: 0.07em; text-transform: uppercase; padding: 2.5mm 3mm; }
  table.verify { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; }
  table.verify tr { page-break-inside: avoid; break-inside: avoid; }
  table.verify th { background: var(--panel); color: var(--muted); font-weight: normal; text-align: left; width: 22%; padding: 2.2mm 3mm; border: 1px solid var(--line); }
  table.verify td { padding: 2.2mm 3mm; border: 1px solid var(--line); width: 28%; word-wrap: break-word; }
  .flag { color: #b3261e; font-weight: bold; }
  .ok { color: #1c6b3f; font-weight: bold; }

  .narrative h2 { color: var(--navy); font-size: 15pt; margin: 0 0 3mm; }
  .narrative h3 { color: var(--navy); font-size: 12pt; margin: 5mm 0 2mm; }
  .narrative h4 { color: var(--navy); font-size: 10pt; margin: 4mm 0 1.5mm; }
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

/**
 * Draws the caliper for a finding over its frame.
 *
 * `bbox` is normalised to the frame, so the overlay is positioned in percentages
 * and stays aligned at any print scale. The measurement label sits directly
 * above the caliper line, as the format requires.
 */
function renderCaliper(bbox: number[] | null, label: string, tone: 'human' | 'ai') {
  if (!bbox) {
    return '';
  }

  const [x0, y0, x1, y1] = bbox;
  const left = Math.min(x0, x1) * 100;
  const right = Math.max(x0, x1) * 100;
  const top = Math.min(y0, y1) * 100;
  const bottom = Math.max(y0, y1) * 100;
  const width = Math.max(right - left, 0.5);
  const centerY = (top + bottom) / 2;
  const centerX = (left + right) / 2;

  return `
    <span class="${tone}">
      <span class="caliper-box" style="left:${left}%;top:${top}%;width:${width}%;height:${Math.max(
    bottom - top,
    0.5
  )}%"></span>
      <span class="caliper-line" style="left:${left}%;top:${centerY}%;width:${width}%"></span>
      <span class="caliper-tick" style="left:${left}%;top:${centerY - 2}%;height:4%"></span>
      <span class="caliper-tick" style="left:${right}%;top:${centerY - 2}%;height:4%"></span>
      <span class="caliper-label" style="left:${centerX}%;top:${centerY}%">${escapeHtml(
    label
  )}</span>
    </span>
  `;
}

function renderFrame(image: string, alt: string, overlay = '') {
  if (!image) {
    return `<div style="color:#8fa2b3;font-size:8pt;padding:10mm 0">Image not returned by the analysis service.</div>`;
  }

  return `
    <span class="frame">
      <img src="${getImageSrc(image)}" alt="${escapeHtml(alt)}" />
      ${overlay}
    </span>
  `;
}

function sheetHeader(logoUrl: string, draftId: string) {
  return `
    <header class="sheet-header">
      <img src="${logoUrl}" alt="CIAI Cyber Intellectus" />
      <div class="ident">
        <strong>CIAI TELERADIOLOGY AI PART</strong>
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
      <span>CIAI TELERADIOLOGY AI PART - Team Draft</span>
      <span>${escapeHtml(sectionLabel)}</span>
    </footer>
  `;
}

/** Wraps sheet content with the running furniture. */
function makeSheet(body: string, sectionLabel: string, header: string) {
  return `
    <section class="sheet">
      ${header}
      <div class="sheet-body">${body}</div>
      ${sheetFooter(sectionLabel)}
    </section>
  `;
}

function renderCoverBody(options: ReportBuildOptions, draftId: string) {
  const { payload, evidence, study, logoUrl } = options;
  const imageSupported = getImageSupportedFindings(evidence);
  const patient = payload.patient_info || {};
  const studyInfo = payload.study_info || {};
  const maxDifference = getMaxDifferenceMm(evidence);

  const tiles: [string, string][] = [
    [String(imageSupported.length), 'Image-supported findings'],
    [getMeasurementRange(evidence), 'Recovered image measurements'],
    [`${maxDifference} mm`, 'Manual vs AI in draft'],
    [
      String(evidence.length),
      'Original + human + AI + heatmap',
    ],
  ];

  const patientLine = [
    patient.patient_name || study.patientName || 'Not available',
    patient.patient_sex || '',
    patient.patient_id ? `Patient ID ${patient.patient_id}` : '',
    `Study date ${formatDicomDate(studyInfo.study_date || study.date)}`,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join('&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;');

  return `
    <div class="hero">
      <h1>CIAI TELERADIOLOGY<br />AI PART</h1>
      <div class="pipeline">ORIGINAL IMAGE | HUMAN MARKING | CIAI AI | HEATMAP | RADIOLOGIST VERIFY</div>
    </div>
    <div class="cover-logo"><img src="${logoUrl}" alt="CIAI Cyber Intellectus" /></div>
    <p class="cover-tagline">AI evidence should never hide the diagnostic image.</p>
    <p class="cover-lede">
      This report presents each finding as the original diagnostic image first, then the human/manual
      measurement, then the CIAI AI measurement, with the heatmap retained at the end as supporting
      evidence. The radiologist remains the final decision-maker.
    </p>
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
      <div><b>AI engines:</b> MedGemma + CIAI Model&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;Gemini + CIAI Model</div>
      <div><b>Patient:</b> ${patientLine}</div>
      <div><b>Study UID:</b> ${escapeHtml(study.studyInstanceUid)}</div>
      <div><b>Series analysed:</b> ${payload.total_series_analyzed ?? 0}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<b>Frames processed:</b> ${
    payload.total_frames_processed ?? 0
  }&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<b>Findings reported:</b> ${
    (payload.findings_summary || []).length
  }</div>
    </div>
    <h2 class="section">Report objective</h2>
    <p class="cover-lede">
      The viewer and report let a doctor open the exact DICOM slice, see it without overlays, toggle
      the lab/manual marking, toggle the CIAI AI marking, compare measurements and then inspect the
      heatmap. Image-level and narrative values remain separate audit fields until radiologist
      verification.
    </p>
  `;
}

/** Rows per measurements sheet — keeps the table from stranding a lone footer. */
const MEASUREMENT_ROWS_PER_SHEET = 14;

function renderMeasurementsBody(evidence: EvidenceFinding[], part: number, partCount: number) {
  const rows = evidence
    .map(
      finding => `
      <tr>
        <td>
          <b>${escapeHtml(finding.findingId)}</b> — ${escapeHtml(finding.name)}<br />
          <span style="color:#667787">${escapeHtml(finding.seriesLabel)}</span>
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
    <h2 class="section">Recovered Image-Level AI Measurements${
      partCount > 1 ? ` (${part} of ${partCount})` : ''
    }</h2>
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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function renderEvidenceBody(finding: EvidenceFinding, studyInstanceUid: string) {
  const humanLabel = finding.imageMeasurement.measurable
    ? finding.imageMeasurement.display
    : 'Pending';
  const aiLabel = finding.imageMeasurement.measurable
    ? finding.imageMeasurement.display
    : finding.narrativeMeasurement.display;

  // Panel 3 shows the AI marking; the raw heatmap is held back as the final
  // evidence layer whenever both renderings are available.
  const aiPanelImage = finding.annotatedImage || finding.heatmapImage;
  const heatmapIsSeparate = Boolean(finding.annotatedImage && finding.heatmapImage);

  const consistencyClass = finding.consistency === 'match' ? 'ok' : 'flag';
  const differenceText =
    finding.differenceMm === null
      ? 'Pending radiologist measurement'
      : `${finding.differenceMm} mm between image and narrative layers`;

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

    <div class="panel">
      <div class="panel-label">1. Original diagnostic image</div>
      <div class="stage stage-primary">${renderFrame(
        finding.originalImage,
        `${finding.name} original diagnostic image`
      )}</div>
      <div class="caption">Unmodified frame at the AI-detected location. No overlay applied.</div>
    </div>

    <div class="panel-row">
      <div class="panel">
        <div class="panel-label">2. Lab / human marking</div>
        <div class="stage stage-compare">${renderFrame(
          finding.originalImage,
          `${finding.name} manual marking`,
          renderCaliper(finding.bbox, humanLabel, 'human')
        )}</div>
        <div class="caption">Measurement above caliper: <b>${escapeHtml(humanLabel)}</b><br />
          Draft seeded from the image layer — awaiting radiologist caliper.</div>
      </div>
      <div class="panel">
        <div class="panel-label">3. CIAI AI marking${heatmapIsSeparate ? '' : ' + heatmap'}</div>
        <div class="stage stage-compare">${renderFrame(
          aiPanelImage,
          `${finding.name} CIAI AI marking`,
          renderCaliper(finding.bbox, aiLabel, 'ai')
        )}</div>
        <div class="caption">CIAI measurement above caliper: <b>${escapeHtml(aiLabel)}</b><br />
          ${
            heatmapIsSeparate
              ? 'Localization shown; heatmap retained below as final evidence layer.'
              : 'Heatmap/localization retained as final evidence layer.'
          }</div>
      </div>
    </div>

    ${
      heatmapIsSeparate
        ? `
    <div class="panel-row">
      <div class="panel">
        <div class="panel-label">4. Heatmap - final evidence layer</div>
        <div class="stage stage-support">${renderFrame(finding.heatmapImage, `${finding.name} heatmap`)}</div>
        <div class="caption">Supports the finding. Does not replace the original DICOM image.</div>
      </div>
      <div class="panel" style="border-color:transparent"></div>
    </div>`
        : ''
    }

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
          <th>Manual / lab draft value</th><td>${escapeHtml(humanLabel)}</td>
          <th>CIAI AI draft value</th><td>${escapeHtml(aiLabel)}</td>
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
          <th>Evidence order</th><td>Original -&gt; Human -&gt; CIAI -&gt; Heatmap</td>
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
    <h2 class="section">Final Team Draft - Build This Workflow</h2>
    <p class="cover-lede">This is the CIAI AI-part output structure this report implements.</p>
    <table class="grid">
      <thead>
        <tr><th style="width:26%">Stage</th><th>What must appear</th></tr>
      </thead>
      <tbody>
        ${WORKFLOW_STAGES.map(
          ([stage, detail]) =>
            `<tr><td><b>${escapeHtml(stage)}</b></td><td>${escapeHtml(detail)}</td></tr>`
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
  const { payload, evidence, study, logoUrl, includeNarrative = true } = options;
  const generatedAt = options.generatedAt || new Date();
  const draftId = buildDraftId(payload, study.studyInstanceUid);
  const header = sheetHeader(logoUrl, draftId);

  const sheets: string[] = [];
  const addSheet = (body: string, sectionLabel: string) => {
    sheets.push(makeSheet(body, sectionLabel, header));
  };

  // Cover carries the hero block instead of the running header band.
  sheets.push(
    `<section class="sheet">
      <div class="sheet-body">${renderCoverBody(options, draftId)}</div>
      ${sheetFooter(draftId)}
    </section>`
  );

  if (evidence.length) {
    const parts = chunk(evidence, MEASUREMENT_ROWS_PER_SHEET);
    parts.forEach((part, index) => {
      addSheet(
        renderMeasurementsBody(part, index + 1, parts.length),
        `Image-level measurements${parts.length > 1 ? ` ${index + 1}/${parts.length}` : ''}`
      );
    });
    evidence.forEach(finding =>
      addSheet(
        renderEvidenceBody(finding, study.studyInstanceUid),
        `Finding ${finding.findingId || finding.name}`
      )
    );
  } else {
    addSheet(
      `<h2 class="section">Recovered Image-Level AI Measurements</h2>
       <p class="note">No finding in this study resolved to an image frame, so no image-supported
       evidence pages could be produced. The narrative report follows.</p>`,
      'Image-level measurements'
    );
  }

  if (includeNarrative && payload.report?.report_text) {
    const sections = splitReportSections(payload.report.report_text);
    sections.forEach(section => {
      const body = `
        <div class="narrative">
          ${section.title ? `<h3>${escapeHtml(section.title)}</h3>` : ''}
          ${renderSafeReportMarkdown(section.body)}
        </div>`;
      addSheet(body, section.title || 'Narrative report');
    });
  }

  addSheet(renderWorkflowBody(), 'Workflow specification');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>CIAI Teleradiology AI Report — ${escapeHtml(
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
