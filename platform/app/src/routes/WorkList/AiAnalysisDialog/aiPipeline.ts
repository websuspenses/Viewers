import type { AiCompletePayload } from './aiReportModel';

/**
 * The AI pipeline runs server-side as soon as a study is uploaded. The worklist
 * only reads its state back from four study-level metadata flags and, once the
 * image analysis is done, asks the PACS to build the report.
 *
 *   analyzing ──► analyzed ──► queued ──► generating ──► ready
 *       │                          │           │
 *       ▼                          └───────────┴──► reportFailed
 *   analysisFailed
 */

export type AnalysisProgress = {
  status?: string;
  total?: number;
  analyzed?: number;
  skipped?: number;
  failed?: number;
  pending?: number;
  message?: string;
  [key: string]: any;
};

export type ReportProgress = {
  step?: number;
  total_steps?: number;
  status?: string;
  message?: string;
  [key: string]: any;
};

export type AiStudyFlags = {
  isMedGemmaAnalysisDone?: string;
  medGemmaAnalysisProgress?: string;
  isMedGemmaReportGenerated?: string;
  reportGenerationProgress?: string;
};

export type AiStage =
  | 'none'
  | 'analyzing'
  | 'analysisFailed'
  | 'analyzed'
  | 'queued'
  | 'generating'
  | 'reportFailed'
  | 'ready';

/** What the worklist has learned about a study since the row was fetched. */
export type AiLiveState = {
  analysisProgress?: AnalysisProgress | null;
  reportProgress?: ReportProgress | null;
  reportReady?: boolean;
  triggered?: boolean;
  error?: string;
};

export type AiStudyState = {
  stage: AiStage;
  analysis: AnalysisProgress | null;
  report: ReportProgress | null;
  error?: string;
};

export const ACTIVE_STAGES: AiStage[] = ['analyzing', 'queued', 'generating'];

export const STAGE_LABELS: Record<AiStage, string> = {
  none: 'Not analyzed',
  analyzing: 'Analyzing',
  analysisFailed: 'Analysis failed',
  analyzed: 'Analysis complete',
  queued: 'Report queued',
  generating: 'Generating report',
  reportFailed: 'Report failed',
  ready: 'AI report ready',
};

type NormalizedStatus = 'done' | 'failed' | 'running' | '';

export function isYes(value: unknown) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  return text === 'yes' || text === 'true';
}

export function normalizeStatus(status: unknown): NormalizedStatus {
  const text = String(status ?? '')
    .trim()
    .toLowerCase();
  if (!text) {
    return '';
  }
  if (['done', 'complete', 'completed', 'success', 'succeeded', 'finished'].includes(text)) {
    return 'done';
  }
  if (['error', 'failed', 'failure', 'cancelled', 'canceled'].includes(text)) {
    return 'failed';
  }
  return 'running';
}

/**
 * The PACS stores these values as JSON strings, and the report text inside them
 * arrives with markdown escapes such as `\—` that are not legal JSON escapes.
 * Legal escapes (including `\\`) are kept; an illegal one loses its backslash,
 * which is also what a markdown renderer would have done with it.
 */
export function repairJsonEscapes(text: string) {
  return text.replace(/\\(u[0-9a-fA-F]{4}|["\\/bfnrt])?/g, (match, escape) =>
    escape ? match : ''
  );
}

export function parseJsonLenient<T = any>(value: unknown): T | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    return value as T;
  }
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    try {
      return JSON.parse(repairJsonEscapes(value));
    } catch {
      return null;
    }
  }
}

export function parseAnalysisProgress(value: unknown) {
  return parseJsonLenient<AnalysisProgress>(value);
}

export function parseReportProgress(value: unknown) {
  return parseJsonLenient<ReportProgress>(value);
}

