import React, { useEffect, useMemo, useRef, useState } from 'react';
import { styled } from '@mui/material/styles';
import Dialog, { DialogProps } from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
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
  const stepFiveZero = progressEvents.some(
    event => event.step === 5 && Number(event.analyzed) === 0 && Number(event.total) > 0
  );
  const fetchedFrames = progressEvents.some(
    event => Number(event.fetched) > 0 || Number(event.total_frames) > 0
  );
  const finalProcessedZero = Number(payload.total_frames_processed) === 0 && fetchedFrames;

  if (hasBackendOutage || stepFiveZero || finalProcessedZero) {
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

function latestProgressByStep(events: AiProgressEvent[]) {
  return events.reduce<Record<number, AiProgressEvent>>((acc, event) => {
    if (event.step) {
      acc[event.step] = event;
    }
    return acc;
  }, {});
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

  const latestProgress = progressEvents[progressEvents.length - 1];
  const resultStatus = useMemo(
    () => classifyAiAnalysisResult(completePayload, progressEvents, streamError),
    [completePayload, progressEvents, streamError]
  );
  const displayStatus = status === 'running' ? status : resultStatus;
  const progressByStep = useMemo(() => latestProgressByStep(progressEvents), [progressEvents]);
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
  const processingErrors = completePayload?.processing_errors || [];
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
    setStatus('running');

    startAiAnalysisStream({
      studyInstanceUid: study.studyInstanceUid,
      aiAnalysisHostURL,
      authHeaders,
      signal: controller.signal,
      onProgress: event => setProgressEvents(current => [...current, event]),
      onComplete: payload => {
        setCompletePayload(payload);
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

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setStatus('failed');
    setStreamError('AI analysis was cancelled.');
  };

  const handleCopyReport = async () => {
    if (!reportText) {
      return;
    }
    await navigator.clipboard.writeText(reportText);
  };

  const handleDownloadMarkdown = () => {
    if (!reportText) {
      return;
    }
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-analysis-${study.studyInstanceUid}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <BootstrapDialog
      open={open}
      onClose={handleClose}
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
            label={STATUS_LABELS[displayStatus]}
            sx={{ fontWeight: 800 }}
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
              label="Frames fetched"
              value={latestProgress?.fetched || latestProgress?.total_frames}
            />
            <MetricChip
              label="Frames analyzed"
              value={completePayload?.total_frames_processed || latestProgress?.analyzed}
            />
            <MetricChip
              label="Anomalies"
              value={completePayload?.total_anomalies_found || latestProgress?.total_anomalies}
            />
            <MetricChip
              label="Errors"
              value={processingErrors.length}
            />
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

          {!!steps.length && (
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
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ fontSize: 13, fontWeight: 700 }}>
                        {event.message || `Step ${step}`}
                      </Box>
                      <Box sx={{ color: '#91b7c2', fontSize: 12 }}>{event.status || 'started'}</Box>
                    </Box>
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
                  ['Series analyzed', completePayload.total_series_analyzed],
                  ['Frames processed', completePayload.total_frames_processed],
                  ['Anomalies found', completePayload.total_anomalies_found],
                  ['Findings series', completePayload.series_with_findings?.length || 0],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      border: '1px solid rgba(105, 210, 232, 0.14)',
                      borderRadius: '8px',
                      padding: '12px',
                      background: '#0d1b24',
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
                    padding: '22px',
                    maxHeight: '42vh',
                    overflow: 'auto',
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
                  dangerouslySetInnerHTML={{ __html: renderSafeReportMarkdown(reportText) }}
                />
              ) : (
                <Alert severity="warning">Report text unavailable.</Alert>
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

              <Box sx={{ marginTop: '14px', color: '#9fc4ce', fontSize: 12 }}>
                <div>Report: {completePayload.report?.output_path || completePayload.report_path || 'N/A'}</div>
                <div>
                  Doctor DOCX:{' '}
                  {completePayload.report?.docx_output_path || completePayload.docx_path || 'N/A'}
                </div>
                <div>
                  Patient DOCX:{' '}
                  {completePayload.report?.user_docx_output_path ||
                    completePayload.user_docx_path ||
                    'N/A'}
                </div>
              </Box>
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
          sx={{ color: '#dff6ff', borderColor: '#477889' }}
        >
          Copy Report
        </Button>
        <Button
          variant="outlined"
          onClick={handleDownloadMarkdown}
          disabled={!reportText}
          sx={{ color: '#dff6ff', borderColor: '#477889' }}
        >
          Download Markdown
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
