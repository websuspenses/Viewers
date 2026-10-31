/**
 * The three-panel finding block (client requirement 2026-10-30, ai-analysis
 * docs/TODO.md §6) and the status badges that replace the study review's long
 * "[Verify: …]" notes in the finding rows.
 *
 *  1. Original DICOM — the frame as the AI read it, no overlay.
 *  2. AI marking & measurements — every box on the frame in its status colour
 *     (blue: passed the automated checks; amber: pending verification),
 *     crosshairs, and the box's width and height in mm on dark pills.
 *  3. Heatmap — a blue-to-red glow centred on each box, at 45 % opacity.
 *
 * Panels 2 and 3 are drawn here over the one original image: the box colour
 * follows the study review, which only exists after the marking images were
 * made, and the report carries one picture per frame instead of two.
 *
 * Honest by construction (CLAUDE.md "Safety over completeness"): the mm values
 * are the AI's box measured from DICOM pixel spacing, an upper bound, not a
 * traced measurement; the heatmap is drawn from the box, not a model attention
 * map, which the models as deployed do not provide. The captions say so.
 */
import { getImageSrc } from './aiReportModel';
import { escapeHtml } from './reportMarkdown';

export const STATUS_COLORS = { confirmed: '#007AFF', pending: '#F59E0B' } as const;
export type FindingStatus = keyof typeof STATUS_COLORS;
export const STATUS_LABELS: Record<FindingStatus, string> = {
  confirmed: 'CONFIRMED',
  pending: 'PENDING VERIFICATION',
};

const VERIFY_PREFIX = /^\[Verify: ([^\]]*)\]\s*/;

export function findingStatus(finding: { description?: string }): FindingStatus {
  return VERIFY_PREFIX.test(finding.description || '') ? 'pending' : 'confirmed';
}

/** The study review's reasons, in full (for the verification notes). */
export function verifyReasons(description?: string): string[] {
  const match = (description || '').match(VERIFY_PREFIX);
  return match
    ? match[1]
        .split('; ')
        .map(reason => reason.trim())
        .filter(Boolean)
    : [];
}

/** The finding's own description without the review's note. */
export function plainDescription(description?: string): string {
  return (description || '').replace(VERIFY_PREFIX, '');
}

// One short phrase per review reason, in plain words, for the badge. Order
// matters: the first pattern that matches a reason names it.
const SHORT_REASONS: [RegExp, string][] = [
  [/possible haemorrhage/i, 'possible haemorrhage'],
  [/could not be measured/i, 'density not measured'],
  [/likely bone|bone read as|bone-dense|touches the skull|on skull bone/i, 'possibly bone'],
  [/not located on the image/i, 'not found on the image'],
  [/not marked on any image/i, 'not marked on an image'],
  [/calcium-dense|calcium density \(no pixel/i, 'no calcium density'],
  [/likely a calcification/i, 'likely calcification'],
  [/single slice/i, 'one slice only'],
  [/outermost slice|top of the head|skull base/i, 'edge of the scan'],
  [/both sides/i, 'seen on both sides'],
  [/opposite appearance|does not match the described appearance/i, 'contradictory description'],
  [/large part of the image/i, 'box covers most of the image'],
  [/side in the finding/i, 'side does not match'],
  [/AI confidence below/i, 'low AI confidence'],
  [/MRI sequence/i, 'not assessable on this sequence'],
  [/same box was marked/i, 'box shared with another finding'],
  [/much larger than the AI size estimate/i, 'loose box'],
  [/most slices of the series/i, 'reported on most slices'],
  [/mostly air/i, 'air in the box'],
  [/denser than blood or brain/i, 'denser than blood'],
  [/same spot as another finding/i, 'same spot as another finding'],
];

export function shortReasons(description?: string): string[] {
  const out: string[] = [];
  verifyReasons(description).forEach(reason => {
    const match = SHORT_REASONS.find(([pattern]) => pattern.test(reason));
    const label = match ? match[1] : 'needs checking';
    if (!out.includes(label)) {
      out.push(label);
    }
  });
  // A possible haemorrhage already says there is no calcium density (results
  // before 1.6.24 wrote that reason in two parts).
  return out.includes('possible haemorrhage')
    ? ['possible haemorrhage', ...out.filter(label => label !== 'possible haemorrhage' && label !== 'no calcium density')]
    : out;
}

/** Status badge plus, for a pending finding, its short reasons. */
export function statusBadgeHtml(finding: { description?: string }) {
  const status = findingStatus(finding);
  const reasons = status === 'pending' ? shortReasons(finding.description) : [];
  return `<span class="fp-status fp-status-${status}">${STATUS_LABELS[status]}</span>${
    reasons.length ? ` <span class="fp-reason">${escapeHtml(reasons.join(', '))}</span>` : ''
  }`;
}

export type PanelFinding = {
  name: string;
  description?: string;
  /** Normalised [y_min, x_min, y_max, x_max] on the original image. */
  bbox: number[] | null;
  /** Width and height of the box in mm (DICOM pixel spacing), or null. */
  boxMm: number[] | null;
};

export type PanelMeta = {
  orientation?: { top?: string; bottom?: string; left?: string; right?: string } | null;
  sliceLabel?: string;
  seriesLabel?: string;
};

const pct = (value: number) => `${(Math.max(0, Math.min(1, value)) * 100).toFixed(2)}%`;
const mm = (value: number) => (value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10));