export function deriveAiState(flags: AiStudyFlags, live: AiLiveState = {}): AiStudyState {
  const analysis =
    live.analysisProgress !== undefined
      ? live.analysisProgress
      : parseAnalysisProgress(flags.medGemmaAnalysisProgress);
  const report =
    live.reportProgress !== undefined
      ? live.reportProgress
      : parseReportProgress(flags.reportGenerationProgress);
  const reportStatus = normalizeStatus(report?.status);
  const analysisStatus = normalizeStatus(analysis?.status);
  const state = (stage: AiStage, error?: string): AiStudyState => ({
    stage,
    analysis,
    report,
    error,
  });

  if (live.reportReady || isYes(flags.isMedGemmaReportGenerated) || reportStatus === 'done') {
    return state('ready');
  }
  if (live.error) {
    return state('reportFailed', live.error);
  }
  if (reportStatus === 'failed') {
    return state('reportFailed', report?.message || 'Report generation failed.');
  }
  if (reportStatus === 'running') {
    return state('generating');
  }
  if (live.triggered) {
    return state('queued');
  }
  if (isYes(flags.isMedGemmaAnalysisDone) || analysisStatus === 'done') {
    return state('analyzed');
  }
  if (analysisStatus === 'failed') {
    return state('analysisFailed', analysis?.message || 'Image analysis failed.');
  }
  if (analysisStatus === 'running') {
    return state('analyzing');
  }
  return state('none');
}

/** Frames accounted for, including the ones the model skipped or failed on. */
export function getAnalysisPercent(analysis: AnalysisProgress | null) {
  const total = Number(analysis?.total) || 0;
  if (normalizeStatus(analysis?.status) === 'done') {
    return 100;
  }
  if (!total) {
    return 0;
  }
  const processed =
    (Number(analysis?.analyzed) || 0) +
    (Number(analysis?.skipped) || 0) +
    (Number(analysis?.failed) || 0);
  return Math.min(100, Math.round((processed / total) * 100));
}

/** A running step counts as half done, so step 1 of 4 does not read as 25% finished. */
export function getReportPercent(report: ReportProgress | null) {
  if (normalizeStatus(report?.status) === 'done') {
    return 100;
  }
  const total = Number(report?.total_steps) || 0;
  const step = Number(report?.step) || 0;
  if (!total || !step) {
    return 0;
  }
  return Math.min(99, Math.round(((step - 0.5) / total) * 100));
}

export function describeAnalysis(analysis: AnalysisProgress | null) {
  if (!analysis) {
    return '';
  }
  const total = Number(analysis.total) || 0;
  const analyzed = Number(analysis.analyzed) || 0;
  const skipped = Number(analysis.skipped) || 0;
  const failed = Number(analysis.failed) || 0;
  const parts = [total ? `${analyzed} of ${total} frames analyzed` : `${analyzed} frames analyzed`];
  if (skipped) {
    parts.push(`${skipped} skipped`);
  }
  if (failed) {
    parts.push(`${failed} failed`);
  }
  return parts.join(' · ');
}

export function describeReportStep(report: ReportProgress | null) {
  if (!report) {
    return '';
  }
  const step = Number(report.step) || 0;
  const total = Number(report.total_steps) || 0;
  const position = step && total ? `Step ${step} of ${total}` : '';
  return [position, report.message].filter(Boolean).join(' — ');
}

// ---------------------------------------------------------------------------
// PACS endpoints
// ---------------------------------------------------------------------------

type RequestOptions = {
  baseUrl: string;
  studyInstanceUid: string;
  authHeaders?: string;
  signal?: AbortSignal;
};

function studyUrl(baseUrl: string, studyInstanceUid: string, path: string) {
  return `${baseUrl.replace(/\/?$/, '/')}studies/${encodeURIComponent(studyInstanceUid)}/${path}`;
}

