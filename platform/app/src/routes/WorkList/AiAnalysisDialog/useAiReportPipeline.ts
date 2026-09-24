import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AiCompletePayload } from './aiReportModel';
import {
  ACTIVE_STAGES,
  AiLiveState,
  AiStudyFlags,
  AiStudyState,
  deriveAiState,
  fetchAnalysisProgress,
  fetchFrameImages,
  FrameImages,
  fetchReportProgress,
  fetchReportResult,
  normalizeStatus,
  triggerReportGeneration,
} from './aiPipeline';

type PipelineStudy = AiStudyFlags & { studyInstanceUid: string };

type Options = {
  studies: PipelineStudy[];
  /** PACS DICOMweb root, e.g. `/pacs/dicom-web/`. */
  baseUrl?: string;
  authHeaders?: string;
  /** Ask the PACS for a report as soon as a study's image analysis finishes. */
  autoGenerate?: boolean;
  pollIntervalMs?: number;
};

const TRIGGERED_STORAGE_KEY = 'aiReportTriggeredStudies';
/** Report generation calls an LLM; a full page of finished studies should not start at once. */
const MAX_CONCURRENT_AUTO_REPORTS = 2;
/** A queued report whose progress never appears is treated as not started (~2 min). */
const MAX_EMPTY_QUEUED_POLLS = 30;
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

