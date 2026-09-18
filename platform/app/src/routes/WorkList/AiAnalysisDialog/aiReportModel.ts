/**
 * Data model for the AI analysis stream payload.
 *
 * The analyze endpoint returns two parallel descriptions of the same study:
 *
 *  - `findings_summary` — the narrative layer. One entry per reported finding,
 *    carrying a stable `finding_id` (BRN-M-01), region, severity and the
 *    measurement the narrative model wrote down.
 *  - `series_with_findings[].heatmaps[].anomaly_regions` — the image layer. The
 *    measurement and score recovered directly from pixel analysis, plus a
 *    normalised `bbox` locating it on the frame.
 *
 * Both layers are keyed on `frame_key`. They routinely disagree, and the report
 * format requires that disagreement to be preserved and flagged rather than
 * silently reconciled, so this module joins them without collapsing them.
 */

export type AiAnomalyRegion = {
  name?: string;
  confidence?: number;
  severity?: string;
  description?: string;
  size_estimate?: string;
  bbox?: number[];
};

export type AiHeatmap = {
  frame_key?: string;
  anomaly_regions?: AiAnomalyRegion[];
  original_image_b64?: string;
  heatmap_image_b64?: string;
  gemini_annotated_image_b64?: string;
  summary?: string;
  output_path?: string;
  gemini_annotated_output_path?: string;
  analysis_json_path?: string;
  /** Attached during collection so a heatmap can name its own series. */
  seriesId?: string;
  seriesLabel?: string;
  modality?: string;
  [key: string]: any;
};

export type AiFindingSummary = {
  finding_id?: string;
  region?: string;
  series?: string;
  modality?: string;
  name?: string;
  severity?: string;
  confidence?: number;
  location?: string;
  size_estimate?: string;
  description?: string;
  frame_key?: string;
};

