/**
 * Patient clinical history, kept by teleapp in PostgreSQL across studies
 * (GET / POST /api/patients/:patientId/history, 2026-11-03). The lab and the
 * author come from the token on the server.
 */
import { ReviewApi, teleappHeaders } from '../../routes/WorkList/AiAnalysisDialog/aiReview';

export type BackgroundField = 'past_medical_history' | 'comorbidities' | 'allergies';

export const BACKGROUND_FIELDS: { key: BackgroundField; label: string }[] = [
  { key: 'past_medical_history', label: 'Past medical history' },
  { key: 'comorbidities', label: 'Comorbidities' },
  { key: 'allergies', label: 'Allergies' },
];

export type HistoryEntry = {
  history_id: number;
  study_id: string | null;
  clinical_notes: string | null;
  past_medical_history: string | null;
  comorbidities: string | null;
  allergies: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
};

export type PatientHistory = {
  patient_id: string;
  profile: { full_name: string | null; age: string | null; sex: string | null; created_at: string; updated_at: string } | null;
  background: Record<BackgroundField, { text: string; updated_at: string | null; updated_by_name: string | null }>;
  entries: HistoryEntry[];
  unchanged?: boolean;
};

export type HistoryInput = {
  full_name?: string;
  age?: string;
  sex?: string;
  study_id?: string;
  clinical_notes: string;
} & Record<BackgroundField, string>;

const url = (api: ReviewApi, patientId: string) =>
  `${api.nodeAppHost}/api/patients/${encodeURIComponent(patientId)}/history`;

async function readError(response: Response) {
  try {
    const body = await response.json();
    return body?.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function getPatientHistory(api: ReviewApi, patientId: string, signal?: AbortSignal): Promise<PatientHistory> {
  const response = await fetch(url(api, patientId), { headers: teleappHeaders(api), signal });
  if (!response.ok) {
    throw new Error(`The history could not be loaded (${await readError(response)})`);
  }
  return response.json();
}

export async function savePatientHistory(api: ReviewApi, patientId: string, input: HistoryInput): Promise<PatientHistory> {
  const response = await fetch(url(api, patientId), {
    method: 'POST',
    headers: teleappHeaders(api),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`The history could not be saved (${await readError(response)})`);
  }
  return response.json();
}

/** Notes older than this are not the current presentation. */
const CURRENT_NOTES_DAYS = 30;

/**
 * The clinical notes sent with an AI report request (1.6.39): the notes entered
 * for this study, else the latest notes if entered in the last 30 days. Only
 * the current presentation - an old "fall" in the past history must not turn
 * the head-injury reading on - so the background fields are not sent.
 */
export function clinicalHistoryText(history: PatientHistory, studyId?: string): string {
  const entries = (history?.entries || []).filter(entry => (entry.clinical_notes || '').trim());
  const own = entries.filter(entry => studyId && entry.study_id === studyId);
  const latest = [...entries].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const recent =
    latest && Date.now() - Date.parse(latest.created_at) <= CURRENT_NOTES_DAYS * 24 * 3600 * 1000 ? [latest] : [];
  return (own.length ? own : recent)
    .map(entry => (entry.clinical_notes || '').trim())
    .join(' ')
    .slice(0, 1500);
}

/** "B.SRINIVASA RAO 47Y/M" and "b. srinivasa rao" compare equal: age / sex suffix and punctuation ignored. */
export function sameName(left?: string | null, right?: string | null) {
  const key = (value?: string | null) =>
    (value || '')
      .replace(/\b\d+\s*(?:Y|YRS?|YEARS?|M|MONTHS?|W|WEEKS?|D|DAYS?)\s*[/_\s]\s*[MFO]\s*$/i, '')
      .replace(/[^A-Za-z0-9]+/g, '')
      .toUpperCase();
  return !key(left) || !key(right) || key(left) === key(right);
}
