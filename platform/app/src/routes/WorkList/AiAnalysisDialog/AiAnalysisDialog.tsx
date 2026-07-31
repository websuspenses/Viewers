import React, { useEffect, useMemo, useRef, useState } from 'react';
import { styled } from '@mui/material/styles';
import Dialog, { DialogProps } from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionIcon from '@mui/icons-material/Description';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';

type AiProgressEvent = {
  step?: number;
  total_steps?: number;
  status?: string;
  message?: string;
  _receivedAt?: number;
  [key: string]: any;
};

type AiCompletePayload = {
  patient_info?: Record<string, any>;
  study_info?: Record<string, any>;
  series_with_findings?: any[];
  total_series_analyzed?: number;
  total_frames_processed?: number;
  total_anomalies_found?: number;
  processing_errors?: string[];
  report?: {
    report_text?: string;
    output_path?: string;
    docx_output_path?: string;
    user_docx_output_path?: string;
    [key: string]: any;
  };
  report_path?: string;
  docx_path?: string;
  user_docx_path?: string;
  [key: string]: any;
};

type AiHeatmap = {
  frame_key?: string;
  anomaly_regions?: any[];
  heatmap_image_b64?: string;
  gemini_annotated_image_b64?: string;
  summary?: string;
  output_path?: string;
  gemini_annotated_output_path?: string;
  [key: string]: any;
};

type AiDialogStatus = 'idle' | 'running' | 'completed' | 'warning' | 'unable' | 'failed';

type Props = {
  open: boolean;
  onClose: () => void;
  study: {
    studyInstanceUid: string;
    patientName?: string;
    description?: string;
    date?: string;
    time?: string;
    modalities?: string;
  };
  aiAnalysisHostURL?: string;
  authHeaders?: string;
};

type ParsedSseEvent = {
  event: string;
  data?: any;
  error?: Error;
  raw?: string;
};

const BootstrapDialog = styled(Dialog)<DialogProps>(() => ({
  '& .MuiPaper-root': {
    width: '980px',
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: 8,
    background: '#071118',
    color: '#eef7fb',
    border: '1px solid rgba(127, 202, 222, 0.16)',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.55)',
  },
  '& .MuiDialogContent-root': {
    padding: 0,
  },
  '& .MuiDialogActions-root': {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    padding: '14px 20px',
    background: '#08131a',
  },
  '@media (max-width: 720px)': {
    '& .MuiPaper-root': {
      margin: 0,
      width: '100%',
      maxWidth: '100%',
      height: '100%',
      maxHeight: '100%',
      borderRadius: 0,
    },
  },
})) as typeof Dialog;

const STATUS_LABELS: Record<AiDialogStatus, string> = {
  idle: 'Ready',
  running: 'Running',
  completed: 'Completed',
  warning: 'Completed with warnings',
  unable: 'Unable to analyze images',
  failed: 'Failed',
};

const STATUS_COLORS: Record<AiDialogStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> =
  {
    idle: 'default',
    running: 'primary',
    completed: 'success',
    warning: 'warning',
    unable: 'error',
    failed: 'error',
  };

const GPU_DOWN_MESSAGE =
  'AI image analysis could not be completed because the model service was unavailable. A report was generated from limited processing information and should not be treated as diagnostic.';

function parseSseEvents(bufferText: string): { events: ParsedSseEvent[]; remaining: string } {
  const normalized = bufferText.replace(/\r\n/g, '\n');
  const chunks = normalized.split('\n\n');
  const remaining = chunks.pop() || '';
  const events: ParsedSseEvent[] = [];

  chunks.forEach(chunk => {
    const lines = chunk.split('\n').filter(Boolean);
    let event = 'message';
    const dataLines: string[] = [];

    lines.forEach(line => {
      if (line.startsWith(':')) {
        return;
      }

      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
        return;
      }

      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    });

    if (!dataLines.length) {
      return;
    }

    const raw = dataLines.join('\n');
    try {
      events.push({ event, data: JSON.parse(raw), raw });
    } catch (error) {
      events.push({
        event: 'parse_error',
        error: error instanceof Error ? error : new Error('Unable to parse stream payload'),
        raw,
      });
    }
  });

  return { events, remaining };
}