async function pacsRequest(url: string, authHeaders: string | undefined, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(authHeaders ? { Authorization: authHeaders } : {}),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`Request failed with HTTP ${response.status}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  return response;
}

/** Reads one study metadata key; the PACS answers `{ "<key>": "<value>" }`. */
async function fetchMetadataValue(key: string, options: RequestOptions) {
  const response = await pacsRequest(
    studyUrl(options.baseUrl, options.studyInstanceUid, `metadata/${key}`),
    options.authHeaders,
    { signal: options.signal }
  );
  const body = parseJsonLenient<Record<string, unknown>>(await response.text());
  return body && typeof body === 'object' && key in body ? body[key] : body;
}

export async function triggerReportGeneration(options: RequestOptions) {
  const url = studyUrl(options.baseUrl, options.studyInstanceUid, 'generate-report');
  try {
    return await pacsRequest(url, options.authHeaders, {
      method: 'POST',
      signal: options.signal,
    });
  } catch (error) {
    // Some deployments expose the trigger as GET only.
    if ((error as { status?: number }).status === 405) {
      return pacsRequest(url, options.authHeaders, { signal: options.signal });
    }
    throw error;
  }
}

export async function fetchReportProgress(options: RequestOptions) {
  return parseReportProgress(await fetchMetadataValue('reportGenerationProgress', options));
}

export async function fetchAnalysisProgress(options: RequestOptions) {
  return parseAnalysisProgress(await fetchMetadataValue('medGemmaAnalysisProgress', options));
}

export async function fetchReportResult(options: RequestOptions): Promise<AiCompletePayload> {
  const payload = parseJsonLenient<AiCompletePayload>(
    await fetchMetadataValue('reportGenerationResult', options)
  );

  if (!payload || typeof payload !== 'object') {
    throw new Error('The AI report is empty or could not be read.');
  }
  if (normalizeStatus(payload.status) === 'failed') {
    throw new Error(payload.message || 'The AI report finished with an error.');
  }

  return payload;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Could not read the frame image.'));
    reader.readAsDataURL(blob);
  });
}

export type FrameImages = {
  original: string;
  heatmap: string;
  annotated: string;
};

async function fetchImageDataUrl(url: string, authHeaders?: string, signal?: AbortSignal) {
  const response = await pacsRequest(url, authHeaders, {
    signal,
    headers: { Accept: 'image/png,image/*' },
  });
  return blobToDataUrl(await response.blob());
}

/** A missing image is expected (not every frame has every layer), not an error. */
function optional(request: Promise<string>) {
  return request.catch(() => '');
}

/**
 * The stored report leaves every image out of `reportGenerationResult`; the
 * PACS keeps them on disk and serves them per frame from
 * `studies/{uid}/ai-image/{instanceId}/{original|heatmap|annotated}`.
 * `frame_key` is the Orthanc instance ID.
 *
 * The original falls back to Orthanc's own `/instances/{id}/preview` (one level
 * above the DICOMweb root) for PACS builds that predate the ai-image route.
 *
 * Data URIs rather than object URLs: the printed report, the DOC export and the
 * sandboxed beta viewer all embed images as HTML strings.
 */
export async function fetchFrameImages({
  baseUrl,
  studyInstanceUid,
  instanceId,
  authHeaders,
  signal,
}: {
  baseUrl: string;
  studyInstanceUid: string;
  instanceId: string;
  authHeaders?: string;
  signal?: AbortSignal;
}): Promise<FrameImages> {
  const imageUrl = (kind: keyof FrameImages) =>
    studyUrl(baseUrl, studyInstanceUid, `ai-image/${encodeURIComponent(instanceId)}/${kind}`);
  const orthancRoot = baseUrl.replace(/\/?$/, '/').replace(/dicom-web\/$/, '');
  const previewUrl = `${orthancRoot}instances/${encodeURIComponent(instanceId)}/preview`;

  const [original, heatmap, annotated] = await Promise.all([
    fetchImageDataUrl(imageUrl('original'), authHeaders, signal).catch(() =>
      fetchImageDataUrl(previewUrl, authHeaders, signal)
    ),
    optional(fetchImageDataUrl(imageUrl('heatmap'), authHeaders, signal)),
    optional(fetchImageDataUrl(imageUrl('annotated'), authHeaders, signal)),
  ]);

  return { original, heatmap, annotated };
}
