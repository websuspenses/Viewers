import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

import {
  AiStudyState,
  describeAnalysis,
  describeReportStep,
  getAnalysisPercent,
  getReportPercent,
} from './aiPipeline';

type StepStatus = 'pending' | 'running' | 'done' | 'failed';

type TrackerStep = {
  key: string;
  title: string;
  status: StepStatus;
  detail: string;
  percent?: number;
};

const STEP_ACCENTS: Record<StepStatus, string> = {
  pending: 'rgba(255,255,255,0.28)',
  running: '#2db4d3',
  done: '#21b59b',
  failed: '#ff8f7a',
};

function buildSteps(state: AiStudyState): TrackerStep[] {
  const { stage, analysis, report, error } = state;
  const analysisDone = !['none', 'analyzing', 'analysisFailed'].includes(stage);

  const analysisStep: TrackerStep = {
    key: 'analysis',
    title: 'Image analysis',
    status:
      stage === 'analysisFailed'
        ? 'failed'
        : stage === 'analyzing'
        ? 'running'
        : analysisDone
        ? 'done'
        : 'pending',
    detail:
      describeAnalysis(analysis) ||
      (stage === 'none' ? 'Starts automatically when the study is uploaded' : ''),
    percent: stage === 'analyzing' ? getAnalysisPercent(analysis) : undefined,
  };
  if (stage === 'analysisFailed' && error) {
    analysisStep.detail = [analysisStep.detail, error].filter(Boolean).join(' · ');
  }

  const reportStep: TrackerStep = {
    key: 'report',
    title: 'Report generation',
    status:
      stage === 'reportFailed'
        ? 'failed'
        : stage === 'queued' || stage === 'generating'
        ? 'running'
        : stage === 'ready'
        ? 'done'
        : 'pending',
    detail:
      stage === 'queued'
        ? 'Queued — waiting for the report service'
        : stage === 'reportFailed'
        ? error || describeReportStep(report) || 'Report generation failed'
        : describeReportStep(report) ||
          (stage === 'analyzed' ? 'Starts once image analysis completes' : ''),
    percent: stage === 'generating' ? getReportPercent(report) : undefined,
  };

  const readyStep: TrackerStep = {
    key: 'ready',
    title: 'Report ready',
    status: stage === 'ready' ? 'done' : 'pending',
    detail: stage === 'ready' ? 'Findings, heatmaps and narrative are available' : '',
  };

  return [analysisStep, reportStep, readyStep];
}

function StepIcon({ status }: { status: StepStatus }) {
  const sx = { fontSize: 20, color: STEP_ACCENTS[status] };
  if (status === 'running') {
    return (
      <CircularProgress
        size={17}
        thickness={5}
        sx={{ color: STEP_ACCENTS.running, margin: '1.5px' }}
      />
    );
  }
  if (status === 'done') {
    return <CheckCircleIcon sx={sx} />;
  }
  if (status === 'failed') {
    return <ErrorOutlineIcon sx={sx} />;
  }
  return <RadioButtonUncheckedIcon sx={sx} />;
}

/**
 * The automated pipeline as three stages. Only the stage that is moving gets a
 * progress bar; finished and pending stages stay one line tall so the tracker
 * never pushes the report off screen.
 */
export default function AiPipelineTracker({ state }: { state: AiStudyState }) {
  const steps = buildSteps(state);

  return (
    <Box
      component="ol"
      aria-label="AI pipeline progress"
      sx={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#0b1720',
      }}
    >
      {steps.map((step, index) => (
        <Box
          component="li"
          key={step.key}
          aria-current={step.status === 'running' ? 'step' : undefined}
          sx={{
            padding: '12px 14px',
            borderBottom: index < steps.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 0,
            background:
              step.status === 'running'
                ? 'rgba(45, 180, 211, 0.07)'
                : step.status === 'failed'
                ? 'rgba(255, 143, 122, 0.07)'
                : 'transparent',
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
          >
            <Box sx={{ lineHeight: 0, paddingTop: '1px' }}>
              <StepIcon status={step.status} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="baseline"
              >
                <Box
                  sx={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: step.status === 'pending' ? '#7f9ea9' : '#eef7fb',
                  }}
                >
                  {step.title}
                </Box>
                {typeof step.percent === 'number' && (
                  <Box
                    sx={{
                      marginLeft: 'auto !important',
                      color: '#9fc4ce',
                      fontSize: 12,
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {step.percent}%
                  </Box>
                )}
              </Stack>
              {step.detail && (
                <Box
                  role={step.status === 'running' ? 'status' : undefined}
                  sx={{
                    color: step.status === 'failed' ? '#ffb4a6' : '#91b7c2',
                    fontSize: 12,
                    marginTop: '2px',
                  }}
                >
                  {step.detail}
                </Box>
              )}
              {typeof step.percent === 'number' && (
                <LinearProgress
                  variant={step.percent > 0 ? 'determinate' : 'indeterminate'}
                  value={step.percent}
                  sx={{
                    marginTop: '8px',
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': { backgroundColor: STEP_ACCENTS.running },
                  }}
                />
              )}
            </Box>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
