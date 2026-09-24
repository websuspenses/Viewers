import React, { useEffect, useMemo, useState } from 'react';
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
import DataObjectIcon from '@mui/icons-material/DataObject';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
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
  FetchedFrameImages,
  GroupedFinding,
  TIER_LABELS,
  buildAllFindingRecords,
  buildEvidenceFindings,
  formatConfidence,
  formatDicomDate,
  getAnomalyFindings,
  getFramesMissingImages,
  getImageSrc,
  getMaxDifferenceMm,
  getMeasurementRange,
  getReportableFindings,
  getTier,
  groupEvidenceFindings,
  normalizeAiPayload,
  summarizeSeverities,
  withFrameImages,
} from './aiReportModel';
import { renderSafeReportMarkdown, stripLowPriorityFindings } from './reportMarkdown';
import { buildCiaiReportHtml } from './buildCiaiReportHtml';
import { buildReportViewerHtml } from './buildReportViewerHtml';
import { AiStage, AiStudyState, STAGE_LABELS, describeAnalysis } from './aiPipeline';
import AiPipelineTracker from './AiPipelineTracker';

/** Shared with the printed report and the beta viewer so branding stays in step. */
const LOGO_PATH = '/ohif-whitebg-logo.svg';

type AiProgressEvent = {
  step?: number;
  total_steps?: number;
  status?: string;
  message?: string;
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
  /** Pipeline state for this study, kept current by the worklist poller. */
  aiState: AiStudyState;
  onGenerateReport: () => void;
  loadResult: (options?: { force?: boolean }) => Promise<AiCompletePayload>;
  /** Original, heatmap and AI-marking images for a heatmap `frame_key`, as data URIs. */
  loadFrameImages: (instanceId: string) => Promise<FetchedFrameImages>;
};

type FrameLoadState = 'loading' | 'failed';

/** Enough to fill the evidence tab quickly without flooding the PACS. */
const FRAME_FETCH_CONCURRENCY = 4;

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