export type AiCompletePayload = {
  study_id?: string;
  patient_info?: Record<string, any>;
  study_info?: Record<string, any>;
  series_with_findings?: any[];
  findings_summary?: AiFindingSummary[];
  total_series_analyzed?: number;
  total_frames_processed?: number;
  total_anomalies_found?: number;
  output_directory?: string;
  processing_errors?: string[];
  report?: {
    report_text?: string;
    output_path?: string;
    docx_output_path?: string;
    user_docx_output_path?: string;
    template_used?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export type Measurement = {
  /** Verbatim `size_estimate` from the payload. */
  raw: string;
  /** True when a millimetre value could be recovered. */
  measurable: boolean;
  /** Primary value in mm — the lower bound of a range. */
  mm: number | null;
  /** Upper bound in mm for ranges and second axis for `A x B` sizes. */
  mmMax: number | null;
  kind: 'single' | 'range' | 'product' | 'qualitative' | 'none';
  /** Presentation string: `15 mm (1.5 cm)`, or the raw text when qualitative. */
  display: string;
};

export type Consistency = 'match' | 'mismatch' | 'image-only' | 'narrative-only' | 'unmeasured';

export type EvidenceFinding = {
  findingId: string;
  name: string;
  region: string;
  severity: string;
  modality: string;
  seriesLabel: string;
  seriesId: string;
  location: string;
  description: string;
  frameKey: string;
  /** Name the image layer gave the region, when it differs from the narrative. */
  imageRegionName: string;
  imageMeasurement: Measurement;
  imageScore: number | null;
  narrativeMeasurement: Measurement;
  narrativeScore: number | null;
  consistency: Consistency;
  /** |image - narrative| in mm, when both layers measured. */
  differenceMm: number | null;
  bbox: number[] | null;
  originalImage: string;
  heatmapImage: string;
  annotatedImage: string;
  summary: string;
  /** False for normal-structure entries the models emit alongside findings. */
  isAnomaly: boolean;
};

export type SeverityCounts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

/** `size_estimate` values that carry no measurement at all. */
const NO_MEASUREMENT = /^(not measured|none|n\/?a|normal|unknown|not applicable|-{1,2})?$/i;

/** Values that describe a size in words rather than numbers. */
const QUALITATIVE_WORDS = /^(large|small|moderate|mild|tiny|massive|extensive|minimal)$/i;

function roundTo(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function trimNumber(value: number) {
  return String(roundTo(value, 1)).replace(/\.0$/, '');
}

function toMm(value: number, unit: string) {
  return /^cm$/i.test(unit) ? value * 10 : value;
}

/** Sub-centimetre sizes read better in mm alone than as `3 mm (0.3 cm)`. */
function formatMm(mm: number) {
  return mm >= 10 ? `${trimNumber(mm)} mm (${trimNumber(mm / 10)} cm)` : `${trimNumber(mm)} mm`;
}

function qualitativeMeasurement(raw: string): Measurement {
  return { raw, measurable: false, mm: null, mmMax: null, kind: 'qualitative', display: raw };
}

/**
 * Recovers a millimetre value from the free-text `size_estimate` the models
 * emit — `~1 cm`, `5-6 mm`, `~3.5 cm to 5 cm`, `~3.5 cm x 4 cm`, and so on.
 *
 * Percentages ("~50% of visible left hemisphere") and word sizes ("Large") are
 * real clinical content but are not measurements, so they are kept verbatim and
 * marked unmeasurable rather than being coerced into a number.
 */
export function parseMeasurement(raw?: string): Measurement {
  const text = (raw || '').trim();

  if (NO_MEASUREMENT.test(text)) {
    return { raw: text, measurable: false, mm: null, mmMax: null, kind: 'none', display: 'Not measured' };
  }

  if (QUALITATIVE_WORDS.test(text) || /%/.test(text) || /cannot be determined/i.test(text)) {
    return qualitativeMeasurement(text);
  }

  const tokens = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm)?/gi));
  if (!tokens.length) {
    return qualitativeMeasurement(text);
  }

  // A range may state its unit only once (`3.5 cm to 5 cm` but also `5-6 mm`),
  // so an explicit unit anywhere in the string applies to the bare numbers too.
  const explicitUnit = tokens.map(token => token[2]).filter(Boolean).pop();
  if (!explicitUnit) {
    return qualitativeMeasurement(text);
  }

  const values = tokens.map(token => toMm(Number(token[1]), token[2] || explicitUnit));
  const isProduct = /[x×]/i.test(text);

  if (values.length === 1) {
    const mm = roundTo(values[0]);
    return {
      raw: text,
      measurable: true,
      mm,
      mmMax: mm,
      kind: 'single',
      display: formatMm(mm),
    };
  }

  const low = roundTo(Math.min(...values));
  const high = roundTo(Math.max(...values));

  if (isProduct) {
    return {
      raw: text,
      measurable: true,
      mm: high,
      mmMax: high,
      kind: 'product',
      display: `${trimNumber(low)} × ${trimNumber(high)} mm`,
    };
  }

  return {
    raw: text,
    measurable: true,
    mm: low,
    mmMax: high,
    kind: 'range',
    display:
      high >= 10
        ? `${trimNumber(low)}–${trimNumber(high)} mm (${trimNumber(low / 10)}–${trimNumber(
            high / 10
          )} cm)`
        : `${trimNumber(low)}–${trimNumber(high)} mm`,
  };
}

/**
 * The models enumerate every structure they inspect, so `findings_summary`
 * mixes real anomalies with negative statements ("No skull fracture") and plain
 * anatomy inventory ("The left pons is visualized"). Roughly half the entries in
 * a normal study are the latter, which drowns the actual findings.
 *
 * These patterns identify the non-findings. Anything not matched is treated as
 * an anomaly, so an unfamiliar phrasing errs towards being shown rather than
 * hidden.
 */
const NEGATIVE_NAME = /^\s*(no|normal|unremarkable|negative)\b/i;

const NEGATIVE_BODY = new RegExp(
  [
    /^\s*normal\b/, // "Normal calvarium."
    /^\s*unremarkable\b/,
    /no\s+evidence/,
    /within\s+normal\s+limits/,
    /no\s+significant/,
    /no\s+acute/,
    /no\s+focal/,
    /not\s+identified/,
    /showing\s+(?:a\s+)?normal\s+\w+/,
    /^\s*(?:no|normal)\b/,
    /^the\s+image\s+shows\s+a\s+ct\s+scan/,
  ]
    .map(pattern => pattern.source)
    .join('|'),
  'i'
);

/**
 * Matches a description that is *entirely* a statement of normality, such as
 * "The cerebral cortex appears normal." A trailing clause stops the match, so
 * "Multiple calcifications are present, likely incidental." stays a finding.
 */