function validBox(box: number[] | null): box is number[] {
  return (
    Array.isArray(box) &&
    box.length === 4 &&
    box.every(value => typeof value === 'number' && Number.isFinite(value)) &&
    box[2] > box[0] &&
    box[3] > box[1]
  );
}

/** Intersection over union of two normalised boxes. */
function overlap(a: number[], b: number[]) {
  const height = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const width = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const shared = height * width;
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - shared;
  return union > 0 ? shared / union : 0;
}

function orientationHtml(meta: PanelMeta) {
  const letters = meta.orientation || {};
  return (['top', 'bottom', 'left', 'right'] as const)
    .filter(edge => letters[edge])
    .map(edge => `<span class="fp-orient fp-orient-${edge}">${escapeHtml(String(letters[edge]))}</span>`)
    .join('');
}

function cornersHtml(meta: PanelMeta) {
  return [
    meta.sliceLabel ? `<span class="fp-corner fp-corner-bl">${escapeHtml(meta.sliceLabel)}</span>` : '',
    meta.seriesLabel ? `<span class="fp-corner fp-corner-br">${escapeHtml(meta.seriesLabel)}</span>` : '',
  ].join('');
}

function markingHtml(finding: PanelFinding, withSizes: boolean) {
  const box = finding.bbox as number[];
  const [y0, x0, y1, x1] = box;
  const color = STATUS_COLORS[findingStatus(finding)];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const parts = [
    `<span class="fp-box" style="left:${pct(x0)};top:${pct(y0)};width:${pct(x1 - x0)};height:${pct(
      y1 - y0
    )};border-color:${color}"></span>`,
    // Crosshairs across the box: the lines the width and height are read on.
    `<span class="fp-cross fp-cross-h" style="left:${pct(x0)};width:${pct(x1 - x0)};top:${pct(cy)}"></span>`,
    `<span class="fp-cross fp-cross-v" style="top:${pct(y0)};height:${pct(y1 - y0)};left:${pct(cx)}"></span>`,
  ];
  const extent = (finding.boxMm || []).filter(value => typeof value === 'number' && value > 0);
  if (withSizes && extent.length === 2) {
    const [width, height] = extent;
    // Width beside the box (left of it near the right edge), height above it
    // (below it near the top), so the pills stay on the image.
    const widthStyle =
      x1 > 0.78
        ? `right:${pct(1 - x0)};top:${pct(cy)};transform:translate(-4px,-50%)`
        : `left:${pct(x1)};top:${pct(cy)};transform:translate(4px,-50%)`;
    const heightStyle =
      y0 < 0.12
        ? `left:${pct(cx)};top:${pct(y1)};transform:translate(-50%,4px)`
        : `left:${pct(cx)};bottom:${pct(1 - y0)};transform:translate(-50%,-4px)`;
    parts.push(
      `<span class="fp-pill" style="${widthStyle}">${mm(width)} mm</span>`,
      `<span class="fp-pill" style="${heightStyle}">${mm(height)} mm</span>`
    );
  }
  return parts.join('');
}

function heatHtml(finding: PanelFinding) {
  const [y0, x0, y1, x1] = finding.bbox as number[];
  // Twice the box (at least 8 % of the image), so the glow reaches past it.
  const width = Math.max(0.08, (x1 - x0) * 2);
  const height = Math.max(0.08, (y1 - y0) * 2);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return `<span class="fp-heat" style="left:${pct(cx - width / 2)};top:${pct(cy - height / 2)};width:${pct(
    width
  )};height:${pct(height)}"></span>`;
}

/**
 * The three panels for one frame. `findings`: every finding marked on it.
 * Returns "" when there is no original image or no usable box, so the caller
 * can fall back to the server's marking images (results before 1.6.22).
 */
