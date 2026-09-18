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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';

import {
  AiCompletePayload,
  CONSISTENCY_LABELS,
  EvidenceFinding,
  EvidenceTier,
  GroupedFinding,
  TIER_LABELS,
  buildAllFindingRecords,
  buildEvidenceFindings,
  collectHeatmaps,
  formatConfidence,
  formatDicomDate,
  getAnomalyFindings,
  getImageSrc,
  getMaxDifferenceMm,
  getMeasurementRange,
  getTier,
  groupEvidenceFindings,
  summarizeSeverities,
} from './aiReportModel';
import { renderSafeReportMarkdown } from './reportMarkdown';
import { buildCiaiReportHtml } from './buildCiaiReportHtml';
import { buildReportViewerHtml } from './buildReportViewerHtml';

/** Shared with the printed report and the beta viewer so branding stays in step. */
const LOGO_PATH = '/ohif-whitebg-logo.svg';

type AiProgressEvent = {
  step?: number;
  total_steps?: number;
  status?: string;
  message?: string;
  _receivedAt?: number;
  [key: string]: any;
};

type AiDialogStatus = 'idle' | 'running' | 'completed' | 'warning' | 'unable' | 'failed';

type ReportScope = 'significant' | 'all';

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
    width: '1140px',
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
    flexWrap: 'wrap',
    gap: '8px',
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

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#b3261e',
  high: '#c2610a',
  medium: '#8a6d00',
  low: '#4a6076',
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

  const dispatch = (event: ParsedSseEvent) => {
    if (event.event === 'progress') {
      onProgress(event.data);
    } else if (event.event === 'complete') {
      onComplete(event.data);
    } else if (event.event === 'parse_error') {
      onError(event.error || new Error('Unable to parse stream payload'));
    }
  };

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
    parsed.events.forEach(dispatch);
  }

  const finalText = decoder.decode();
  const finalBuffer = `${buffer}${finalText}`;
  if (finalBuffer.trim()) {
    parseSseEvents(`${finalBuffer}\n\n`).events.forEach(dispatch);
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

function SeverityChip({ severity, size = 'small' }: { severity: string; size?: 'small' | 'medium' }) {
  const value = (severity || 'low').toLowerCase();

  return (
    <Chip
      size={size}
      label={value.toUpperCase()}
      sx={{
        backgroundColor: SEVERITY_COLORS[value] || SEVERITY_COLORS.low,
        color: '#ffffff',
        fontWeight: 900,
        fontSize: 10,
        letterSpacing: 0.4,
        height: 20,
      }}
    />
  );
}

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Box
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
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Box>
      <Box sx={{ fontSize: 22, fontWeight: 900, marginTop: '4px' }}>{value}</Box>
      {hint && <Box sx={{ color: '#7fa4b1', fontSize: 11, marginTop: '2px' }}>{hint}</Box>}
    </Box>
  );
}

/**
 * Draws the AI-detected region over a frame.
 *
 * `bbox` is normalised to the frame, so the overlay is positioned in
 * percentages and stays aligned as the image scales with the dialog.
 */
function CaliperOverlay({
  bbox,
  label,
  tone,
}: {
  bbox: number[] | null;
  label: string;
  tone: 'human' | 'ai';
}) {
  if (!bbox) {
    return null;
  }

  const [x0, y0, x1, y1] = bbox;
  const left = Math.min(x0, x1) * 100;
  const right = Math.max(x0, x1) * 100;
  const top = Math.min(y0, y1) * 100;
  const bottom = Math.max(y0, y1) * 100;
  const width = Math.max(right - left, 0.5);
  const height = Math.max(bottom - top, 0.5);
  const centerY = (top + bottom) / 2;
  const centerX = (left + right) / 2;
  const color = tone === 'human' ? '#00ffff' : '#ffe600';

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          border: `1px dashed ${color}`,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: `${left}%`,
          top: `${centerY}%`,
          width: `${width}%`,
          height: '2px',
          background: color,
          pointerEvents: 'none',
        }}
      />
      {[left, right].map(position => (
        <Box
          key={position}
          sx={{
            position: 'absolute',
            left: `${position}%`,
            top: `${centerY - 2}%`,
            width: '2px',
            height: '4%',
            background: color,
            pointerEvents: 'none',
          }}
        />
      ))}
      <Box
        sx={{
          position: 'absolute',
          left: `${centerX}%`,
          top: `${centerY}%`,
          transform: 'translate(-50%, -160%)',
          background: '#000000',
          color: '#ffffff',
          fontSize: 11,
          fontWeight: 700,
          padding: '1px 6px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {label}
      </Box>
    </>
  );
}