const NORMAL_STATEMENT =
  /^\s*(the\s+)?[^.]{0,70}?\s+(?:is|are|appears?|appear|remains?|remain)\s+(?:to\s+be\s+)?(?:present|visible|visualized|visualised|seen|identified|patent|preserved|unremarkable|intact(?:\s+and\s+well[-\s]defined)?|within\s+normal\s+limits|normal(?:\s+in\s+[a-z\s,]+)?)\s*\.?\s*$/i;

/** True when a finding reports something abnormal rather than a normal structure. */
export function isAnomalyFinding(finding: {
  severity?: string;
  name?: string;
  description?: string;
}) {
  if (['critical', 'high', 'medium'].includes((finding.severity || 'low').toLowerCase())) {
    return true;
  }

  const name = (finding.name || '').trim();
  const description = (finding.description || '').trim();

  if (NEGATIVE_NAME.test(name)) {
    return false;
  }

  if (description && NEGATIVE_BODY.test(description)) {
    return false;
  }

  return !NORMAL_STATEMENT.test(description) && !NORMAL_STATEMENT.test(name);
}

export function getAnomalyFindings<T extends { severity?: string; name?: string; description?: string }>(
  findings: T[]
): T[] {
  return findings.filter(isAnomalyFinding);
}

/**
 * Findings the models emit as background context rather than as something to
 * act on: physiologic calcifications, age-related atrophy, chronic white-matter
 * change, scanner artefact. They are real observations and belong in the
 * report, but listing them beside a brain mass at equal weight is what made the
 * findings table unreadable.
 */
const INCIDENTAL = new RegExp(
  [
    /calcification/,
    /atrophy/,
    /artifact|artefact/,
    /sinusitis|opacification/,
    /white\s+matter\s+change/,
    /ventriculomegaly|ventricular\s+enlargement/,
    /prominence|prominent/,
    /age[-\s]related/,
    /incidental/,
  ]
    .map(pattern => pattern.source)
    .join('|'),
  'i'
);

export type EvidenceTier = 'measured' | 'reported' | 'incidental';

export const TIER_LABELS: Record<EvidenceTier, string> = {
  measured: 'Measured',
  reported: 'Narrative only',
  incidental: 'Incidental',
};

/**
 * Sorts a finding by what a radiologist can actually do with it.
 *
 * `measured` is the only tier that can be verified against a picture — it has a
 * recovered millimetre value, a bounding box and a frame. `reported` is the
 * narrative model asserting something with no measurable evidence. `incidental`
 * is background. Severity does not decide this: the models rate almost
 * everything 95% confident, and two thirds of a study's findings land in "low".
 */
export function getEvidenceTier(finding: {
  imageMeasurement: Measurement;
  bbox: number[] | null;
  originalImage: string;
  name: string;
  description: string;
  severity: string;
}): EvidenceTier {
  if (finding.imageMeasurement.measurable && finding.bbox && finding.originalImage) {
    return 'measured';
  }

  const isMinor = ['low', 'medium'].includes((finding.severity || 'low').toLowerCase());
  if (isMinor && INCIDENTAL.test(`${finding.name} ${finding.description}`)) {
    return 'incidental';
  }

  return 'reported';
}

/** Words that carry no distinguishing meaning when matching two finding names. */
const NAME_NOISE = new Set([
  'the', 'a', 'an', 'of', 'in', 'and', 'with',
  'gland', 'region', 'area', 'areas', 'lobe',
  'image', 'imaging', 'scan', 'ct',
]);

/**
 * Collapses a finding name to a comparable key. "Pineal calcification" and
 * "Pineal gland calcification" reduce to the same key; so do "Artifact",
 * "Imaging Artifact" and "Image artifact".
 */
export function normalizeFindingKey(name?: string) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.replace(/(ies|s)$/, ''))
    .filter(word => word && !NAME_NOISE.has(word))
    .sort()
    .join(' ');
}

export type GroupedFinding = EvidenceFinding & {
  tier: EvidenceTier;
  /** How many raw entries collapsed into this one. */
  occurrences: number;
  /** Every frame the same finding was reported on. */
  frameKeys: string[];
  seriesLabels: string[];
  locations: string[];
};

function tierRank(tier: EvidenceTier) {
  return ['measured', 'reported', 'incidental'].indexOf(tier);
}