async function startAiAnalysisStream({
  studyInstanceUid,
  aiAnalysisHostURL,
  authHeaders,
  signal,
  onProgress,
  onComplete,
  onError,
  onHeartbeat,
}: {
  studyInstanceUid: string;
  aiAnalysisHostURL: string;
  authHeaders?: string;
  signal: AbortSignal;
  onProgress: (event: AiProgressEvent) => void;
  onComplete: (payload: AiCompletePayload) => void;
  onError: (error: Error) => void;
  onHeartbeat: () => void;
}) {
  const endpoint = `${aiAnalysisHostURL.replace(/\/$/, '')}/api/v1/analyze/${encodeURIComponent(
    studyInstanceUid
  )}/stream?generate_report=true`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      ...(authHeaders ? { Authorization: authHeaders } : {}),
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`AI analysis request failed with HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('AI analysis stream is unavailable in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    if (chunk.includes(': ping')) {
      onHeartbeat();
    }

    buffer += chunk;
    const parsed = parseSseEvents(buffer);
    buffer = parsed.remaining;

    parsed.events.forEach(event => {
      if (event.event === 'progress') {
        onProgress(event.data);
      } else if (event.event === 'complete') {
        onComplete(event.data);
      } else if (event.event === 'parse_error') {
        onError(event.error || new Error('Unable to parse stream payload'));
      }
    });
  }

  const finalText = decoder.decode();
  const finalBuffer = `${buffer}${finalText}`;
  if (finalBuffer.trim()) {
    const parsed = parseSseEvents(`${finalBuffer}\n\n`);
    parsed.events.forEach(event => {
      if (event.event === 'progress') {
        onProgress(event.data);
      } else if (event.event === 'complete') {
        onComplete(event.data);
      } else if (event.event === 'parse_error') {
        onError(event.error || new Error('Unable to parse stream payload'));
      }
    });
  }
}

function classifyAiAnalysisResult(
  payload: AiCompletePayload | null,
  progressEvents: AiProgressEvent[],
  streamError?: string
): AiDialogStatus {
  if (streamError && !payload) {
    return 'failed';
  }

  if (!payload) {
    return 'running';
  }

  const processingErrors = payload.processing_errors || [];
  const errorText = processingErrors.join(' ');
  const hasBackendOutage = /MedGemma|503|Service Temporarily Unavailable|GPU|backend|model/i.test(
    errorText
  );
  const stepFiveEvents = progressEvents.filter(event => event.step === 5);
  const maxStepFiveAnalyzed = Math.max(
    0,
    ...stepFiveEvents.map(event => Number(event.analyzed) || 0)
  );
  const stepFiveCompletedZero = stepFiveEvents.some(
    event =>
      event.status === 'done' &&
      Number(event.analyzed) === 0 &&
      Number(event.total || event.total_frames) > 0
  );
  const fetchedFrames = progressEvents.some(
    event => Number(event.fetched) > 0 || Number(event.total_frames) > 0
  );
  const finalProcessedZero =
    Number(payload.total_frames_processed) === 0 && fetchedFrames && maxStepFiveAnalyzed === 0;

  if (hasBackendOutage || stepFiveCompletedZero || finalProcessedZero) {
    return 'unable';
  }

  if (processingErrors.length || !payload.report?.report_text) {
    return 'warning';
  }

  return 'completed';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>');
}

function renderSafeReportMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let listOpen = false;
  let tableRows: string[][] = [];

  const closeList = () => {
    if (listOpen) {
      html.push('</ol>');
      listOpen = false;
    }
  };

  const flushTable = () => {
    if (!tableRows.length) {
      return;
    }

    html.push('<table>');
    tableRows.forEach((cells, index) => {
      if (index === 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()))) {
        return;
      }
      const tag = index === 0 ? 'th' : 'td';
      html.push(
        `<tr>${cells.map(cell => `<${tag}>${formatInlineMarkdown(cell.trim())}</${tag}>`).join('')}</tr>`
      );
    });
    html.push('</table>');
    tableRows = [];
  };

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      flushTable();
      return;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      tableRows.push(trimmed.slice(1, -1).split('|'));
      return;
    }

    flushTable();

    if (trimmed === '---') {
      closeList();
      html.push('<hr />');
      return;
    }

    if (trimmed.startsWith('## ')) {
      closeList();
      html.push(`<h3>${formatInlineMarkdown(trimmed.slice(3))}</h3>`);
      return;
    }

    if (trimmed.startsWith('# ')) {
      closeList();
      html.push(`<h2>${formatInlineMarkdown(trimmed.slice(2))}</h2>`);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (!listOpen) {
        html.push('<ol>');
        listOpen = true;
      }
      html.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
  });

  closeList();
  flushTable();
  return html.join('');
}

function formatDate(date?: string) {
  if (!date || date.length !== 8) {
    return date || 'Not available';
  }

  return `${date.slice(6, 8)}-${date.slice(4, 6)}-${date.slice(0, 4)}`;
}

function formatDuration(milliseconds?: number) {
  if (!milliseconds || milliseconds < 0) {
    return '0s';
  }

  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function latestProgressByStep(events: AiProgressEvent[]) {
  return events.reduce<Record<number, AiProgressEvent>>((acc, event) => {
    if (event.step) {
      acc[event.step] = event;
    }
    return acc;
  }, {});
}

function getFirstProgressByStep(events: AiProgressEvent[]) {
  return events.reduce<Record<number, AiProgressEvent>>((acc, event) => {
    if (event.step && !acc[event.step]) {
      acc[event.step] = event;
    }
    return acc;
  }, {});
}

function getStageDuration({
  step,
  steps,
  firstProgressByStep,
  progressByStep,
  now,
  isRunning,
}: {
  step: number;
  steps: number[];
  firstProgressByStep: Record<number, AiProgressEvent>;
  progressByStep: Record<number, AiProgressEvent>;
  now: number;
  isRunning: boolean;
}) {
  const firstEvent = firstProgressByStep[step];
  const latestEvent = progressByStep[step];
  const startedAt = firstEvent?._receivedAt;

  if (!startedAt) {
    return 0;
  }

  const nextStep = steps.find(candidate => candidate > step);
  const nextStartedAt = nextStep ? firstProgressByStep[nextStep]?._receivedAt : undefined;
  const isActiveStep = isRunning && steps[steps.length - 1] === step;
  const endedAt = nextStartedAt || (isActiveStep ? now : latestEvent?._receivedAt || now);

  return Math.max(0, endedAt - startedAt);
}

function collectHeatmaps(payload: AiCompletePayload | null): AiHeatmap[] {
  if (!payload) {
    return [];
  }

  const directHeatmaps = Array.isArray(payload.heatmaps) ? payload.heatmaps : [];
  const reportHeatmaps = Array.isArray(payload.report?.heatmaps) ? payload.report.heatmaps : [];
  const seriesHeatmaps = (payload.series_with_findings || []).flatMap(series =>
    Array.isArray(series?.heatmaps) ? series.heatmaps : []
  );

  return [...directHeatmaps, ...reportHeatmaps, ...seriesHeatmaps].filter(
    heatmap => heatmap?.heatmap_image_b64 || heatmap?.gemini_annotated_image_b64
  );
}

function getHeatmapImageSrc(base64?: string) {
  if (!base64) {
    return '';
  }

  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

function StatusGlyph({ status, size = 18 }: { status: AiDialogStatus; size?: number }) {
  const iconSx = { fontSize: size };

  if (status === 'running') {
    return (
      <CircularProgress
        size={size}
        thickness={5}
        sx={{ color: 'inherit' }}
      />
    );
  }

  if (status === 'completed') {
    return <CheckCircleIcon sx={iconSx} />;
  }

  if (status === 'warning') {
    return <WarningAmberIcon sx={iconSx} />;
  }

  if (status === 'unable' || status === 'failed') {
    return <ErrorOutlineIcon sx={iconSx} />;
  }

  return <HourglassEmptyIcon sx={iconSx} />;
}

function StepStatusIcon({ event }: { event: AiProgressEvent }) {
  if (event.status === 'done') {
    return <CheckCircleIcon sx={{ color: '#36d7b7', fontSize: 20 }} />;
  }

  if (/error|fail/i.test(event.status || event.message || '')) {
    return <WarningAmberIcon sx={{ color: '#f7b955', fontSize: 20 }} />;
  }

  if (/running|start|analyz|process/i.test(event.status || event.message || '')) {
    return (
      <CircularProgress
        size={18}
        thickness={5}
        sx={{ color: '#8be0f8' }}
      />
    );
  }

  return <RadioButtonUncheckedIcon sx={{ color: '#7da8b6', fontSize: 18 }} />;
}

function MetricChip({ label, value }: { label: string; value?: string | number }) {
  return (
    <Chip
      label={`${label}: ${value ?? 0}`}
      size="small"
      sx={{
        height: 30,
        color: '#e8fbff',
        borderColor: 'rgba(105, 210, 232, 0.32)',
        backgroundColor: 'rgba(105, 210, 232, 0.09)',
        fontWeight: 700,
      }}
      variant="outlined"
    />
  );
}

function FieldValue({ label, value }: { label: string; value?: string }) {
  return (
    <Box>
      <Box
        sx={{
          color: '#8bbfd0',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Box>
      <Box sx={{ fontWeight: 800, marginTop: '4px' }}>{value || 'Not available'}</Box>
    </Box>
  );
}

export default function AiAnalysisDialog({
  open,
  onClose,
  study,
  aiAnalysisHostURL = 'https://ciaiteleradiology.com/ai-analysis',
  authHeaders,
}: Props) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [progressEvents, setProgressEvents] = useState<AiProgressEvent[]>([]);
  const [completePayload, setCompletePayload] = useState<AiCompletePayload | null>(null);
  const [status, setStatus] = useState<AiDialogStatus>('idle');
  const [streamError, setStreamError] = useState('');
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [heatmapIndex, setHeatmapIndex] = useState(0);
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [analysisFinishedAt, setAnalysisFinishedAt] = useState<number | null>(null);
  const [timerNow, setTimerNow] = useState(Date.now());

  const latestProgress = progressEvents[progressEvents.length - 1];
  const resultStatus = useMemo(
    () => classifyAiAnalysisResult(completePayload, progressEvents, streamError),
    [completePayload, progressEvents, streamError]
  );
  const displayStatus = status === 'running' ? status : resultStatus;
  const progressByStep = useMemo(() => latestProgressByStep(progressEvents), [progressEvents]);
  const firstProgressByStep = useMemo(() => getFirstProgressByStep(progressEvents), [progressEvents]);
  const steps = Object.keys(progressByStep)
    .map(Number)
    .sort((a, b) => a - b);
  const progressValue =
    latestProgress?.step && latestProgress?.total_steps
      ? Math.min(100, Math.round((latestProgress.step / latestProgress.total_steps) * 100))
      : status === 'running'
      ? 8
      : completePayload
      ? 100
      : 0;
  const reportText = completePayload?.report?.report_text || '';
  const reportHtml = useMemo(() => renderSafeReportMarkdown(reportText), [reportText]);
  const heatmaps = useMemo(() => collectHeatmaps(completePayload), [completePayload]);
  const activeHeatmap = heatmaps[heatmapIndex];
  const processingErrors = completePayload?.processing_errors || [];
  const elapsedTime = analysisStartedAt
    ? formatDuration((analysisFinishedAt || timerNow) - analysisStartedAt)
    : '0s';
  const warningMessage =
    displayStatus === 'unable'
      ? GPU_DOWN_MESSAGE
      : displayStatus === 'warning'
      ? 'AI analysis completed with warnings. Review the details before using this report.'
      : '';

  const reset = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setProgressEvents([]);
    setCompletePayload(null);
    setStatus('idle');
    setStreamError('');
    setLastHeartbeatAt(null);
    setShowErrors(false);
    setHeatmapIndex(0);
    setAnalysisStartedAt(null);
    setAnalysisFinishedAt(null);
  };

  const runAnalysis = () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setProgressEvents([]);
    setCompletePayload(null);
    setStreamError('');
    setLastHeartbeatAt(null);
    setShowErrors(false);
    setHeatmapIndex(0);
    const startedAt = Date.now();
    setAnalysisStartedAt(startedAt);
    setAnalysisFinishedAt(null);
    setTimerNow(startedAt);
    setStatus('running');

    startAiAnalysisStream({
      studyInstanceUid: study.studyInstanceUid,
      aiAnalysisHostURL,
      authHeaders,
      signal: controller.signal,
      onProgress: event =>
        setProgressEvents(current => [...current, { ...event, _receivedAt: Date.now() }]),
      onComplete: payload => {
        setCompletePayload(payload);
        setAnalysisFinishedAt(Date.now());
        setStatus(classifyAiAnalysisResult(payload, progressEvents));
      },
      onError: error => {
        setStreamError(error.message);
      },
      onHeartbeat: () => setLastHeartbeatAt(Date.now()),
    }).catch(error => {
      if (controller.signal.aborted) {
        return;
      }
      setStreamError(error instanceof Error ? error.message : 'AI analysis failed.');
      setAnalysisFinishedAt(Date.now());
      setStatus('failed');
    });
  };

  useEffect(() => {
    if (open && study.studyInstanceUid) {
      runAnalysis();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, study.studyInstanceUid]);

  useEffect(() => {
    if (completePayload) {
      setStatus(classifyAiAnalysisResult(completePayload, progressEvents, streamError));
    }
  }, [completePayload, progressEvents, streamError]);

  useEffect(() => {
    setHeatmapIndex(0);
  }, [completePayload?.study_id]);

  useEffect(() => {
    if (!open || status !== 'running') {
      return undefined;
    }

    const intervalId = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [open, status]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDialogClose: DialogProps['onClose'] = (_event, reason) => {
    if (status === 'running' && reason === 'backdropClick') {
      return;
    }

    handleClose();
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setAnalysisFinishedAt(Date.now());
    setStatus('failed');
    setStreamError('AI analysis was cancelled.');
  };

  const handleCopyReport = async () => {
    if (!reportText) {
      return;
    }
    await navigator.clipboard.writeText(reportText);
  };

  const buildReportDocumentHtml = () => {
    if (!reportText) {
      return '';
    }

    const heatmapHtml = heatmaps
      .map((heatmap, index) => {
        const heatmapImages = [
          {
            label: 'Heatmap',
            src: heatmap.heatmap_image_b64,
            alt: `AI heatmap ${index + 1}`,
          },
          {
            label: 'Gemini annotation',
            src: heatmap.gemini_annotated_image_b64,
            alt: `Gemini annotated heatmap ${index + 1}`,
          },
        ]
          .filter(image => image.src)
          .map(
            image => `
              <figure class="heatmap-panel">
                <figcaption>${image.label}</figcaption>
                <img src="${getHeatmapImageSrc(image.src)}" alt="${image.alt}" />
              </figure>
            `
          )
          .join('');

        return `
          <section class="heatmap">
            <h2>Heatmap ${index + 1}${heatmap.summary ? `: ${escapeHtml(heatmap.summary)}` : ''}</h2>
            <div class="heatmap-grid ${heatmap.gemini_annotated_image_b64 ? 'has-pair' : ''}">
              ${heatmapImages}
            </div>
            ${heatmap.frame_key ? `<p class="muted">Frame: ${escapeHtml(heatmap.frame_key)}</p>` : ''}
          </section>
        `;
      })
      .join('');

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>AI Analysis Report</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #1d2b33; margin: 32px; line-height: 1.55; }
            header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #d9e7ec; padding-bottom: 16px; margin-bottom: 24px; }
            header img { width: 44px; height: 44px; object-fit: contain; }
            header h1 { font-size: 22px; margin: 0; }
            header p { margin: 2px 0 0; color: #647b85; font-size: 12px; }
            h2 { font-size: 21px; margin: 18px 0 10px; }
            h3 { font-size: 16px; margin: 18px 0 8px; }
            p { margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th, td { border: 1px solid #d5e1e6; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #edf5f7; }
            hr { border: 0; border-top: 1px solid #d5e1e6; margin: 18px 0; }
            .meta { background: #f2f7f9; border: 1px solid #dbe9ee; padding: 12px; margin-bottom: 20px; }
            .heatmap { page-break-inside: avoid; margin-top: 28px; padding-top: 16px; border-top: 1px solid #d5e1e6; }
            .heatmap-grid { display: grid; grid-template-columns: 1fr; gap: 14px; align-items: start; }
            .heatmap-grid.has-pair { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .heatmap-panel { margin: 0; page-break-inside: avoid; }
            .heatmap-panel figcaption { background: #edf5f7; border: 1px solid #d5e1e6; border-bottom: 0; color: #34515d; font-size: 12px; font-weight: 700; padding: 7px 9px; }
            .heatmap-panel img { display: block; max-width: 100%; height: auto; border: 1px solid #d5e1e6; box-sizing: border-box; }
            @media print { .heatmap-grid.has-pair { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media screen and (max-width: 720px) { .heatmap-grid.has-pair { grid-template-columns: 1fr; } }
            .muted { color: #647b85; font-size: 12px; }
          </style>
        </head>
        <body>
          <header>
            <img src="${window.location.origin}/ai-icon-new.png" alt="AI Analysis logo" />
            <div>
              <h1>AI Analysis Report</h1>
              <p>Generated from imaging analysis stream</p>
            </div>
          </header>
          <section class="meta">
            <strong>Patient:</strong> ${escapeHtml(study.patientName || 'Not available')}<br />
            <strong>Study:</strong> ${escapeHtml(study.description || 'Medical imaging study')}<br />
            <strong>Study Date:</strong> ${escapeHtml(formatDate(study.date))}
          </section>
          <main>${reportHtml}</main>
          ${heatmapHtml}
        </body>
      </html>`;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDoc = () => {
    const html = buildReportDocumentHtml();
    if (!html) {
      return;
    }
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    downloadBlob(blob, `ai-analysis-${study.studyInstanceUid}.doc`);
  };

  const handleDownloadPdf = () => {
    const html = buildReportDocumentHtml();
    if (!html) {
      return;
    }
    const printWindow = window.open('', '_blank', 'width=960,height=1100');
    if (!printWindow) {
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 350);
  };

  const goToPreviousHeatmap = () => {
    setHeatmapIndex(index => (index <= 0 ? heatmaps.length - 1 : index - 1));
  };

  const goToNextHeatmap = () => {
    setHeatmapIndex(index => (index >= heatmaps.length - 1 ? 0 : index + 1));
  };

  return (
    <BootstrapDialog
      open={open}
      onClose={handleDialogClose}
      disableEscapeKeyDown={status === 'running'}
      aria-labelledby="ai-analysis-dialog-title"
    >
      <DialogTitle
        id="ai-analysis-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: '#08131a',
          padding: '16px 20px',
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, #0a7c6c 0%, #2db4d3 100%)',
              color: '#ffffff',
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            AI
          </Box>
          <Box>
            <Box sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>AI Analysis</Box>
            <Box sx={{ color: '#91b7c2', fontSize: 12, marginTop: '3px' }}>
              Clinical image processing workflow
            </Box>
          </Box>
          <Chip
            size="small"
            color={STATUS_COLORS[displayStatus]}
            icon={<StatusGlyph status={displayStatus} />}
            label={STATUS_LABELS[displayStatus]}
            sx={{
              fontWeight: 800,
              '& .MuiChip-icon': {
                color: 'inherit',
              },
            }}
          />
          <Chip
            size="small"
            label={`Elapsed ${elapsedTime}`}
            sx={{
              color: '#dff6ff',
              borderColor: 'rgba(105, 210, 232, 0.28)',
              backgroundColor: 'rgba(105, 210, 232, 0.08)',
              fontWeight: 800,
            }}
            variant="outlined"
          />
        </Stack>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{ color: '#d7edf4' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ padding: '20px', background: '#071118' }}>
          <Box
            sx={{
              border: '1px solid rgba(105, 210, 232, 0.18)',
              background: '#0d1b24',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '18px',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1.35fr 0.75fr 1.25fr',
                },
                gap: '14px',
              }}
            >
              <FieldValue
                label="Patient"
                value={study.patientName}
              />
              <FieldValue
                label="Study Date"
                value={formatDate(study.date)}
              />
              <FieldValue
                label="Study"
                value={study.description || 'Medical imaging study'}
              />
            </Box>
            <Box
              sx={{
                marginTop: '12px',
                color: '#a6cbd6',
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '10px',
              }}
              title={study.studyInstanceUid}
            >
              Study Instance UID: {study.studyInstanceUid}
            </Box>
          </Box>

          {status === 'running' && (
            <Box
              sx={{
                marginBottom: '18px',
                border: '1px solid rgba(33, 181, 155, 0.24)',
                background: 'rgba(33, 181, 155, 0.08)',
                borderRadius: '8px',
                padding: '14px',
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ marginBottom: '12px' }}
              >
                <CircularProgress
                  size={18}
                  thickness={5}
                />
                <Box sx={{ fontWeight: 700 }}>
                  {latestProgress?.message ||
                    (lastHeartbeatAt ? 'Still processing...' : 'Starting AI analysis...')}
                </Box>
                <Box sx={{ marginLeft: 'auto', color: '#9fc4ce', fontSize: 12, fontWeight: 800 }}>
                  {elapsedTime}
                </Box>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progressValue}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#21b59b',
                  },
                }}
              />
            </Box>
          )}

          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ marginBottom: '18px' }}
          >
            <MetricChip
              label="Series"
              value={completePayload?.total_series_analyzed || latestProgress?.total_series}
            />
            <MetricChip
              label="Frames"
              value={latestProgress?.fetched || latestProgress?.total_frames}
            />
            <MetricChip
              label="Analyzed"
              value={completePayload?.total_frames_processed || latestProgress?.analyzed}
            />
            <MetricChip
              label="Findings"
              value={completePayload?.total_anomalies_found || latestProgress?.total_anomalies}
            />
            {!!processingErrors.length && (
              <MetricChip
                label="Warnings"
                value={processingErrors.length}
              />
            )}
          </Stack>

          {streamError && displayStatus === 'failed' && (
            <Alert
              severity="error"
              sx={{ marginBottom: '16px' }}
            >
              {streamError}
            </Alert>
          )}

          {warningMessage && (
            <Alert
              severity={displayStatus === 'unable' ? 'error' : 'warning'}
              sx={{ marginBottom: '16px' }}
            >
              {warningMessage}
            </Alert>
          )}

          {status === 'running' && !!steps.length && (
            <Box
              sx={{
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                marginBottom: '18px',
                overflow: 'hidden',
                background: '#0b1720',
              }}
            >
              {steps.map(step => {
                const event = progressByStep[step];
                const stageDuration = getStageDuration({
                  step,
                  steps,
                  firstProgressByStep,
                  progressByStep,
                  now: timerNow,
                  isRunning: status === 'running',
                });
                return (
                  <Stack
                    key={step}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{
                      padding: '12px 14px',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      background:
                        event.status === 'done'
                          ? 'rgba(33, 181, 155, 0.08)'
                          : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Chip
                      size="small"
                      label={`${step}/${event.total_steps || '?'}`}
                      sx={{
                        minWidth: 54,
                        color: '#e8fbff',
                        backgroundColor:
                          event.status === 'done' ? 'rgba(33, 181, 155, 0.32)' : '#22313d',
                        fontWeight: 800,
                      }}
                    />
                    <StepStatusIcon event={event} />
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ fontSize: 13, fontWeight: 700 }}>
                        {event.message || `Step ${step}`}
                      </Box>
                      <Box sx={{ color: '#91b7c2', fontSize: 12 }}>{event.status || 'started'}</Box>
                    </Box>
                    <Chip
                      size="small"
                      label={formatDuration(stageDuration)}
                      sx={{
                        color: '#dff6ff',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        fontWeight: 800,
                        minWidth: 58,
                      }}
                    />
                  </Stack>
                );
              })}
            </Box>
          )}

          {completePayload && (
            <Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '10px',
                  marginBottom: '18px',
                }}
              >
                {[
                  ['Series', completePayload.total_series_analyzed],
                  ['Frames processed', completePayload.total_frames_processed],
                  ['Findings', completePayload.total_anomalies_found],
                  ['Heatmaps', heatmaps.length],
                  ['Elapsed', elapsedTime],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      border: '1px solid rgba(105, 210, 232, 0.14)',
                      borderRadius: '8px',
                      padding: '12px',
                      background: '#0d1b24',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
                    }}
                  >
                    <Box
                      sx={{
                        color: '#91b7c2',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0,
                        textTransform: 'uppercase',
                      }}
                    >
                      {label}
                    </Box>
                    <Box sx={{ fontSize: 22, fontWeight: 900, marginTop: '4px' }}>
                      {value ?? 0}
                    </Box>
                  </Box>
                ))}
              </Box>

              {reportText ? (
                <Box
                  sx={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: '#fbfdfe',
                    color: '#1c2b33',
                    borderRadius: '8px',
                    boxShadow: '0 22px 55px rgba(0, 0, 0, 0.32)',
                    overflow: 'hidden',
                    '& h2': { margin: '0 0 14px', fontSize: 22 },
                    '& h3': { margin: '18px 0 8px', fontSize: 16 },
                    '& p': { lineHeight: 1.55, margin: '8px 0' },
                    '& table': { width: '100%', borderCollapse: 'collapse', margin: '10px 0' },
                    '& th, & td': {
                      border: '1px solid #d9e5ea',
                      padding: '8px',
                      textAlign: 'left',
                    },
                    '& th': { background: '#eaf3f6' },
                    '& hr': { border: 0, borderTop: '1px solid #d9e5ea', margin: '16px 0' },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #d9e5ea',
                      background: '#eef7fa',
                    }}
                  >
                    <Box
                      component="img"
                      src="/ai-icon-new.png"
                      alt="AI Analysis"
                      sx={{
                        width: 42,
                        height: 42,
                        objectFit: 'contain',
                      }}
                    />
                    <Box>
                      <Box sx={{ fontSize: 18, fontWeight: 900 }}>AI Analysis Report</Box>
                      <Box sx={{ color: '#5f7884', fontSize: 12 }}>
                        Review generated findings with the original study images.
                      </Box>
                    </Box>
                  </Stack>
                  <Box
                    sx={{
                      padding: '22px',
                      maxHeight: '40vh',
                      overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: reportHtml }}
                  />
                </Box>
              ) : (
                <Alert severity="warning">Report text unavailable.</Alert>
              )}

              {!!activeHeatmap && (
                <Box
                  sx={{
                    marginTop: '18px',
                    border: '1px solid rgba(105, 210, 232, 0.18)',
                    background: '#0d1b24',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 18px 45px rgba(0, 0, 0, 0.28)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                    sx={{ marginBottom: '12px' }}
                  >
                    <Box>
                      <Box sx={{ color: '#eef7fb', fontSize: 16, fontWeight: 900 }}>
                        Heatmap Review
                      </Box>
                      <Box sx={{ color: '#9fc4ce', fontSize: 12 }}>
                        {activeHeatmap.summary || 'AI-generated visual attention map'}
                      </Box>
                    </Box>
                    <Chip
                      size="small"
                      label={`${heatmapIndex + 1} of ${heatmaps.length}`}
                      sx={{
                        color: '#e8fbff',
                        backgroundColor: 'rgba(105, 210, 232, 0.12)',
                        border: '1px solid rgba(105, 210, 232, 0.25)',
                        fontWeight: 800,
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      position: 'relative',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#050b10',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: activeHeatmap.gemini_annotated_image_b64 ? '1fr 1fr' : '1fr',
                        },
                        gap: '1px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      }}
                    >
                      {[
                        {
                          label: 'Heatmap',
                          src: activeHeatmap.heatmap_image_b64,
                          alt: activeHeatmap.summary || `AI heatmap ${heatmapIndex + 1}`,
                        },
                        {
                          label: 'Gemini annotation',
                          src: activeHeatmap.gemini_annotated_image_b64,
                          alt: `Gemini annotated heatmap ${heatmapIndex + 1}`,
                        },
                      ]
                        .filter(image => image.src)
                        .map(image => (
                          <Box
                            key={image.label}
                            sx={{
                              minHeight: { xs: 260, sm: 420 },
                              display: 'grid',
                              gridTemplateRows: 'auto 1fr',
                              background: '#050b10',
                            }}
                          >
                            <Box
                              sx={{
                                padding: '8px 10px',
                                color: '#cceef7',
                                fontSize: 12,
                                fontWeight: 800,
                                background: 'rgba(13, 27, 36, 0.92)',
                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              {image.label}
                            </Box>
                            <Box
                              sx={{
                                display: 'grid',
                                placeItems: 'center',
                                padding: '10px',
                              }}
                            >
                              <Box
                                component="img"
                                src={getHeatmapImageSrc(image.src)}
                                alt={image.alt}
                                sx={{
                                  maxWidth: '100%',
                                  maxHeight: { xs: 320, sm: 520 },
                                  width: 'auto',
                                  height: 'auto',
                                  display: 'block',
                                }}
                              />
                            </Box>
                          </Box>
                        ))}
                    </Box>

                    {heatmaps.length > 1 && (
                      <>
                        <IconButton
                          aria-label="previous heatmap"
                          onClick={goToPreviousHeatmap}
                          sx={{
                            position: 'absolute',
                            left: 12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#ffffff',
                            backgroundColor: 'rgba(0,0,0,0.52)',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
                            '&:hover': { backgroundColor: 'rgba(0,0,0,0.72)' },
                          }}
                        >
                          <NavigateBeforeIcon />
                        </IconButton>
                        <IconButton
                          aria-label="next heatmap"
                          onClick={goToNextHeatmap}
                          sx={{
                            position: 'absolute',
                            right: 12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#ffffff',
                            backgroundColor: 'rgba(0,0,0,0.52)',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
                            '&:hover': { backgroundColor: 'rgba(0,0,0,0.72)' },
                          }}
                        >
                          <NavigateNextIcon />
                        </IconButton>
                      </>
                    )}
                  </Box>

                  {activeHeatmap.frame_key && (
                    <Box sx={{ color: '#9fc4ce', fontSize: 12, marginTop: '10px' }}>
                      Frame: {activeHeatmap.frame_key}
                    </Box>
                  )}
                </Box>
              )}

              {!!processingErrors.length && (
                <Box sx={{ marginTop: '14px' }}>
                  <Button
                    variant="text"
                    onClick={() => setShowErrors(value => !value)}
                    sx={{ color: '#8be0f8' }}
                  >
                    {showErrors ? 'Hide technical details' : 'Show technical details'}
                  </Button>
                  <Collapse in={showErrors}>
                    <Box
                      component="pre"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        background: '#071015',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '12px',
                        color: '#cbe6ef',
                        maxHeight: 180,
                        overflow: 'auto',
                        fontSize: 12,
                      }}
                    >
                      {processingErrors.join('\n\n')}
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        {status === 'running' ? (
          <Button
            variant="outlined"
            color="warning"
            onClick={handleCancel}
          >
            Cancel Analysis
          </Button>
        ) : (
          <Button
            variant="outlined"
            onClick={runAnalysis}
            disabled={!study.studyInstanceUid}
            sx={{ color: '#8be0f8', borderColor: '#2a8ca3' }}
          >
            Retry
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          onClick={handleCopyReport}
          disabled={!reportText}
          startIcon={<ContentCopyIcon />}
          sx={{ color: '#dff6ff', borderColor: '#477889' }}
        >
          Copy Report
        </Button>
        <Button
          variant="outlined"
          onClick={handleDownloadDoc}
          disabled={!reportText}
          startIcon={<DescriptionIcon />}
          sx={{ color: '#dff6ff', borderColor: '#477889' }}
        >
          Download DOC
        </Button>
        <Button
          variant="outlined"
          onClick={handleDownloadPdf}
          disabled={!reportText}
          startIcon={<PictureAsPdfIcon />}
          sx={{ color: '#dff6ff', borderColor: '#477889' }}
        >
          Download PDF
        </Button>
        <Button
          variant="contained"
          onClick={handleClose}
          sx={{ backgroundColor: '#0a7c6c' }}
        >
          Close
        </Button>
      </DialogActions>
    </BootstrapDialog>
  );
}

export { parseSseEvents, classifyAiAnalysisResult, renderSafeReportMarkdown };