function EvidencePanel({
  label,
  image,
  emptyText,
  overlay,
  caption,
}: {
  label: string;
  image: string;
  emptyText: string;
  overlay?: React.ReactNode;
  caption?: string;
}) {
  return (
    <Box
      sx={{
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '6px',
        overflow: 'hidden',
        background: '#050b10',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          padding: '7px 10px',
          color: '#cceef7',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          background: 'rgba(13, 27, 36, 0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {label}
      </Box>
      <Box sx={{ display: 'grid', placeItems: 'center', padding: '8px', flex: 1, minHeight: 160 }}>
        {image ? (
          <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <Box
              component="img"
              src={getImageSrc(image)}
              alt={label}
              sx={{ display: 'block', maxWidth: '100%', maxHeight: 340, width: 'auto' }}
            />
            {overlay}
          </Box>
        ) : (
          <Box sx={{ color: '#6f8d9b', fontSize: 12, textAlign: 'center' }}>{emptyText}</Box>
        )}
      </Box>
      {caption && (
        <Box
          sx={{
            padding: '6px 10px',
            color: '#9fc4ce',
            fontSize: 11,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {caption}
        </Box>
      )}
    </Box>
  );
}

function VerificationRow({ label, value, flag }: { label: string; value: React.ReactNode; flag?: boolean }) {
  return (
    <>
      <Box
        sx={{
          color: '#8bbfd0',
          fontSize: 11,
          fontWeight: 700,
          padding: '7px 10px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {label}
      </Box>
      <Box
        sx={{
          fontSize: 12,
          fontWeight: 700,
          padding: '7px 10px',
          color: flag ? '#ff8f7a' : '#eef7fb',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Box>
    </>
  );
}

/**
 * Evidence review for one finding, in the order the report format mandates:
 * original first, then the manual marking, then the CIAI AI marking, with the
 * heatmap last as supporting evidence.
 */
function EvidenceViewer({
  findings,
  index,
  onIndexChange,
  studyInstanceUid,
}: {
  findings: EvidenceFinding[];
  index: number;
  onIndexChange: (next: number) => void;
  studyInstanceUid: string;
}) {
  const [showOverlays, setShowOverlays] = useState(true);
  const finding = findings[index];

  if (!finding) {
    return (
      <Alert severity="info">
        No finding in this study resolved to an image frame, so there is no image evidence to review.
      </Alert>
    );
  }

  const humanLabel = finding.imageMeasurement.measurable
    ? finding.imageMeasurement.display
    : 'Pending';
  const aiLabel = finding.imageMeasurement.measurable
    ? finding.imageMeasurement.display
    : finding.narrativeMeasurement.display;
  const isMismatch = finding.consistency !== 'match';

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        sx={{ marginBottom: '12px' }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <IconButton
            aria-label="previous finding"
            size="small"
            onClick={() => onIndexChange(index <= 0 ? findings.length - 1 : index - 1)}
            sx={{ color: '#cceef7', background: 'rgba(255,255,255,0.06)' }}
          >
            <NavigateBeforeIcon />
          </IconButton>
          <IconButton
            aria-label="next finding"
            size="small"
            onClick={() => onIndexChange(index >= findings.length - 1 ? 0 : index + 1)}
            sx={{ color: '#cceef7', background: 'rgba(255,255,255,0.06)' }}
          >
            <NavigateNextIcon />
          </IconButton>
          <SeverityChip severity={finding.severity} />
          <Box sx={{ fontSize: 16, fontWeight: 900 }}>
            {finding.findingId} — {finding.name}
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
        >
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showOverlays}
                onChange={event => setShowOverlays(event.target.checked)}
              />
            }
            label={<Box sx={{ fontSize: 12, color: '#bcdde7' }}>Markings</Box>}
          />
          <Chip
            size="small"
            label={`${index + 1} of ${findings.length}`}
            sx={{
              color: '#e8fbff',
              backgroundColor: 'rgba(105, 210, 232, 0.12)',
              border: '1px solid rgba(105, 210, 232, 0.25)',
              fontWeight: 800,
            }}
          />
        </Stack>
      </Stack>

      <TextField
        select
        size="small"
        fullWidth
        value={index}
        onChange={event => onIndexChange(Number(event.target.value))}
        sx={{
          marginBottom: '14px',
          '& .MuiInputBase-root': { color: '#eef7fb', background: '#0b1720' },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(105, 210, 232, 0.25)' },
          '& .MuiSvgIcon-root': { color: '#8be0f8' },
        }}
      >
        {findings.map((item, itemIndex) => (
          <MenuItem
            key={`${item.findingId}-${item.frameKey}`}
            value={itemIndex}
          >
            {item.findingId} — {item.name} ({item.severity})
          </MenuItem>
        ))}
      </TextField>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '10px',
          marginBottom: '10px',
        }}
      >
        <EvidencePanel
          label="1. Original diagnostic image"
          image={finding.originalImage}
          emptyText="Original frame was not returned by the analysis service."
          caption="Unmodified frame at the AI-detected location. No overlay applied."
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: '10px',
        }}
      >
        <EvidencePanel
          label="2. Lab / human marking"
          image={finding.originalImage}
          emptyText="Original frame unavailable."
          overlay={
            showOverlays ? (
              <CaliperOverlay
                bbox={finding.bbox}
                label={humanLabel}
                tone="human"
              />
            ) : null
          }
          caption={`Measurement above caliper: ${humanLabel} — draft seeded from the image layer, awaiting radiologist caliper.`}
        />
        <EvidencePanel
          label="3. CIAI AI marking"
          image={finding.annotatedImage || finding.heatmapImage}
          emptyText="AI marking was not returned for this frame."
          overlay={
            showOverlays ? (
              <CaliperOverlay
                bbox={finding.bbox}
                label={aiLabel}
                tone="ai"
              />
            ) : null
          }
          caption={`CIAI measurement above caliper: ${aiLabel}`}
        />
      </Box>

      {!!(finding.annotatedImage && finding.heatmapImage) && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: '10px',
            marginTop: '10px',
          }}
        >
          <EvidencePanel
            label="4. Heatmap — final evidence layer"
            image={finding.heatmapImage}
            emptyText="Heatmap unavailable."
            caption="Supports the finding. Does not replace the original DICOM image."
          />
        </Box>
      )}

      <Box
        sx={{
          marginTop: '14px',
          border: '1px solid rgba(105, 210, 232, 0.18)',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            background: '#082a4b',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            padding: '8px 10px',
          }}
        >
          Clinical verification panel
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '40% 60%', md: '18% 32% 18% 32%' },
          }}
        >
          <VerificationRow
            label="Image measurement"
            value={finding.imageMeasurement.display}
          />
          <VerificationRow
            label="Image AI score"
            value={formatConfidence(finding.imageScore)}
          />
          <VerificationRow
            label="Narrative AI output"
            value={`${finding.narrativeMeasurement.display} / ${formatConfidence(
              finding.narrativeScore
            )}`}
          />
          <VerificationRow
            label="Consistency"
            value={CONSISTENCY_LABELS[finding.consistency]}
            flag={isMismatch}
          />
          <VerificationRow
            label="Manual / lab draft"
            value={humanLabel}
          />
          <VerificationRow
            label="CIAI AI draft"
            value={aiLabel}
          />
          <VerificationRow
            label="Difference"
            value={
              finding.differenceMm === null
                ? 'Pending radiologist measurement'
                : `${finding.differenceMm} mm`
            }
            flag={Boolean(finding.differenceMm)}
          />
          <VerificationRow
            label="Series"
            value={finding.seriesLabel || 'Not stated'}
          />
          <VerificationRow
            label="Source frame"
            value={finding.frameKey || 'Not stated'}
          />
          <VerificationRow
            label="Study UID"
            value={studyInstanceUid}
          />
          <VerificationRow
            label="Location"
            value={finding.location || 'Not stated'}
          />
          <VerificationRow
            label="Evidence order"
            value="Original → Human → CIAI → Heatmap"
          />
        </Box>
      </Box>

      {finding.description && (
        <Box sx={{ color: '#a6cbd6', fontSize: 12, marginTop: '10px' }}>
          <strong style={{ color: '#dff6ff' }}>AI description:</strong> {finding.description}
        </Box>
      )}
    </Box>
  );
}

