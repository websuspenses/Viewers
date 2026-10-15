import React from 'react';
import classnames from 'classnames';

import {
  AiStudyState,
  STAGE_LABELS,
  describeAnalysis,
  isAnalysisIncomplete,
  describeReportStep,
  getAnalysisPercent,
  getReportPercent,
} from './aiPipeline';
import { AiReview, formatDecisionTime, rejectReasonLabel } from './aiReview';

import './aiStatusBadge.css';

function getReviewContent(review: AiReview | null | undefined) {
  if (!review) {
    return {
      label: 'AI ready · Not reviewed',
      detail: 'AI report ready — open it to accept or reject',
      review: 'pending' as const,
      percent: undefined as number | undefined,
    };
  }
  const accepted = review.decision === 'accepted';
  const who = review.user_name || 'a radiologist';
  const when = formatDecisionTime(review.decided_at);
  const reason = !accepted && rejectReasonLabel(review.reason);
  const changed = review.previous ? ` (changed from ${review.previous})` : '';
  return {
    label: accepted ? 'AI accepted' : 'AI rejected',
    detail: [`${accepted ? 'Accepted' : 'Rejected'} by ${who}`, when, reason].filter(Boolean).join(' · ') + changed,
    review: review.decision,
    percent: undefined as number | undefined,
  };
}

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
        label: isAnalysisIncomplete(state.analysis) ? 'Analysis incomplete' : 'Analysis complete',
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
  /**
   * Radiologist decision for a ready report: undefined = review not loaded
   * (plain "AI report ready"), null = not reviewed, or the latest decision.
   */
  review?: AiReview | null;
  isActive?: boolean;
  onClick?: () => void;
};

/**
 * Worklist pill for the automated AI pipeline. It carries the AI palette —
 * indigo, neon purple, deep cyan, hot pink, amber — as a gradient edge, tint
 * and "AI" mark (aiStatusBadge.css), so AI state reads as AI next to the
 * pastel study-status pill. Moving stages swap the dot for a spinner and carry
 * a gradient progress line, so running and finished studies differ at a glance.
 */
export default function AiStatusBadge({ state, review, isActive = false, onClick }: Props) {
  const reviewContent = state.stage === 'ready' && review !== undefined ? getReviewContent(review) : null;
  const { label, detail, percent } = reviewContent || getBadgeContent(state);
  const isMoving = ['analyzing', 'queued', 'generating'].includes(state.stage);
  const isInteractive = state.stage !== 'none' && Boolean(onClick);

  const className = classnames(
    'ai-badge',
    isActive && 'ai-badge--dark',
    isMoving && 'ai-badge--moving',
    isInteractive && 'ai-badge--interactive'
  );

  const content = (
    <>
      {isMoving ? (
        <span
          aria-hidden="true"
          className="ai-badge__spinner"
        />
      ) : reviewContent && reviewContent.review !== 'pending' ? (
        <span
          aria-hidden="true"
          className="ai-badge__review-icon"
        >
          {reviewContent.review === 'accepted' ? '✓' : '✕'}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="ai-badge__dot"
        />
      )}
      <span className="ai-badge__mark">AI</span>
      <span className="ai-badge__label">{label}</span>
      {typeof percent === 'number' && percent > 0 && (
        <span
          aria-hidden="true"
          className="ai-badge__progress"
          style={{ width: `${percent}%` }}
        />
      )}
    </>
  );

  if (!isInteractive) {
    return (
      <span
        className={className}
        data-stage={state.stage}
        data-review={reviewContent?.review}
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
      data-stage={state.stage}
      data-review={reviewContent?.review}
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
