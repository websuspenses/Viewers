import React from 'react';
import classnames from 'classnames';

import {
  AiStage,
  AiStudyState,
  STAGE_LABELS,
  describeAnalysis,
  describeReportStep,
  getAnalysisPercent,
  getReportPercent,
} from './aiPipeline';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

// Same tokens as the study StatusBadge so the two pills read as one system.
const TONE_CLASSES: Record<Tone, { light: string; dark: string; dot: string; bar: string }> = {
  info: {
    light: 'bg-statusBg-info text-statusText-info ring-statusRing-info',
    dark: 'bg-statusBg-infoDark text-statusText-infoDark ring-statusRing-infoDark',
    dot: 'bg-statusDot-info',
    bar: 'bg-statusDot-info',
  },
  success: {
    light: 'bg-statusBg-success text-statusText-success ring-statusRing-success',
    dark: 'bg-statusBg-successDark text-statusText-successDark ring-statusRing-successDark',
    dot: 'bg-statusDot-success',
    bar: 'bg-statusDot-success',
  },
  warning: {
    light: 'bg-statusBg-warning text-statusText-warning ring-statusRing-warning',
    dark: 'bg-statusBg-warningDark text-statusText-warningDark ring-statusRing-warningDark',
    dot: 'bg-statusDot-warning',
    bar: 'bg-statusDot-warning',
  },
  danger: {
    light: 'bg-statusBg-danger text-statusText-danger ring-statusRing-danger',
    dark: 'bg-statusBg-dangerDark text-statusText-dangerDark ring-statusRing-dangerDark',
    dot: 'bg-statusDot-danger',
    bar: 'bg-statusDot-danger',
  },
  neutral: {
    light: 'bg-statusBg-neutral text-statusText-neutral ring-statusRing-neutral',
    dark: 'bg-statusBg-neutralDark text-statusText-neutralDark ring-statusRing-neutralDark',
    dot: 'bg-statusDot-neutral',
    bar: 'bg-statusDot-neutral',
  },
};

const STAGE_TONES: Record<AiStage, Tone> = {
  none: 'neutral',
  analyzing: 'info',
  analysisFailed: 'danger',
  analyzed: 'info',
  queued: 'warning',
  generating: 'warning',
  reportFailed: 'danger',
  ready: 'success',
};

function getBadgeContent(state: AiStudyState) {
  switch (state.stage) {
    case 'analyzing': {
      const percent = getAnalysisPercent(state.analysis);
      return {
        label: percent ? `Analyzing ${percent}%` : 'Analyzing…',
        detail: describeAnalysis(state.analysis) || 'AI image analysis in progress',
        percent,
      };
    }
    case 'generating': {
      const step = Number(state.report?.step) || 0;
      const total = Number(state.report?.total_steps) || 0;
      return {
        label: step && total ? `Report ${step}/${total}` : 'Generating report',
        detail: describeReportStep(state.report) || 'Building the AI report',
        percent: getReportPercent(state.report),
      };
    }
    case 'queued':
      return { label: 'Report queued', detail: 'Waiting for report generation to start' };
    case 'analyzed':
      return {
        label: 'Analysis complete',
        detail: describeAnalysis(state.analysis) || 'Ready for report generation',
      };
    case 'ready':
      return { label: 'AI report ready', detail: 'Open the AI report' };
    case 'analysisFailed':
    case 'reportFailed':
      return { label: STAGE_LABELS[state.stage], detail: state.error || 'Open for details' };
    default:
      return { label: STAGE_LABELS.none, detail: 'No AI analysis for this study' };
  }
}

type Props = {
  state: AiStudyState;
  isActive?: boolean;
  onClick?: () => void;
};

/**
 * Worklist pill for the automated AI pipeline. Moving stages swap the status
 * dot for a spinner and carry a hairline progress bar, so a column of
 * finished and running studies can be told apart without reading the text.
 */
export default function AiStatusBadge({ state, isActive = false, onClick }: Props) {
  const tone = TONE_CLASSES[STAGE_TONES[state.stage]];
  const { label, detail, percent } = getBadgeContent(state);
  const isMoving = ['analyzing', 'queued', 'generating'].includes(state.stage);
  const isInteractive = state.stage !== 'none' && Boolean(onClick);

  const className = classnames(
    'relative inline-flex max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full px-2.5 py-1',
    'text-[11.5px] font-semibold leading-none ring-1 ring-inset',
    tone[isActive ? 'dark' : 'light'],
    state.stage === 'none' && 'opacity-70',
    isInteractive &&
      'cursor-pointer transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-statusDot-info'
  );

  const content = (
    <>
      {isMoving ? (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
        />
      ) : (
        <span className={classnames('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
      )}
      <span className="text-[9.5px] font-extrabold tracking-wide opacity-80">AI</span>
      <span className="truncate">{label}</span>
      {typeof percent === 'number' && percent > 0 && (
        <span
          aria-hidden="true"
          className={classnames('absolute bottom-0 left-0 h-[2px] transition-[width]', tone.bar)}
          style={{ width: `${percent}%` }}
        />
      )}
    </>
  );

  if (!isInteractive) {
    return (
      <span
        className={className}
        title={detail}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      title={detail}
      aria-label={`${label}. ${detail}`}
      onClick={event => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {content}
    </button>
  );
}