function readTriggered(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(TRIGGERED_STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function writeTriggered(triggered: Set<string>) {
  try {
    sessionStorage.setItem(TRIGGERED_STORAGE_KEY, JSON.stringify([...triggered]));
  } catch {
    // Storage is a convenience: without it a reload may re-request a report.
  }
}

/**
 * Tracks the automated AI pipeline for every study on the current worklist page.
 *
 * Row flags from `/allstudies` are the starting point; one shared poller then
 * follows every study that is still moving (analyzing, queued, generating), so
 * a page of 25 studies costs at most one request per active study per tick
 * rather than a timer per row. Polling pauses while the tab is hidden.
 */
export default function useAiReportPipeline({
  studies,
  baseUrl,
  authHeaders,
  autoGenerate = true,
  pollIntervalMs = 4000,
}: Options) {
  const [live, setLive] = useState<Record<string, AiLiveState>>({});
  const [triggered, setTriggered] = useState<Set<string>>(readTriggered);
  const resultCache = useRef(new Map<string, Promise<AiCompletePayload>>());
  const frameCache = useRef(new Map<string, Promise<FrameImages>>());
  const inFlight = useRef(new Set<string>());
  const emptyPolls = useRef(new Map<string, number>());
  const pollFailures = useRef(new Map<string, number>());

  const states = useMemo(() => {
    const next: Record<string, AiStudyState> = {};
    studies.forEach(study => {
      const uid = study.studyInstanceUid;
      if (uid) {
        next[uid] = deriveAiState(study, {
          ...live[uid],
          triggered: live[uid]?.triggered ?? triggered.has(uid),
        });
      }
    });
    return next;
  }, [studies, live, triggered]);

  const statesRef = useRef(states);
  statesRef.current = states;

  const patchLive = useCallback((uid: string, patch: AiLiveState) => {
    setLive(current => ({ ...current, [uid]: { ...current[uid], ...patch } }));
  }, []);

  const markTriggered = useCallback((uid: string, value: boolean) => {
    setTriggered(current => {
      const next = new Set(current);
      if (value) {
        next.add(uid);
      } else {
        next.delete(uid);
      }
      writeTriggered(next);
      return next;
    });
  }, []);

  const generateReport = useCallback(
    async (uid: string) => {
      if (!baseUrl || !authHeaders || inFlight.current.has(`trigger:${uid}`)) {
        return;
      }
      inFlight.current.add(`trigger:${uid}`);
      emptyPolls.current.delete(uid);
      pollFailures.current.delete(uid);
      resultCache.current.delete(uid);
      markTriggered(uid, true);
      patchLive(uid, {
        triggered: true,
        error: undefined,
        reportReady: false,
        reportProgress: null,
      });

      try {
        await triggerReportGeneration({ baseUrl, studyInstanceUid: uid, authHeaders });
      } catch (error) {
        patchLive(uid, {
          triggered: false,
          error: `Could not start report generation (${
            error instanceof Error ? error.message : 'unknown error'
          }).`,
        });
      } finally {
        inFlight.current.delete(`trigger:${uid}`);
      }
    },
    [authHeaders, baseUrl, markTriggered, patchLive]
  );

  const loadReportResult = useCallback(
    (uid: string, { force = false } = {}) => {
      if (!baseUrl) {
        return Promise.reject(new Error('The PACS URL is not configured.'));
      }
      if (force || !resultCache.current.has(uid)) {
        const request = fetchReportResult({ baseUrl, studyInstanceUid: uid, authHeaders });
        // A failed load must not stick: the next open should try again.
        request.catch(() => resultCache.current.delete(uid));
        resultCache.current.set(uid, request);
      }
      return resultCache.current.get(uid) as Promise<AiCompletePayload>;
    },
    [authHeaders, baseUrl]
  );

  const loadFrameImages = useCallback(
    (studyInstanceUid: string, instanceId: string) => {
      if (!baseUrl) {
        return Promise.reject(new Error('The PACS URL is not configured.'));
      }
      const key = `${studyInstanceUid}:${instanceId}`;
      if (!frameCache.current.has(key)) {
        const request = fetchFrameImages({ baseUrl, studyInstanceUid, instanceId, authHeaders });
        // A frame without its AI layers is not cached: the PACS may not serve
        // them yet (route not deployed, report still writing its PNGs), and a
        // cached miss would hide them until the page is reloaded.
        request
          .then(images => {
            if (!images.heatmap && !images.annotated) {
              frameCache.current.delete(key);
            }
          })
          .catch(() => frameCache.current.delete(key));
        frameCache.current.set(key, request);
      }
      return frameCache.current.get(key) as Promise<FrameImages>;
    },
    [authHeaders, baseUrl]
  );

  // Start reports for studies whose analysis has finished, a few at a time.
  useEffect(() => {
    if (!autoGenerate || !baseUrl || !authHeaders) {
      return;
    }
    const values = Object.entries(states);
    let slots =
      MAX_CONCURRENT_AUTO_REPORTS -
      values.filter(([, state]) => state.stage === 'queued' || state.stage === 'generating').length;

    for (const [uid, state] of values) {
      if (slots <= 0) {
        break;
      }
      if (state.stage === 'analyzed' && !triggered.has(uid)) {
        slots -= 1;
        generateReport(uid);
      }
    }
  }, [authHeaders, autoGenerate, baseUrl, generateReport, states, triggered]);

  const hasActiveStudies = Object.values(states).some(state =>
    ACTIVE_STAGES.includes(state.stage)
  );

  useEffect(() => {
    if (!hasActiveStudies || !baseUrl || !authHeaders) {
      return;
    }
    const controller = new AbortController();

    const pollStudy = async (uid: string, state: AiStudyState) => {
      const key = `poll:${uid}`;
      if (inFlight.current.has(key) || inFlight.current.has(`trigger:${uid}`)) {
        return;
      }
      inFlight.current.add(key);
      const request = { baseUrl, studyInstanceUid: uid, authHeaders, signal: controller.signal };

      try {
        if (state.stage === 'analyzing') {
          patchLive(uid, { analysisProgress: await fetchAnalysisProgress(request) });
        } else {
          const reportProgress = await fetchReportProgress(request);
          const status = normalizeStatus(reportProgress?.status);

          if (!reportProgress && state.stage === 'queued') {
            const count = (emptyPolls.current.get(uid) || 0) + 1;
            emptyPolls.current.set(uid, count);
            if (count >= MAX_EMPTY_QUEUED_POLLS) {
              markTriggered(uid, false);
              patchLive(uid, {
                triggered: false,
                error: 'Report generation did not start. Try again.',
              });
            }
          } else {
            emptyPolls.current.delete(uid);
            patchLive(uid, { reportProgress, reportReady: status === 'done' });
            if (status === 'done' || status === 'failed') {
              markTriggered(uid, false);
            }
          }
        }
        pollFailures.current.delete(uid);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const failures = (pollFailures.current.get(uid) || 0) + 1;
        pollFailures.current.set(uid, failures);
        if (failures >= MAX_CONSECUTIVE_POLL_FAILURES && state.stage !== 'analyzing') {
          markTriggered(uid, false);
          patchLive(uid, {
            triggered: false,
            error: `Lost track of report progress (${
              error instanceof Error ? error.message : 'network error'
            }).`,
          });
        }
      } finally {
        inFlight.current.delete(key);
      }
    };

    const tick = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      Object.entries(statesRef.current).forEach(([uid, state]) => {
        if (ACTIVE_STAGES.includes(state.stage)) {
          pollStudy(uid, state);
        }
      });
    };

    tick();
    const intervalId = window.setInterval(tick, pollIntervalMs);
    document.addEventListener('visibilitychange', tick);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [authHeaders, baseUrl, hasActiveStudies, markTriggered, patchLive, pollIntervalMs]);

  const getState = useCallback(
    (uid: string): AiStudyState =>
      statesRef.current[uid] || { stage: 'none', analysis: null, report: null },
    []
  );

  return { states, getState, generateReport, loadReportResult, loadFrameImages };
}