const TIER_HINTS: Record<EvidenceTier, string> = {
  measured: 'Has a measurement recovered from the image, a locating box and a source frame — these can be checked against a picture.',
  reported: 'Stated by the narrative model with no measurable image evidence behind it.',
  incidental: 'Background observations: physiologic calcification, age-related atrophy, chronic change, scanner artefact.',
};

function FindingsTable({
  findings,
  onOpenEvidence,
}: {
  findings: GroupedFinding[];
  onOpenEvidence: (finding: GroupedFinding) => void;
}) {
  const [tier, setTier] = useState<EvidenceTier | 'all'>('measured');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      all: findings.length,
      measured: getTier(findings, 'measured').length,
      reported: getTier(findings, 'reported').length,
      incidental: getTier(findings, 'incidental').length,
    }),
    [findings]
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return findings.filter(finding => {
      if (tier !== 'all' && finding.tier !== tier) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [finding.findingId, finding.name, finding.description, ...finding.locations]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [findings, tier, query]);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ marginBottom: '10px' }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={tier}
          onChange={(_event, value) => value && setTier(value)}
          sx={{
            '& .MuiToggleButton-root': {
              color: '#bcdde7',
              borderColor: 'rgba(105, 210, 232, 0.25)',
              fontWeight: 800,
              fontSize: 11,
              padding: '4px 10px',
              textTransform: 'none',
            },
            '& .Mui-selected': {
              color: '#05221c !important',
              backgroundColor: '#12a58c !important',
            },
          }}
        >
          <ToggleButton value="measured">Measured ({counts.measured})</ToggleButton>
          <ToggleButton value="reported">Narrative only ({counts.reported})</ToggleButton>
          <ToggleButton value="incidental">Incidental ({counts.incidental})</ToggleButton>
          <ToggleButton value="all">All ({counts.all})</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          placeholder="Search findings or location"
          value={query}
          onChange={event => setQuery(event.target.value)}
          sx={{
            flex: 1,
            '& .MuiInputBase-root': { color: '#eef7fb', background: '#0b1720' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(105, 210, 232, 0.25)' },
          }}
        />
      </Stack>

      {tier !== 'all' && (
        <Box sx={{ color: '#6f92a6', fontSize: 11.5, marginBottom: '10px', lineHeight: 1.5 }}>
          {TIER_HINTS[tier]}
        </Box>
      )}

      <Box
        sx={{
          maxHeight: '46vh',
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
        }}
      >
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            '& th': {
              position: 'sticky',
              top: 0,
              background: '#0b1720',
              color: '#8bbfd0',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              textAlign: 'left',
              padding: '9px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              zIndex: 1,
            },
            '& td': {
              padding: '9px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              verticalAlign: 'top',
              color: '#dbeef5',
            },
          }}
        >
          <thead>
            <tr>
              <th>Severity</th>
              <th>ID</th>
              <th>Finding</th>
              <th>Size</th>
              <th>Evidence</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(finding => (
              <tr key={`${finding.findingId}-${finding.frameKey}-${finding.name}`}>
                <td>
                  <SeverityChip severity={finding.severity} />
                </td>
                <td style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {finding.tier === 'measured' ? (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onOpenEvidence(finding)}
                      sx={{
                        background: 'none',
                        border: 0,
                        padding: 0,
                        color: '#4fd8bd',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {finding.findingId}
                    </Box>
                  ) : (
                    finding.findingId
                  )}
                </td>
                <td>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                  >
                    <Box sx={{ fontWeight: 700 }}>{finding.name}</Box>
                    {finding.occurrences > 1 && (
                      <Box
                        sx={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#8faec0',
                          border: '1px solid rgba(255,255,255,0.16)',
                          borderRadius: '3px',
                          padding: '0 4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        seen {finding.occurrences}&times;
                      </Box>
                    )}
                  </Stack>
                  <Box sx={{ color: '#8fb4c0', fontSize: 11 }}>{finding.description}</Box>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {finding.tier === 'measured'
                    ? finding.imageMeasurement.display
                    : finding.narrativeMeasurement.display}
                </td>
                <td
                  style={{
                    whiteSpace: 'nowrap',
                    color: finding.tier === 'measured' ? '#5fd3a5' : '#8fb4c0',
                    fontWeight: 700,
                  }}
                >
                  {TIER_LABELS[finding.tier]}
                </td>
                <td style={{ color: '#8fb4c0' }}>{finding.locations.join('; ') || '—'}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: 'center', color: '#8fb4c0', padding: '24px' }}
                >
                  No findings match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </Box>
      </Box>
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
  const [evidenceIndex, setEvidenceIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [reportScope, setReportScope] = useState<ReportScope>('significant');
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
  const findingsSummary = completePayload?.findings_summary || [];
  const anomalyFindings = useMemo(() => getAnomalyFindings(findingsSummary), [findingsSummary]);
  const evidence = useMemo(() => buildEvidenceFindings(completePayload), [completePayload]);
  const heatmaps = useMemo(() => collectHeatmaps(completePayload), [completePayload]);

  // One row per distinct finding, sorted by what can be done with it. The
  // analysis runs per frame, so the same lesion arrives once per slice it
  // appears on; grouping is what keeps a single calcification from filling six
  // rows, and the tier is what separates a measurable mass from background.
  const grouped = useMemo(
    () => groupEvidenceFindings(buildAllFindingRecords(completePayload)),
    [completePayload]
  );
  const measuredFindings = useMemo(() => getTier(grouped, 'measured'), [grouped]);
  const reportedFindings = useMemo(() => getTier(grouped, 'reported'), [grouped]);
  const incidentalFindings = useMemo(() => getTier(grouped, 'incidental'), [grouped]);

  const severityCounts = useMemo(() => summarizeSeverities(grouped), [grouped]);
  const mismatchCount = useMemo(
    () => measuredFindings.filter(finding => finding.consistency !== 'match').length,
    [measuredFindings]
  );

  // The report format devotes a full section to every finding it includes, so
  // the default scope keeps the routine "normal structures" findings out.
  const reportEvidence = useMemo(
    () => (reportScope === 'all' ? evidence : measuredFindings),
    [evidence, measuredFindings, reportScope]
  );

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
    setEvidenceIndex(0);
    setActiveTab(0);
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
    setEvidenceIndex(0);
    setActiveTab(0);
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
    setEvidenceIndex(0);
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
    if (!completePayload) {
      return '';
    }

    return buildCiaiReportHtml({
      payload: completePayload,
      evidence: reportEvidence,
      study,
      logoUrl: `${window.location.origin}${LOGO_PATH}`,
      includeNarrative: true,
    });
  };

  const handleOpenReportViewer = () => {
    if (!completePayload) {
      return;
    }

    const html = buildReportViewerHtml({
      payload: completePayload,
      evidence,
      study,
      logoUrl: `${window.location.origin}${LOGO_PATH}`,
    });

    const viewerWindow = window.open('', '_blank');
    if (!viewerWindow) {
      return;
    }

    viewerWindow.document.open();
    viewerWindow.document.write(html);
    viewerWindow.document.close();
    viewerWindow.focus();
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
    downloadBlob(blob, `ciai-ai-report-${study.studyInstanceUid}.doc`);
  };

  const handleDownloadPdf = () => {
    const html = buildReportDocumentHtml();
    if (!html) {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1040,height=1180');
    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // The report embeds every evidence frame as a data URI, so it has to wait
    // for the images to decode — printing early yields blank evidence pages.
    // A ceiling keeps a stalled decode from leaving the user with no dialog.
    const print = () => {
      const images = Array.from(printWindow.document.images);
      const pending = images
        .filter(image => !image.complete)
        .map(
          image =>
            new Promise<void>(resolve => {
              image.addEventListener('load', () => resolve(), { once: true });
              image.addEventListener('error', () => resolve(), { once: true });
            })
        );

      const ceiling = new Promise<void>(resolve => {
        printWindow.setTimeout(resolve, 15000);
      });

      Promise.race([Promise.all(pending), ceiling]).then(() => {
        printWindow.setTimeout(() => printWindow.print(), 250);
      });
    };

    if (printWindow.document.readyState === 'complete') {
      print();
    } else {
      printWindow.addEventListener('load', print, { once: true });
    }
  };

  const hasResults = Boolean(completePayload);

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
          flexWrap="wrap"
          useFlexGap
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
            }}
          >
            AI
          </Box>
          <Box>
            <Box sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>AI Analysis</Box>
            <Box sx={{ color: '#91b7c2', fontSize: 12, marginTop: '3px' }}>
              Original → Human → CIAI AI → Heatmap → Radiologist verify
            </Box>
          </Box>
          <Chip
            size="small"
            color={STATUS_COLORS[displayStatus]}
            icon={<StatusGlyph status={displayStatus} />}
            label={STATUS_LABELS[displayStatus]}
            sx={{
              fontWeight: 800,
              '& .MuiChip-icon': { color: 'inherit' },
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
                gridTemplateColumns: { xs: '1fr', sm: '1.35fr 0.75fr 1.25fr' },
                gap: '14px',
              }}
            >
              <FieldValue
                label="Patient"
                value={completePayload?.patient_info?.patient_name || study.patientName}
              />
              <FieldValue
                label="Study Date"
                value={formatDicomDate(
                  completePayload?.study_info?.study_date || study.date
                )}
              />
              <FieldValue
                label="Study"
                value={
                  completePayload?.study_info?.study_description ||
                  study.description ||
                  'Medical imaging study'
                }
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
                  '& .MuiLinearProgress-bar': { backgroundColor: '#21b59b' },
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

          {hasResults && (
            <Box>
              <Tabs
                value={activeTab}
                onChange={(_event, value) => setActiveTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  marginBottom: '16px',
                  minHeight: 40,
                  '& .MuiTab-root': {
                    color: '#91b7c2',
                    fontWeight: 800,
                    fontSize: 13,
                    textTransform: 'none',
                    minHeight: 40,
                  },
                  '& .Mui-selected': { color: '#8be0f8 !important' },
                  '& .MuiTabs-indicator': { backgroundColor: '#8be0f8' },
                }}
              >
                <Tab label="Overview" />
                <Tab label={`Findings (${grouped.length})`} />
                <Tab label={`Image evidence (${evidence.length})`} />
                <Tab label="Narrative report" />
              </Tabs>

              {activeTab === 0 && (
                <Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '10px',
                      marginBottom: '16px',
                    }}
                  >
                    <StatCard
                      label="Measured"
                      value={measuredFindings.length}
                      hint="Verifiable against a picture"
                    />
                    <StatCard
                      label="Narrative only"
                      value={reportedFindings.length}
                      hint="No measurable image evidence"
                    />
                    <StatCard
                      label="Incidental"
                      value={incidentalFindings.length}
                      hint="Background observations"
                    />
                    <StatCard
                      label="Measurements"
                      value={getMeasurementRange(measuredFindings)}
                      hint="Image-level range"
                    />
                    <StatCard
                      label="Mismatches"
                      value={mismatchCount}
                      hint={`Largest gap ${getMaxDifferenceMm(measuredFindings)} mm`}
                    />
                    <StatCard
                      label="Reviewed"
                      value={findingsSummary.length}
                      hint={`${anomalyFindings.length} anomalies, ${grouped.length} after merging`}
                    />
                    <StatCard
                      label="Elapsed"
                      value={elapsedTime}
                    />
                  </Box>

                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ marginBottom: '16px' }}
                  >
                    <Box sx={{ color: '#8bbfd0', fontSize: 11, fontWeight: 800, alignSelf: 'center' }}>
                      ANOMALIES BY SEVERITY
                    </Box>
                    {(['critical', 'high', 'medium', 'low'] as const).map(severity => (
                      <Chip
                        key={severity}
                        size="small"
                        label={`${severity.toUpperCase()} ${severityCounts[severity]}`}
                        sx={{
                          backgroundColor: SEVERITY_COLORS[severity],
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: 11,
                        }}
                      />
                    ))}
                  </Stack>

                  <Box sx={{ fontSize: 14, fontWeight: 900, marginBottom: '2px' }}>
                    Recovered image-level AI measurements
                  </Box>
                  <Box sx={{ color: '#6f92a6', fontSize: 11.5, marginBottom: '8px' }}>
                    The findings a radiologist can verify against a picture. Click an ID to open its
                    evidence.
                  </Box>
                  <Box
                    sx={{
                      maxHeight: '38vh',
                      overflow: 'auto',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                    }}
                  >
                    <Box
                      component="table"
                      sx={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 12,
                        '& th': {
                          position: 'sticky',
                          top: 0,
                          background: '#0b1720',
                          color: '#8bbfd0',
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          textAlign: 'left',
                          padding: '9px 10px',
                          borderBottom: '1px solid rgba(255,255,255,0.12)',
                          zIndex: 1,
                        },
                        '& td': {
                          padding: '9px 10px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          color: '#dbeef5',
                          verticalAlign: 'top',
                        },
                      }}
                    >
                      <thead>
                        <tr>
                          <th>Finding</th>
                          <th>Image measurement</th>
                          <th>Image score</th>
                          <th>Narrative output</th>
                          <th>CIAI action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {measuredFindings.map((finding, index) => (
                          <tr key={`${finding.findingId}-${finding.frameKey}`}>
                            <td>
                              <Box
                                component="button"
                                type="button"
                                onClick={() => {
                                  setEvidenceIndex(index);
                                  setActiveTab(2);
                                }}
                                sx={{
                                  background: 'none',
                                  border: 0,
                                  padding: 0,
                                  color: '#8be0f8',
                                  fontWeight: 800,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                {finding.findingId} — {finding.name}
                              </Box>
                              <Box sx={{ color: '#8fb4c0', fontSize: 11 }}>
                                {finding.seriesLabel}
                              </Box>
                            </td>
                            <td>{finding.imageMeasurement.display}</td>
                            <td>{formatConfidence(finding.imageScore)}</td>
                            <td>
                              {finding.narrativeMeasurement.display} /{' '}
                              {formatConfidence(finding.narrativeScore)}
                            </td>
                            <td
                              style={{
                                color: finding.consistency === 'match' ? '#3fcf8e' : '#ff8f7a',
                                fontWeight: 700,
                              }}
                            >
                              {finding.consistency === 'match'
                                ? 'Consistent — preserve both'
                                : 'Preserve both + flag mismatch'}
                            </td>
                          </tr>
                        ))}
                        {!measuredFindings.length && (
                          <tr>
                            <td
                              colSpan={5}
                              style={{ textAlign: 'center', color: '#8fb4c0', padding: '24px' }}
                            >
                              No finding carried a measurement recoverable from the image.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Box>
                  </Box>
                </Box>
              )}

              {activeTab === 1 && (
                <FindingsTable
                  findings={grouped}
                  onOpenEvidence={finding => {
                    const index = evidence.findIndex(
                      item =>
                        item.findingId === finding.findingId && item.frameKey === finding.frameKey
                    );
                    if (index >= 0) {
                      setEvidenceIndex(index);
                      setActiveTab(2);
                    }
                  }}
                />
              )}

              {activeTab === 2 && (
                <EvidenceViewer
                  findings={evidence}
                  index={Math.min(evidenceIndex, Math.max(evidence.length - 1, 0))}
                  onIndexChange={setEvidenceIndex}
                  studyInstanceUid={study.studyInstanceUid}
                />
              )}

              {activeTab === 3 &&
                (reportText ? (
                  <Box
                    sx={{
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: '#fbfdfe',
                      color: '#1c2b33',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      '& h2': { margin: '0 0 14px', fontSize: 22 },
                      '& h3': { margin: '18px 0 8px', fontSize: 16 },
                      '& h4': { margin: '14px 0 6px', fontSize: 14 },
                      '& p': { lineHeight: 1.55, margin: '8px 0' },
                      '& ul, & ol': { margin: '8px 0', paddingLeft: '22px' },
                      '& table': { width: '100%', borderCollapse: 'collapse', margin: '10px 0' },
                      '& th, & td': {
                        border: '1px solid #d9e5ea',
                        padding: '8px',
                        textAlign: 'left',
                        fontSize: 12,
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
                        src={LOGO_PATH}
                        alt="CIAI Teleradiology"
                        sx={{ height: 30, objectFit: 'contain' }}
                      />
                      <Box>
                        <Box sx={{ fontSize: 18, fontWeight: 900 }}>AI Analysis Report</Box>
                        <Box sx={{ color: '#5f7884', fontSize: 12 }}>
                          Review generated findings with the original study images.
                        </Box>
                      </Box>
                    </Stack>
                    <Box
                      sx={{ padding: '22px', maxHeight: '46vh', overflow: 'auto' }}
                      dangerouslySetInnerHTML={{ __html: reportHtml }}
                    />
                  </Box>
                ) : (
                  <Alert severity="warning">Report text unavailable.</Alert>
                ))}

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

        {hasResults && (
          <TextField
            select
            size="small"
            value={reportScope}
            onChange={event => setReportScope(event.target.value as ReportScope)}
            sx={{
              minWidth: 230,
              '& .MuiInputBase-root': { color: '#eef7fb', background: '#0b1720' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(105, 210, 232, 0.25)' },
              '& .MuiSvgIcon-root': { color: '#8be0f8' },
            }}
          >
            <MenuItem value="significant">
              Report: significant findings ({reportEvidence.length})
            </MenuItem>
            <MenuItem value="all">Report: all image evidence ({evidence.length})</MenuItem>
          </TextField>
        )}

        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          onClick={handleOpenReportViewer}
          disabled={!hasResults}
          startIcon={<OpenInNewIcon />}
          endIcon={
            <Chip
              label="BETA"
              size="small"
              sx={{
                height: 16,
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 0.5,
                color: '#05221c',
                backgroundColor: '#12a58c',
                '& .MuiChip-label': { padding: '0 5px' },
              }}
            />
          }
          sx={{ color: '#6ee7d0', borderColor: '#12a58c' }}
        >
          Report UI
        </Button>
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
          disabled={!hasResults}
          startIcon={<DescriptionIcon />}
          sx={{ color: '#dff6ff', borderColor: '#477889' }}
        >
          Download DOC
        </Button>
        <Tooltip title="Opens the print view — choose “Save as PDF”">
          <span>
            <Button
              variant="outlined"
              onClick={handleDownloadPdf}
              disabled={!hasResults}
              startIcon={<PictureAsPdfIcon />}
              sx={{ color: '#dff6ff', borderColor: '#477889' }}
            >
              Download PDF
            </Button>
          </span>
        </Tooltip>
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