function MetricChip({ label, value }: { label: string; value?: string | number }) {
  // A value that has not arrived yet is not a zero.
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <Chip
      label={`${label}: ${value}`}
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

function EvidencePanel({
  label,
  image,
  emptyText,
  caption,
}: {
  label: string;
  image: string;
  emptyText: string;
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
          <Box
            component="img"
            src={getImageSrc(image)}
            alt={label}
            sx={{ display: 'block', maxWidth: '100%', maxHeight: 340, width: 'auto' }}
          />
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
  frameLoadState = {},
}: {
  findings: EvidenceFinding[];
  index: number;
  onIndexChange: (next: number) => void;
  studyInstanceUid: string;
  frameLoadState?: Record<string, FrameLoadState>;
}) {
  const finding = findings[index];

  if (!finding) {
    return (
      <Alert severity="info">
        No finding in this study resolved to an image frame, so there is no image evidence to review.
      </Alert>
    );
  }

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
          emptyText={
            frameLoadState[finding.frameKey] === 'loading'
              ? 'Loading frame from the PACS…'
              : frameLoadState[finding.frameKey] === 'failed'
              ? 'The frame could not be loaded from the PACS.'
              : 'Original frame was not returned by the analysis service.'
          }
          caption="Unmodified frame at the AI-detected location. No overlay applied."
        />
      </Box>

      {/* The three images the analysis service returns, and nothing else. There
          is no manual measurement in the response, so a "human marking" panel
          could only be the AI's own box drawn over the original and captioned as
          though a person had placed it. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: '10px',
        }}
      >
        {!!finding.annotatedImage && (
          <EvidencePanel
            label="2. CIAI AI marking"
            image={finding.annotatedImage}
            emptyText="AI marking was not returned for this frame."
            caption={`AI localization as returned by the analysis service. Image measurement: ${aiLabel}`}
          />
        )}
        {!!finding.heatmapImage && (
          <EvidencePanel
            label={`${finding.annotatedImage ? '3' : '2'}. Heatmap — final evidence layer`}
            image={finding.heatmapImage}
            emptyText="Heatmap unavailable."
            caption="Supports the finding. Does not replace the original DICOM image."
          />
        )}
      </Box>

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

const STAGE_DIALOG_STATUS: Record<AiStage, AiDialogStatus> = {
  none: 'idle',
  analyzing: 'running',
  analysisFailed: 'failed',
  analyzed: 'idle',
  queued: 'running',
  generating: 'running',
  reportFailed: 'failed',
  ready: 'completed',
};

const ACTION_BUTTON_SX = { color: '#dff6ff', borderColor: '#477889' };

export default function AiAnalysisDialog({
  open,
  onClose,
  study,
  aiState,
  onGenerateReport,
  loadResult,
  loadFrameImages,
}: Props) {
  // The result as the server sent it; exported verbatim as JSON.
  const [rawPayload, setRawPayload] = useState<AiCompletePayload | null>(null);
  const [frameImages, setFrameImages] = useState<Record<string, FetchedFrameImages>>({});
  const [frameLoadState, setFrameLoadState] = useState<Record<string, FrameLoadState>>({});
  const [resultError, setResultError] = useState('');
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [evidenceIndex, setEvidenceIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [reportScope, setReportScope] = useState<ReportScope>('significant');
  const [betaView, setBetaView] = useState(false);

  const isReady = aiState.stage === 'ready';

  useEffect(() => {
    setRawPayload(null);
    setFrameImages({});
    setFrameLoadState({});
    setResultError('');
    setReloadCount(0);
    setShowErrors(false);
    setEvidenceIndex(0);
    setActiveTab(0);
    setBetaView(false);
  }, [study.studyInstanceUid]);

  // The result only exists once the report is ready; the stage flips to ready
  // while the dialog is open when polling sees the report finish.
  useEffect(() => {
    if (!open || !isReady) {
      return undefined;
    }

    let cancelled = false;
    setIsLoadingResult(true);
    setResultError('');

    loadResult({ force: reloadCount > 0 })
      .then(payload => {
        if (!cancelled) {
          setRawPayload(payload);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setResultError(error instanceof Error ? error.message : 'The AI report could not be loaded.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingResult(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, isReady, loadResult, reloadCount]);

  // The stored report keeps findings per series and no images, so it is brought
  // to the stream's shape and the original frames are filled in as they load.
  const normalizedPayload = useMemo(() => normalizeAiPayload(rawPayload), [rawPayload]);
  const completePayload = useMemo(
    () => withFrameImages(normalizedPayload, frameImages),
    [normalizedPayload, frameImages]
  );

  useEffect(() => {
    const pending = getFramesMissingImages(normalizedPayload);
    if (!open || !pending.length) {
      return undefined;
    }

    let cancelled = false;
    const queue = [...pending];
    setFrameLoadState(Object.fromEntries(pending.map(key => [key, 'loading' as const])));

    const worker = async () => {
      while (!cancelled && queue.length) {
        const key = queue.shift() as string;
        try {
          const images = await loadFrameImages(key);
          if (!cancelled) {
            setFrameImages(current => ({ ...current, [key]: images }));
            setFrameLoadState(({ [key]: _done, ...rest }) => rest);
          }
        } catch {
          if (!cancelled) {
            setFrameLoadState(current => ({ ...current, [key]: 'failed' }));
          }
        }
      }
    };

    Array.from({ length: Math.min(FRAME_FETCH_CONCURRENCY, queue.length) }, worker);

    return () => {
      cancelled = true;
    };
  }, [open, normalizedPayload, loadFrameImages]);

  const framesLoading = Object.values(frameLoadState).filter(state => state === 'loading').length;

  const resultStatus = useMemo(
    () => (completePayload ? classifyAiAnalysisResult(completePayload, []) : null),
    [completePayload]
  );
  const displayStatus: AiDialogStatus =
    resultStatus || (isReady && isLoadingResult ? 'running' : STAGE_DIALOG_STATUS[aiState.stage]);
  const displayLabel = resultStatus ? STATUS_LABELS[resultStatus] : STAGE_LABELS[aiState.stage];

  const reportText = completePayload?.report?.report_text || '';
  const reportHtml = useMemo(
    () => renderSafeReportMarkdown(stripLowPriorityFindings(reportText)),
    [reportText]
  );
  const findingsSummary = completePayload?.findings_summary || [];
  const anomalyFindings = useMemo(() => getAnomalyFindings(findingsSummary), [findingsSummary]);
  const evidence = useMemo(() => buildEvidenceFindings(completePayload), [completePayload]);

  // One row per distinct finding, sorted by what can be done with it. The
  // analysis runs per frame, so the same lesion arrives once per slice it
  // appears on; grouping is what keeps a single calcification from filling six
  // rows, and the tier is what separates a measurable mass from background.
  // Low-severity findings are excluded: two thirds of a study, and none has
  // carried a measurement recoverable from the image.
  const grouped = useMemo(
    () => getReportableFindings(groupEvidenceFindings(buildAllFindingRecords(completePayload))),
    [completePayload]
  );
  const measuredFindings = useMemo(() => getTier(grouped, 'measured'), [grouped]);
  const reportedFindings = useMemo(() => getTier(grouped, 'reported'), [grouped]);

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

  const betaViewerHtml = useMemo(
    () =>
      completePayload && betaView && framesLoading === 0
        ? buildReportViewerHtml({
            payload: completePayload,
            evidence,
            study,
            logoUrl: `${window.location.origin}${LOGO_PATH}`,
          })
        : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completePayload, evidence, betaView, framesLoading === 0, study.studyInstanceUid]
  );

  const processingErrors = completePayload?.processing_errors || [];
  const framesAnalyzed = completePayload?.total_frames_processed ?? aiState.analysis?.analyzed;
  const warningMessage =
    displayStatus === 'unable'
      ? GPU_DOWN_MESSAGE
      : displayStatus === 'warning'
      ? 'AI analysis completed with warnings. Review the details before using this report.'
      : '';

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

    const html =
      betaViewerHtml ||
      buildReportViewerHtml({
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

  const handleDownloadJson = () => {
    if (!rawPayload) {
      return;
    }
    const blob = new Blob([JSON.stringify(rawPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    downloadBlob(blob, `ciai-ai-report-${study.studyInstanceUid}.json`);
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
  // Exports embed the frames, so they wait until every frame has settled.
  const exportsReady = hasResults && framesLoading === 0;

  const renderPipelineState = () => {
    if (isReady && isLoadingResult) {
      return (
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          role="status"
          sx={{ padding: '28px 4px', color: '#9fc4ce', fontWeight: 700 }}
        >
          <CircularProgress
            size={20}
            thickness={5}
          />
          <Box>Loading AI report…</Box>
        </Stack>
      );
    }

    return (
      <Stack spacing={2}>
        <AiPipelineTracker state={aiState} />

        {isReady && resultError && (
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setReloadCount(count => count + 1)}
              >
                Try again
              </Button>
            }
          >
            {resultError}
          </Alert>
        )}

        {aiState.stage === 'analyzed' && (
          <Alert
            severity="info"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={onGenerateReport}
              >
                Generate report
              </Button>
            }
          >
            Image analysis is complete. The report has not been generated yet.
          </Alert>
        )}

        {aiState.stage === 'reportFailed' && (
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={onGenerateReport}
              >
                Try again
              </Button>
            }
          >
            {aiState.error || 'Report generation failed.'}
          </Alert>
        )}

        {aiState.stage === 'analysisFailed' && (
          <Alert severity="error">
            {aiState.error || 'Image analysis failed.'} Re-upload the study to run it again.
          </Alert>
        )}

        {aiState.stage === 'none' && (
          <Alert severity="info">
            This study has no AI analysis. Analysis runs automatically for newly uploaded studies.
          </Alert>
        )}

        {['analyzing', 'queued', 'generating'].includes(aiState.stage) && (
          <Box sx={{ color: '#7f9ea9', fontSize: 12 }}>
            This runs on the server. You can close this window — the worklist keeps tracking it
            and the report opens here when it is ready.
          </Box>
        )}
      </Stack>
    );
  };

  return (
    <BootstrapDialog
      open={open}
      onClose={onClose}
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
              Automated on upload · Original → CIAI AI marking → Heatmap → Radiologist verify
            </Box>
          </Box>
          <Chip
            size="small"
            color={STATUS_COLORS[displayStatus]}
            icon={<StatusGlyph status={displayStatus} />}
            label={displayLabel}
            sx={{
              fontWeight: 800,
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
        </Stack>
        <IconButton
          aria-label="close"
          onClick={onClose}
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
                value={formatDicomDate(completePayload?.study_info?.study_date || study.date)}
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

          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ marginBottom: '18px' }}
          >
            <MetricChip
              label="Series"
              value={completePayload?.total_series_analyzed}
            />
            <MetricChip
              label="Frames"
              value={aiState.analysis?.total}
            />
            <MetricChip
              label="Analyzed"
              value={framesAnalyzed}
            />
            {!!aiState.analysis?.skipped && (
              <MetricChip
                label="Skipped"
                value={aiState.analysis.skipped}
              />
            )}
            <MetricChip
              label="Findings"
              value={completePayload?.total_anomalies_found}
            />
            {!!processingErrors.length && (
              <MetricChip
                label="Warnings"
                value={processingErrors.length}
              />
            )}
          </Stack>

          {!hasResults && renderPipelineState()}

          {warningMessage && (
            <Alert
              severity={displayStatus === 'unable' ? 'error' : 'warning'}
              sx={{ marginBottom: '16px' }}
            >
              {warningMessage}
            </Alert>
          )}

          {hasResults && (
            <Box>
              <Stack
                direction="row"
                alignItems="center"
                sx={{
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  marginBottom: '16px',
                  gap: '8px',
                }}
              >
                <Tabs
                  value={betaView ? false : activeTab}
                  onChange={(_event, value) => {
                    setActiveTab(value);
                    setBetaView(false);
                  }}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    flex: 1,
                    minWidth: 0,
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
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={betaView}
                      onChange={event => setBetaView(event.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#12a58c' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#12a58c',
                        },
                      }}
                    />
                  }
                  label={
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                    >
                      <Box sx={{ fontSize: 12.5, fontWeight: 800, color: '#6ee7d0' }}>
                        Beta view
                      </Box>
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
                    </Stack>
                  }
                  sx={{ marginRight: 0, flexShrink: 0 }}
                />
              </Stack>

              {!!framesLoading && (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  role="status"
                  sx={{ color: '#9fc4ce', fontSize: 12, marginBottom: '12px' }}
                >
                  <CircularProgress
                    size={14}
                    thickness={5}
                  />
                  <Box>
                    Loading image frames from the PACS ({framesLoading} remaining) — exports and
                    the beta view are available once they finish.
                  </Box>
                </Stack>
              )}

              {betaView && !betaViewerHtml ? null : betaView ? (
                <Box
                  component="iframe"
                  title="AI report — beta view"
                  srcDoc={betaViewerHtml}
                  // Scripts only: the report is generated content, so it gets no
                  // access to this origin's session or storage.
                  sandbox="allow-scripts"
                  sx={{
                    display: 'block',
                    width: '100%',
                    height: '68vh',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    background: '#ffffff',
                  }}
                />
              ) : (
                <>
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
                      label="Frames analyzed"
                      value={framesAnalyzed ?? '—'}
                      hint={describeAnalysis(aiState.analysis) || undefined}
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
                  frameLoadState={frameLoadState}
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
                </>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        {hasResults && (
          <Tooltip title="Reload the latest report from the server">
            <Button
              variant="outlined"
              onClick={() => setReloadCount(count => count + 1)}
              disabled={isLoadingResult}
              startIcon={<RefreshIcon />}
              sx={{ color: '#8be0f8', borderColor: '#2a8ca3' }}
            >
              Refresh
            </Button>
          </Tooltip>
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
              Report: significant findings ({measuredFindings.length})
            </MenuItem>
            <MenuItem value="all">Report: all image evidence ({evidence.length})</MenuItem>
          </TextField>
        )}

        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          onClick={handleOpenReportViewer}
          disabled={!exportsReady}
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
          sx={ACTION_BUTTON_SX}
        >
          Copy Report
        </Button>
        <Button
          variant="outlined"
          onClick={handleDownloadDoc}
          disabled={!exportsReady}
          startIcon={<DescriptionIcon />}
          sx={ACTION_BUTTON_SX}
        >
          DOC
        </Button>
        <Tooltip title="Opens the print view — choose “Save as PDF”">
          <span>
            <Button
              variant="outlined"
              onClick={handleDownloadPdf}
              disabled={!exportsReady}
              startIcon={<PictureAsPdfIcon />}
              sx={ACTION_BUTTON_SX}
            >
              PDF
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Raw AI result, as returned by the server">
          <span>
            <Button
              variant="outlined"
              onClick={handleDownloadJson}
              disabled={!hasResults}
              startIcon={<DataObjectIcon />}
              sx={ACTION_BUTTON_SX}
            >
              JSON
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="contained"
          onClick={onClose}
          sx={{ backgroundColor: '#0a7c6c' }}
        >
          Close
        </Button>
      </DialogActions>
    </BootstrapDialog>
  );
}

export { classifyAiAnalysisResult, renderSafeReportMarkdown };
