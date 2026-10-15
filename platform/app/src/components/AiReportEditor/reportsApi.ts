/**
 * Data access for the AI report editor:
 * - teleapp /reports: versions (AI drafts + radiologist saves), docs §10
 * - the PACS: study details, and the legacy reportRaw / isReportGenerated /
 *   status writes the rest of the app still reads (same calls as GenerateReport)
 * - teleapp templates: the starting point when there is no usable AI draft
 */
import { ReviewApi, teleappHeaders } from '../../routes/WorkList/AiAnalysisDialog/aiReview';

export type AiDraftSection = { key: string; title: string; markdown: string };

export type ReportVersionMeta = {
  report_id: number;
  version: number;
  kind: 'ai_draft' | 'radiologist';
  status: 'draft' | 'final' | 'amended';
  based_on_report_id: number | null;
  edit_status: 'edited' | 'not_edited' | 'not_from_ai' | null;
  edit_percent: string | number | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
};

export type ReportsState = {
  study_id: string;
  latest_version: number;
  finalised: boolean;
  versions: ReportVersionMeta[];
  latest_ai_draft: {
    report_id: number;
    version: number;
    created_at: string;
    ai_version?: string | null;
    content: { markdown: string; sections: AiDraftSection[] };
  } | null;
  latest_radiologist: (ReportVersionMeta & { content: { html: string } }) | null;
};

export type FindingDecision = {
  name: string;
  severity?: string;
  modality?: string;
  flags?: string[];
  decision: 'kept' | 'removed';
};

export type SaveResult = {
  kind: 'ok' | 'unchanged' | 'conflict' | 'locked' | 'forbidden' | 'invalid' | 'network';
  version?: ReportVersionMeta;
  latestVersion?: number;
  message?: string;
};

export type StudyHeader = {
  patientName: string;
  patientId: string;
  patientAge: string;
  patientSex: string;
  studyDate: string;
  description: string;
  modalities: string;
  accession: string;
  referringPhysician: string;
};

const encode = encodeURIComponent;

export async function getReports(api: ReviewApi, studyUid: string, signal?: AbortSignal): Promise<ReportsState> {
  const response = await fetch(`${api.nodeAppHost}/reports/${encode(studyUid)}`, { headers: teleappHeaders(api), signal });
  if (!response.ok) {
    throw new Error(`Report versions could not be loaded (HTTP ${response.status})`);
  }
  return response.json();
}

export async function getReportVersion(api: ReviewApi, studyUid: string, version: number) {
  const response = await fetch(`${api.nodeAppHost}/reports/${encode(studyUid)}/versions/${version}`, {
    headers: teleappHeaders(api),
  });
  if (!response.ok) {
    throw new Error(`Version ${version} could not be loaded (HTTP ${response.status})`);
  }
  return response.json();
}

export async function saveReportVersion(
  api: ReviewApi,
  studyUid: string,
  body: { html: string; based_on_report_id: number | null; expected_version: number; findings: FindingDecision[] }
): Promise<SaveResult> {
  let response: Response;
  try {
    response = await fetch(`${api.nodeAppHost}/reports/${encode(studyUid)}`, {
      method: 'POST',
      headers: teleappHeaders(api),
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: 'network', message: "Couldn't save. Check the connection and retry — your text is kept on this device." };
  }
  let json: any = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (response.ok) {
    return json?.unchanged ? { kind: 'unchanged', latestVersion: json.version } : { kind: 'ok', version: json };
  }
  if (response.status === 409) {
    return {
      kind: 'conflict',
      latestVersion: json?.latest_version,
      message: `Someone saved version ${json?.latest_version} while you were editing. Your text is kept on this device — load the latest version to compare.`,
    };
  }
  if (response.status === 423) {
    return { kind: 'locked', message: 'This report is finalised and can no longer be edited.' };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'forbidden', message: 'You are not allowed to edit reports.' };
  }
  if (response.status === 400) {
    return { kind: 'invalid', message: json?.error || 'The report could not be saved.' };
  }
  return { kind: 'network', message: "Couldn't save. Retry in a moment — your text is kept on this device." };
}

/** Patient and study details for the page header and the PDF (QIDO-RS). */
export async function getStudyHeader(pacsBaseUrl: string, authHeaders: string, studyUid: string): Promise<StudyHeader | null> {
  const base = pacsBaseUrl.replace(/\/?$/, '/');
  const response = await fetch(
    `${base}studies?StudyInstanceUID=${encode(studyUid)}&includefield=00101010,00101040,00081030,00100040,00080090,00080061`,
    { headers: { Authorization: authHeaders, Accept: 'application/json' } }
  );
  if (!response.ok) {
    return null;
  }
  const [study] = (await response.json()) || [];
  if (!study) {
    return null;
  }
  const value = (tag: string) => {
    const entry = study[tag]?.Value?.[0];
    if (entry && typeof entry === 'object') {
      return entry.Alphabetic || '';
    }
    return entry == null ? '' : String(entry);
  };
  return {
    patientName: value('00100010').replace(/\^/g, ' ').trim(),
    patientId: value('00100020'),
    patientAge: value('00101010'),
    patientSex: value('00100040'),
    studyDate: value('00080020'),
    description: value('00081030'),
    modalities: (study['00080061']?.Value || []).join('/') || value('00080060'),
    accession: value('00080050'),
    referringPhysician: value('00080090').replace(/\^/g, ' ').trim(),
  };
}

/** The lab's template for a modality (HTML), or '' when it has none. */
export async function getLabTemplate(api: ReviewApi, modality: string): Promise<string> {
  const labId = sessionStorage.getItem('labId') || '';
  const shortModality = String(modality || '').replace(/\\/g, '-').slice(0, 2);
  if (!shortModality) {
    return '';
  }
  try {
    const response = await fetch(
      `${api.nodeAppHost}/read_study_template_for_generate/${encode(labId || '0')}/${encode(shortModality)}/s`,
      { headers: { ...teleappHeaders(api), isAccess: 'read_study_template_for_generate', labId } }
    );
    if (!response.ok) {
      return '';
    }
    const body = await response.json();
    return body?.data?.template_content || '';
  } catch {
    return '';
  }
}

/**
 * Same writes as the existing report editor's Submit (GenerateReport), so the
 * worklist, viewer and report PDF keep showing the report: reportRaw,
 * isReportGenerated and the study status.
 */
export async function writeLegacyReport(pacsBaseUrl: string, authHeaders: string, studyUid: string, html: string) {
  const base = pacsBaseUrl.replace(/\/?$/, '/');
  const post = (path: string, body: unknown) =>
    fetch(`${base}studies/${encode(studyUid)}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeaders },
      body: JSON.stringify(body),
    }).then(response => {
      if (!response.ok) {
        throw new Error(`${path}: HTTP ${response.status}`);
      }
    });
  await Promise.all([
    post('addmetadata/reportRaw', { data: html }),
    post('addmetadata/isReportGenerated', { data: 'true' }),
  ]);
  await post('update_status', { status: 'Report Generated' });
  sessionStorage.setItem('stuID', studyUid);
  sessionStorage.setItem('isReportGenerated', 'true');
}