/**
 * Merges the same finding reported on different slices and series into one row.
 *
 * The analysis runs per frame, so a single lesion surfaces once per slice it
 * appears on — a printed report carried the same pineal calcification four
 * times and the same brain mass twice off one frame. Entries merge when their
 * names reduce to the same key and they share either a frame or a region; the
 * best-evidenced instance is kept and the rest become an occurrence count.
 */
export function groupEvidenceFindings(evidence: EvidenceFinding[]): GroupedFinding[] {
  const groups = new Map<string, GroupedFinding>();

  evidence.forEach(finding => {
    const tier = getEvidenceTier(finding);
    const nameKey = normalizeFindingKey(finding.name);
    // Region keeps genuinely different sites apart; the frame catches the case
    // where one frame yields two names for the same thing.
    const key = `${nameKey}::${(finding.region || finding.frameKey || '').toLowerCase()}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        ...finding,
        tier,
        occurrences: 1,
        frameKeys: finding.frameKey ? [finding.frameKey] : [],
        seriesLabels: finding.seriesLabel ? [finding.seriesLabel] : [],
        locations: finding.location ? [finding.location] : [],
      });
      return;
    }

    existing.occurrences += 1;
    if (finding.frameKey && !existing.frameKeys.includes(finding.frameKey)) {
      existing.frameKeys.push(finding.frameKey);
    }
    if (finding.seriesLabel && !existing.seriesLabels.includes(finding.seriesLabel)) {
      existing.seriesLabels.push(finding.seriesLabel);
    }
    if (finding.location && !existing.locations.includes(finding.location)) {
      existing.locations.push(finding.location);
    }

    // Promote the better-evidenced instance to be the one shown.
    const betterTier = tierRank(tier) < tierRank(existing.tier);
    const sameTierMoreSevere =
      tierRank(tier) === tierRank(existing.tier) &&
      compareSeverity(finding.severity, existing.severity) < 0;

    if (betterTier || sameTierMoreSevere) {
      const { occurrences, frameKeys, seriesLabels, locations } = existing;
      groups.set(key, { ...finding, tier, occurrences, frameKeys, seriesLabels, locations });
    }
  });

  return Array.from(groups.values()).sort((left, right) => {
    const byTier = tierRank(left.tier) - tierRank(right.tier);
    if (byTier !== 0) {
      return byTier;
    }

    const bySeverity = compareSeverity(left.severity, right.severity);
    if (bySeverity !== 0) {
      return bySeverity;
    }

    return left.findingId.localeCompare(right.findingId);
  });
}

/** Every reported anomaly, with image evidence attached wherever a frame resolved. */
export function buildAllFindingRecords(payload: AiCompletePayload | null) {
  return buildEvidenceFindings(payload, { requireEvidence: false }).filter(
    finding => finding.isAnomaly
  );
}

export function getTier(findings: GroupedFinding[], tier: EvidenceTier) {
  return findings.filter(finding => finding.tier === tier);
}

export function formatConfidence(confidence?: number | null) {
  if (confidence === null || confidence === undefined || Number.isNaN(Number(confidence))) {
    return 'Not scored';
  }

  const value = Number(confidence);
  const percent = value <= 1 ? value * 100 : value;
  return `${Math.round(percent)}%`;
}

/** Detects the encoding so JPEG originals are not mislabelled as PNG. */
export function getImageSrc(base64?: string) {
  if (!base64) {
    return '';
  }

  if (base64.startsWith('data:')) {
    return base64;
  }

  const mime = base64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${base64}`;
}

export function collectHeatmaps(payload: AiCompletePayload | null): AiHeatmap[] {
  if (!payload) {
    return [];
  }

  const direct: AiHeatmap[] = Array.isArray(payload.heatmaps) ? payload.heatmaps : [];
  const fromReport: AiHeatmap[] = Array.isArray(payload.report?.heatmaps)
    ? payload.report.heatmaps
    : [];
  const fromSeries: AiHeatmap[] = (payload.series_with_findings || []).flatMap(series => {
    const heatmaps: AiHeatmap[] = Array.isArray(series?.heatmaps) ? series.heatmaps : [];
    const modality = series?.modality_info?.modality || '';
    const description = series?.modality_info?.series_description || '';

    return heatmaps.map(heatmap => ({
      ...heatmap,
      seriesId: series?.series_id || '',
      modality,
      seriesLabel: [modality, description].filter(Boolean).join(' — '),
    }));
  });

  return [...direct, ...fromReport, ...fromSeries].filter(
    heatmap =>
      heatmap?.original_image_b64 ||
      heatmap?.heatmap_image_b64 ||
      heatmap?.gemini_annotated_image_b64
  );
}

function normalizeName(value?: string) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Scores how well an image-level region matches a narrative finding. Both
 * layers name the same lesion independently ("Right frontal lobe lesion" vs
 * "Right frontal lobe hyperdense lesion"), so shared words decide the pairing.
 */
function nameSimilarity(left?: string, right?: string) {
  const a = normalizeName(left);
  const b = normalizeName(right);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const aWords = new Set(a.split(' '));
  const bWords = b.split(' ');
  const shared = bWords.filter(word => aWords.has(word)).length;

  return shared / Math.max(aWords.size, bWords.length);
}

function compareSeverity(left: string, right: string) {
  const leftIndex = SEVERITY_ORDER.indexOf((left || 'low').toLowerCase());
  const rightIndex = SEVERITY_ORDER.indexOf((right || 'low').toLowerCase());
  return (leftIndex < 0 ? SEVERITY_ORDER.length : leftIndex) -
    (rightIndex < 0 ? SEVERITY_ORDER.length : rightIndex);
}

/** Midpoint of a measurement's interval — the value the two layers are compared on. */
function representativeMm(measurement: Measurement) {
  return ((measurement.mm as number) + (measurement.mmMax as number)) / 2;
}

/**
 * How far apart the two layers are, in mm, or null when only one of them
 * measured anything.
 *
 * Comparing interval midpoints rather than testing for overlap is what keeps
 * the verdict and the number in step. The previous rule called intervals that
 * merely touched — 35–50 mm against 50–70 mm — an agreement, so a finding could
 * report "Consistent" and "15 mm difference" in the same panel.
 */
export function getDifferenceMm(image: Measurement, narrative: Measurement) {
  if (!image.measurable || !narrative.measurable) {
    return null;
  }

  return roundTo(Math.abs(representativeMm(image) - representativeMm(narrative)));
}

/**
 * Tolerance scales with the size of the thing being measured: 2 mm of
 * disagreement is noise on a 5 cm mass and a doubling on a 2 mm calcification.
 */
function agreementToleranceMm(image: Measurement, narrative: Measurement) {
  const larger = Math.max(representativeMm(image), representativeMm(narrative));
  return Math.max(2, roundTo(larger * 0.15));
}

function classifyConsistency(image: Measurement, narrative: Measurement): Consistency {
  if (image.measurable && narrative.measurable) {
    const difference = getDifferenceMm(image, narrative) as number;
    return difference <= agreementToleranceMm(image, narrative) ? 'match' : 'mismatch';
  }

  if (image.measurable) {
    return 'image-only';
  }

  if (narrative.measurable) {
    return 'narrative-only';
  }

  return 'unmeasured';
}

export const CONSISTENCY_LABELS: Record<Consistency, string> = {
  match: 'Consistent',
  mismatch: 'Mismatch retained - verify',
  'image-only': 'Narrative omits measurement - verify',
  'narrative-only': 'Image layer omits measurement - verify',
  unmeasured: 'No measurement recovered',
};

/**
 * Joins the narrative findings to their image evidence.
 *
 * Only findings that resolve to a heatmap frame can be shown as evidence, since
 * the report format requires the original diagnostic image for every finding it
 * renders.
 */
export function buildEvidenceFindings(
  payload: AiCompletePayload | null,
  { requireEvidence = true }: { requireEvidence?: boolean } = {}
): EvidenceFinding[] {
  if (!payload) {
    return [];
  }

  const heatmaps = collectHeatmaps(payload);
  const heatmapsByFrame = new Map<string, AiHeatmap>();
  heatmaps.forEach(heatmap => {
    if (heatmap.frame_key && !heatmapsByFrame.has(heatmap.frame_key)) {
      heatmapsByFrame.set(heatmap.frame_key, heatmap);
    }
  });

  const summaries = payload.findings_summary || [];
  const evidence: EvidenceFinding[] = [];

  summaries.forEach(finding => {
    const heatmap = finding.frame_key ? heatmapsByFrame.get(finding.frame_key) : undefined;

    // The findings table has to account for every reported anomaly, including
    // the majority that never resolve to a frame; the evidence pages and the
    // viewer only want the ones there is a picture for.
    if (!heatmap && requireEvidence) {
      return;
    }

    const regions = heatmap?.anomaly_regions || [];
    const bestRegion = regions.reduce<{ region?: AiAnomalyRegion; score: number }>(
      (best, region) => {
        const score = nameSimilarity(region.name, finding.name);
        return score > best.score ? { region, score } : best;
      },
      { region: undefined, score: 0 }
    );

    // A single-region frame is unambiguous even when the two layers named the
    // lesion differently, so fall back to it rather than dropping the evidence.
    const region =
      bestRegion.score > 0 ? bestRegion.region : regions.length === 1 ? regions[0] : undefined;

    const imageMeasurement = parseMeasurement(region?.size_estimate);
    const narrativeMeasurement = parseMeasurement(finding.size_estimate);
    const consistency = classifyConsistency(imageMeasurement, narrativeMeasurement);
    const differenceMm = getDifferenceMm(imageMeasurement, narrativeMeasurement);

    evidence.push({
      findingId: finding.finding_id || '',
      name: finding.name || 'Unnamed finding',
      region: finding.region || '',
      severity: (finding.severity || 'low').toLowerCase(),
      modality: finding.modality || heatmap?.modality || '',
      seriesLabel: finding.series || heatmap?.seriesLabel || '',
      seriesId: heatmap?.seriesId || '',
      location: finding.location || '',
      description: finding.description || region?.description || '',
      frameKey: finding.frame_key || '',
      imageRegionName: region?.name || '',
      imageMeasurement,
      imageScore: region?.confidence ?? null,
      narrativeMeasurement,
      narrativeScore: finding.confidence ?? null,
      consistency,
      differenceMm,
      bbox: Array.isArray(region?.bbox) && region?.bbox.length === 4 ? region.bbox : null,
      originalImage: heatmap?.original_image_b64 || '',
      heatmapImage: heatmap?.heatmap_image_b64 || '',
      annotatedImage: heatmap?.gemini_annotated_image_b64 || '',
      summary: heatmap?.summary || '',
      isAnomaly: isAnomalyFinding(finding),
    });
  });

  return evidence.sort((left, right) => {
    const bySeverity = compareSeverity(left.severity, right.severity);
    if (bySeverity !== 0) {
      return bySeverity;
    }

    const byScore = (right.imageScore ?? 0) - (left.imageScore ?? 0);
    if (byScore !== 0) {
      return byScore;
    }

    return left.findingId.localeCompare(right.findingId);
  });
}

/** Findings the image layer actually measured — the report's headline count. */
export function getImageSupportedFindings(evidence: EvidenceFinding[]) {
  return evidence.filter(finding => finding.imageMeasurement.measurable);
}

export function summarizeSeverities(findings: { severity?: string }[]): SeverityCounts {
  return findings.reduce<SeverityCounts>(
    (counts, finding) => {
      const severity = (finding.severity || 'low').toLowerCase();
      if (severity in counts) {
        counts[severity] += 1;
      }
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

/** Spread of image-level measurements, shown on the report cover. */
export function getMeasurementRange(evidence: EvidenceFinding[]) {
  const values = getImageSupportedFindings(evidence).flatMap(finding =>
    [finding.imageMeasurement.mm, finding.imageMeasurement.mmMax].filter(
      (value): value is number => typeof value === 'number'
    )
  );

  if (!values.length) {
    return 'Not measured';
  }

  const low = Math.min(...values);
  const high = Math.max(...values);

  return low === high ? `${trimNumber(low)} mm` : `${trimNumber(low)}-${trimNumber(high)} mm`;
}

export function getMaxDifferenceMm(evidence: EvidenceFinding[]) {
  const differences = evidence
    .map(finding => finding.differenceMm)
    .filter((value): value is number => typeof value === 'number');

  return differences.length ? Math.max(...differences) : 0;
}

export function sortFindingsSummary(findings: AiFindingSummary[]) {
  return [...findings].sort((left, right) => {
    const bySeverity = compareSeverity(left.severity || '', right.severity || '');
    if (bySeverity !== 0) {
      return bySeverity;
    }

    return (right.confidence || 0) - (left.confidence || 0);
  });
}

export function formatDicomDate(date?: string) {
  if (!date || !/^\d{8}$/.test(date)) {
    return date || 'Not available';
  }

  return `${date.slice(6, 8)}-${date.slice(4, 6)}-${date.slice(0, 4)}`;
}

export { SEVERITY_ORDER, compareSeverity };