export function renderFindingPanelsHtml(
  findings: PanelFinding[],
  originalImage: string,
  meta: PanelMeta,
  altText: string
) {
  // One box per place: findings sharing a box (two names for one spot) are
  // drawn once, in the first one's status colour, so their pills do not stack.
  const boxed: PanelFinding[] = [];
  findings.forEach(finding => {
    if (validBox(finding.bbox) && !boxed.some(drawn => overlap(drawn.bbox as number[], finding.bbox as number[]) >= 0.5)) {
      boxed.push(finding);
    }
  });
  if (!originalImage || !boxed.length) {
    return '';
  }
  // Raw base64 from a stored result, or a data URL from the frame fetch.
  const image = `<img src="${escapeHtml(getImageSrc(originalImage))}" alt="${escapeHtml(altText)}" />`;
  const frame = (overlay: string) =>
    `<div class="fp-frame">${image}${overlay}${orientationHtml(meta)}${cornersHtml(meta)}</div>`;
  const panel = (label: string, overlay: string, caption: string) => `
    <div class="fp-panel">
      <div class="fp-label">${label}</div>
      <div class="fp-stage">${frame(overlay)}</div>
      <div class="fp-caption">${caption}</div>
    </div>`;
  const statuses = new Set(boxed.map(findingStatus));
  const legend = (['confirmed', 'pending'] as const)
    .filter(status => statuses.has(status))
    .map(
      status =>
        `<span class="fp-swatch" style="border-color:${STATUS_COLORS[status]}"></span>${
          status === 'confirmed' ? 'confirmed by the automated checks' : 'pending verification'
        }`
    )
    .join(' &nbsp; ');
  return `
    <div class="fp-row">
      ${panel('1. Original DICOM', '', 'The frame as the AI read it. No overlay.')}
      ${panel(
        '2. AI marking &amp; measurements',
        // Sizes on the first finding's box only: pills of neighbouring boxes
        // would cover each other (every size is in the table above).
        boxed.map((finding, index) => markingHtml(finding, index === 0)).join(''),
        `${legend}. Sizes are the AI's box from DICOM pixel spacing, not a traced measurement.`
      )}
      ${panel(
        '3. Heatmap',
        boxed.map(heatHtml).join(''),
        'Drawn from the AI box to show where it points; not a model attention map.'
      )}
    </div>`;
}

/** Styles for the panels and badges (print and screen). */
export const FINDING_PANEL_CSS = `
  .fp-row { display: flex; gap: 2.5mm; margin-bottom: 3mm; }
  .fp-panel { flex: 1 1 0; min-width: 0; border: 1px solid #d5e1e8; break-inside: avoid; page-break-inside: avoid; }
  .fp-label { background: #0b2a4a; color: #ffffff; font-size: 7pt; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; padding: 1.8mm 2.5mm; }
  .fp-stage { background: #000000; display: flex; align-items: center; justify-content: center; padding: 1.5mm; min-height: calc(var(--fp-img, 58mm) + 3mm); }
  .fp-frame { position: relative; display: inline-block; max-width: 100%; line-height: 0; }
  .fp-frame img { display: block; max-width: 100%; max-height: var(--fp-img, 58mm); height: auto; }
  .fp-box { position: absolute; border: 2px solid #007AFF; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fp-cross { position: absolute; border-color: rgba(255, 255, 255, 0.85); border-style: dashed; border-width: 0; }
  .fp-cross-h { border-top-width: 1px; height: 0; }
  .fp-cross-v { border-left-width: 1px; width: 0; }
  .fp-pill { position: absolute; background: rgba(0, 0, 0, 0.7); color: #ffffff; font: bold 6.5pt/1.25 Arial, Helvetica, sans-serif; padding: 0.4mm 1.4mm; border-radius: 1.2mm; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fp-heat { position: absolute; border-radius: 50%; opacity: 0.45; background: radial-gradient(closest-side, #ff0000 0%, #ffcc00 35%, #00d0ff 70%, rgba(0, 0, 255, 0) 100%); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fp-orient { position: absolute; color: #ffffff; font: bold 7pt/1 Arial, Helvetica, sans-serif; text-shadow: 0 0 2px #000000; }
  .fp-orient-top { top: 1mm; left: 50%; transform: translateX(-50%); }
  .fp-orient-bottom { bottom: 1mm; left: 50%; transform: translateX(-50%); }
  .fp-orient-left { left: 1mm; top: 50%; transform: translateY(-50%); }
  .fp-orient-right { right: 1mm; top: 50%; transform: translateY(-50%); }
  .fp-corner { position: absolute; color: #ffffff; font: 6pt/1.2 Arial, Helvetica, sans-serif; text-shadow: 0 0 2px #000000; max-width: 38%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .fp-corner-bl { bottom: 1mm; left: 1mm; }
  .fp-corner-br { bottom: 1mm; right: 1mm; text-align: right; }
  .fp-caption { font-size: 6.5pt; color: #5b6b78; padding: 1.5mm 2.5mm; border-top: 1px solid #d5e1e8; line-height: 1.45; }
  .fp-swatch { display: inline-block; width: 2.6mm; height: 2.2mm; border: 2px solid; vertical-align: middle; margin-right: 1mm; }
  .fp-status { display: inline-block; padding: 0.4mm 1.6mm; border-radius: 1mm; font-size: 6.5pt; font-weight: bold; letter-spacing: 0.04em; color: #ffffff; white-space: nowrap; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fp-status-confirmed { background: #007AFF; }
  .fp-status-pending { background: #F59E0B; color: #1f1300; }
  .fp-reason { font-size: 7pt; font-weight: bold; color: #9a5b00; }
  .badge-line { margin-top: 0.6mm; }
`;
