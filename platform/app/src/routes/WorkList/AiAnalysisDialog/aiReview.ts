/**
 * Radiologist review of the AI report (accept / reject) and the "AI report
 * opened" audit event, against teleapp's /audit routes
 * (ciai-tr-node-app docs/AUDIT_LOGGING_DESIGN.md §6, §8).
 *
 * A decision is saved first and shown after: the UI changes only once
 * POST /audit/review answers 200. "Viewed" is fire-and-forget.
 */

export type AiReviewDecision = 'accepted' | 'rejected';

export type AiReview = {
  event_id: string;
  decision: AiReviewDecision;
  user_id?: string;
  user_name?: string;
  decided_at: string;
  reason?: string | null;
  /** The decision this one replaced, when it was changed. */
  previous?: AiReviewDecision | null;
};

export type RejectReason = 'inaccurate' | 'missed_findings' | 'wrong_study_or_quality' | 'other';

export const REJECT_REASONS: { value: RejectReason; label: string }[] = [
  { value: 'inaccurate', label: 'Findings are inaccurate' },
  { value: 'missed_findings', label: 'Important findings missed' },
  { value: 'wrong_study_or_quality', label: 'Wrong study / poor image quality' },
  { value: 'other', label: 'Other' },
];

export const rejectReasonLabel = (reason?: string | null) =>
  REJECT_REASONS.find(option => option.value === reason)?.label || '';

/** Role that may accept or reject AI reports (and later finalise reports). */
export const DEFAULT_REVIEW_ROLE = 'admin-role';

export type ReviewApi = {
  /** teleapp base URL, e.g. "/teleapp". */
  nodeAppHost: string;
  /** "Bearer <token>". */
  authHeaders: string;
};

/** Headers teleapp's Keycloak check needs (realm = client id in this deployment). */
export function teleappHeaders(api: ReviewApi) {
  const clientId = (window as any).config?.oidc?.[0]?.client_id || '';
  return {
    Authorization: api.authHeaders,
    'Content-Type': 'application/json',
    ClientId: clientId,
    Realm: clientId,
  };
}

/** The signed-in user's Keycloak id, to show "by you". */
export function currentUserSub(): string {
  try {
    const oidc = (window as any).config?.oidc?.[0];
    const session = JSON.parse(
      sessionStorage.getItem(`oidc.user:${oidc?.authority}:${oidc?.client_id}`) || '{}'
    );
    return session?.profile?.sub || '';
  } catch {
    return '';
  }
}

/** Latest decision per study for the given UIDs (max 100); studies without one are absent. */
export async function fetchReviewStatus(
  api: ReviewApi,
  studyInstanceUids: string[],
  signal?: AbortSignal
): Promise<Record<string, AiReview>> {
  const ids = Array.from(new Set(studyInstanceUids.filter(Boolean))).slice(0, 100);
  if (!ids.length || !api.authHeaders) {
    return {};
  }
  const response = await fetch(
    `${api.nodeAppHost}/audit/review-status?study_ids=${encodeURIComponent(ids.join(','))}`,
    { headers: teleappHeaders(api), signal }
  );
  if (!response.ok) {
    throw new Error(`Review status: HTTP ${response.status}`);
  }
  const body = await response.json();
  return body?.data || {};
}

export type SubmitReviewResult = {
  kind: 'ok' | 'conflict' | 'locked' | 'forbidden' | 'invalid' | 'network';
  /** The decision as the server has it now (on ok, conflict and locked). */
  review?: AiReview | null;
  finalised?: boolean;
  /** What to tell the user when kind is not 'ok'. */
  message?: string;
};

/**
 * Saves a decision. `expectedEventId` is the decision the user was looking at
 * (null if none); if someone else decided meanwhile the server answers 409.
 */
export async function submitReview(
  api: ReviewApi,
  args: {
    studyInstanceUid: string;
    decision: AiReviewDecision;
    reason?: RejectReason | '';
    comment?: string;
    expectedEventId: string | null;
  }
): Promise<SubmitReviewResult> {
  let response: Response;
  try {
    response = await fetch(`${api.nodeAppHost}/audit/review`, {
      method: 'POST',
      headers: teleappHeaders(api),
      body: JSON.stringify({
        study_id: args.studyInstanceUid,
        decision: args.decision,
        reason: args.reason || undefined,
        comment: args.comment?.trim() || undefined,
        expected_event_id: args.expectedEventId,
      }),
    });
  } catch {
    return { kind: 'network', message: "Couldn't save the decision. Check the connection and retry." };
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.ok) {
    return { kind: 'ok', review: body?.current || null, finalised: Boolean(body?.finalised) };
  }
  if (response.status === 409) {
    const who = body?.current?.user_name || 'another radiologist';
    const what = body?.current?.decision === 'rejected' ? 'rejected' : 'accepted';
    return {
      kind: 'conflict',
      message: `This AI report was just ${what} by ${who}. Review the current decision before changing it.`,
      review: body?.current || null,
    };
  }
  if (response.status === 423) {
    return {
      kind: 'locked',
      message: 'The report is finalised, so the decision is locked.',
      review: body?.current || null,
    };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'forbidden', message: 'You are not allowed to accept or reject AI reports.' };
  }
  if (response.status === 400) {
    return { kind: 'invalid', message: body?.error || 'The decision is incomplete.' };
  }
  return { kind: 'network', message: "Couldn't save the decision. Retry in a moment." };
}

/** "AI report opened": once per browser session per study, fire-and-forget. */
export function sendViewedEvent(api: ReviewApi, studyInstanceUid: string) {
  if (!studyInstanceUid || !api.authHeaders) {
    return;
  }
  const key = `aiReportViewed:${studyInstanceUid}`;
  try {
    if (sessionStorage.getItem(key)) {
      return;
    }
    sessionStorage.setItem(key, '1');
  } catch {
    // storage blocked: still send, the server stores a retried event once anyway
  }
  try {
    const eventId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined;
    fetch(`${api.nodeAppHost}/audit/events`, {
      method: 'POST',
      keepalive: true,
      headers: teleappHeaders(api),
      body: JSON.stringify({ event_type: 'radiologist_viewed', study_id: studyInstanceUid, event_id: eventId }),
    }).catch(() => {});
  } catch {
    // never affects the UI
  }
}

/** "4:01 PM" today, "15 Oct, 4:01 PM" otherwise. */
export function formatDecisionTime(iso?: string) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date().toDateString() === date.toDateString();
  return today ? time : `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}
