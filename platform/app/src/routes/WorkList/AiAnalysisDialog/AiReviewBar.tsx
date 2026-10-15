import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import {
  AiReview,
  AiReviewDecision,
  REJECT_REASONS,
  RejectReason,
  ReviewApi,
  currentUserSub,
  formatDecisionTime,
  rejectReasonLabel,
  submitReview,
} from './aiReview';

type Props = {
  studyInstanceUid: string;
  api: ReviewApi;
  /** Latest decision for this study, or null when not reviewed yet. */
  review: AiReview | null;
  /** The user has the review role (admin-role). Others see the status only. */
  canReview: boolean;
  /** The AI report has loaded; the buttons stay disabled until then. */
  reportLoaded: boolean;
  /** Findings flagged "[Verify: …]" by the study review. */
  verifyCount: number;
  /** Called with the saved decision, only after the server confirmed it. */
  onReviewChange: (review: AiReview | null) => void;
  /** Opens the report editor after "Accept & edit". */
  onOpenReportEditor?: () => void;
};

const COMMENT_MAX = 500;

const DIALOG_PAPER_SX = {
  background: '#0b1720',
  color: '#eef7fb',
  border: '1px solid rgba(127, 202, 222, 0.2)',
  borderRadius: '8px',
  width: 460,
  maxWidth: 'calc(100vw - 32px)',
};

const FIELD_SX = {
  '& .MuiInputBase-root': { color: '#eef7fb', background: '#071118' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(105, 210, 232, 0.25)' },
  '& .MuiInputLabel-root': { color: '#91b7c2' },
  '& .MuiFormHelperText-root': { color: '#7f9ea9' },
};

/**
 * Accept / reject bar under the AI report (docs §8.2–8.4). The decision is saved
 * first and shown after: nothing here or in the worklist changes until
 * POST /audit/review answers 200.
 */
export default function AiReviewBar({
  studyInstanceUid,
  api,
  review,
  canReview,
  reportLoaded,
  verifyCount,
  onReviewChange,
  onOpenReportEditor,
}: Props) {
  const [dialog, setDialog] = useState<AiReviewDecision | null>(null);
  const [changing, setChanging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState<RejectReason | ''>('');
  const [comment, setComment] = useState('');
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const retryRef = useRef<AiReviewDecision | null>(null);

  useEffect(() => {
    setChanging(false);
    setLocked(false);
    setDialog(null);
  }, [studyInstanceUid]);

  const openDialog = (decision: AiReviewDecision) => {
    setDialogError('');
    setVerified(false);
    setReason('');
    setComment('');
    setDialog(decision);
  };

  const closeDialog = () => {
    if (!saving) {
      setDialog(null);
    }
  };

  const save = async (decision: AiReviewDecision) => {
    setSaving(true);
    setDialogError('');
    const result = await submitReview(api, {
      studyInstanceUid,
      decision,
      reason: decision === 'rejected' ? reason : '',
      comment: decision === 'rejected' ? comment : '',
      expectedEventId: review?.event_id || null,
    });
    setSaving(false);

    if (result.kind === 'ok') {
      setDialog(null);
      setChanging(false);
      setLocked(Boolean(result.finalised));
      onReviewChange(result.review);
      setToast({ severity: 'success', text: decision === 'accepted' ? 'AI report accepted' : 'AI report rejected' });
      if (decision === 'accepted') {
        onOpenReportEditor?.();
      }
      return;
    }

    if (result.kind === 'conflict' || result.kind === 'locked') {
      // Someone else decided, or the report was finalised: show the real state.
      onReviewChange(result.review ?? review);
      if (result.kind === 'locked') {
        setLocked(true);
      }
      setDialogError(result.message);
      return;
    }
    if (result.kind === 'network') {
      retryRef.current = decision;
      setDialog(null);
      setToast({ severity: 'error', text: result.message });
      return;
    }
    setDialogError(result.message);
  };

  const byWhom = (r: AiReview) =>
    r.user_id && r.user_id === currentUserSub() ? 'you' : r.user_name || 'a radiologist';

  const renderStatus = () => {
    if (!review) {
      return <span style={{ color: '#ffd27a', fontWeight: 700 }}>Not reviewed yet</span>;
    }
    const accepted = review.decision === 'accepted';
    const when = formatDecisionTime(review.decided_at);
    const reasonText = !accepted && rejectReasonLabel(review.reason);
    return (
      <Box
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: accepted ? '#7ee2b8' : '#ff9aa8', fontWeight: 700 }}
      >
        {accepted ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <CancelIcon sx={{ fontSize: 18 }} />}
        {accepted ? 'Accepted' : 'Rejected'} by {byWhom(review)}
        {when && <span style={{ color: '#91b7c2', fontWeight: 500 }}>· {when}</span>}
        {reasonText && <span style={{ color: '#91b7c2', fontWeight: 500 }}>· {reasonText}</span>}
        {review.previous && (
          <span style={{ color: '#7f9ea9', fontWeight: 500 }}>(changed from {review.previous})</span>
        )}
      </Box>
    );
  };

  const showDecisionButtons = canReview && !locked && (!review || changing);
  const disabledTitle = reportLoaded ? undefined : 'Available once the AI report has loaded';

  return (
    <>
      <Box
        role="region"
        aria-label="AI report review"
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px 16px',
          padding: '12px 20px',
          background: '#0b1720',
          borderTop: '1px solid rgba(127, 202, 222, 0.16)',
          fontSize: 13,
        }}
      >
        {verifyCount > 0 && (
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ffd27a', fontWeight: 700 }}
          >
            <WarningAmberIcon sx={{ fontSize: 18 }} />
            {verifyCount} finding{verifyCount === 1 ? '' : 's'} need{verifyCount === 1 ? 's' : ''} verification
          </Box>
        )}
        <Box
          sx={{ flex: '1 1 260px', minWidth: 0 }}
          aria-live="polite"
        >
          {renderStatus()}
          {locked && (
            <Box
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '10px', color: '#91b7c2' }}
            >
              <LockIcon sx={{ fontSize: 15 }} /> Report finalised — decision locked
            </Box>
          )}
        </Box>

        {canReview && !locked && review && !changing && (
          <Button
            variant="text"
            onClick={() => setChanging(true)}
            sx={{ color: '#8be0f8', textTransform: 'none', fontWeight: 700 }}
          >
            Change decision
          </Button>
        )}
        {canReview && !changing && onOpenReportEditor && (
          <Button
            variant="outlined"
            onClick={onOpenReportEditor}
            disabled={!reportLoaded}
            sx={{ color: '#8be0f8', borderColor: '#2a8ca3' }}
          >
            {review ? 'Open report editor' : 'Review & edit'}
          </Button>
        )}

        {showDecisionButtons && (
          <Box sx={{ display: 'flex', gap: '10px' }}>
            {changing && (
              <Button
                variant="text"
                onClick={() => setChanging(false)}
                sx={{ color: '#91b7c2' }}
              >
                Keep current
              </Button>
            )}
            <span title={disabledTitle}>
              <Button
                variant="outlined"
                disabled={!reportLoaded || review?.decision === 'rejected'}
                onClick={() => openDialog('rejected')}
                startIcon={<CancelIcon />}
                sx={{ color: '#ff9aa8', borderColor: '#b9475a', '&.Mui-disabled': { color: '#4d6570', borderColor: '#24343c' } }}
              >
                Reject
              </Button>
            </span>
            <span title={disabledTitle}>
              <Button
                variant="contained"
                disabled={!reportLoaded || review?.decision === 'accepted'}
                onClick={() => openDialog('accepted')}
                startIcon={<CheckCircleIcon />}
                sx={{ backgroundColor: '#0a7c6c', '&:hover': { backgroundColor: '#0c917e' }, '&.Mui-disabled': { backgroundColor: '#14252d', color: '#4d6570' } }}
              >
                Accept &amp; edit
              </Button>
            </span>
          </Box>
        )}
      </Box>

      {/* Accept */}
      <Dialog
        open={dialog === 'accepted'}
        onClose={closeDialog}
        aria-labelledby="ai-accept-title"
        PaperProps={{ sx: DIALOG_PAPER_SX }}
      >
        <DialogTitle id="ai-accept-title" sx={{ fontWeight: 800 }}>
          Accept AI report?
        </DialogTitle>
        <DialogContent>
          <Box sx={{ color: '#c7dde4', fontSize: 14, lineHeight: 1.5 }}>
            The AI draft will be marked as accepted by you and opened in the report editor. You can
            still edit everything before finalising.
          </Box>
          {verifyCount > 0 && (
            <FormControlLabel
              sx={{ marginTop: '14px', color: '#eef7fb', alignItems: 'flex-start' }}
              control={
                <Checkbox
                  checked={verified}
                  onChange={event => setVerified(event.target.checked)}
                  sx={{ color: '#8be0f8', paddingTop: '2px' }}
                />
              }
              label={`I have reviewed the ${verifyCount} finding${verifyCount === 1 ? '' : 's'} marked "Verify"`}
            />
          )}
          {dialogError && (
            <Alert severity="warning" sx={{ marginTop: '14px' }}>
              {dialogError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ padding: '12px 20px 18px' }}>
          <Button
            autoFocus
            onClick={closeDialog}
            disabled={saving}
            sx={{ color: '#91b7c2' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => save('accepted')}
            disabled={saving || locked || (verifyCount > 0 && !verified)}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{ backgroundColor: '#0a7c6c', '&:hover': { backgroundColor: '#0c917e' } }}
          >
            {saving ? 'Saving…' : 'Accept'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject */}
      <Dialog
        open={dialog === 'rejected'}
        onClose={closeDialog}
        aria-labelledby="ai-reject-title"
        PaperProps={{ sx: DIALOG_PAPER_SX }}
      >
        <DialogTitle id="ai-reject-title" sx={{ fontWeight: 800 }}>
          Reject AI report?
        </DialogTitle>
        <DialogContent>
          <Box
            id="ai-reject-reason-label"
            sx={{ color: '#c7dde4', fontSize: 14, marginBottom: '6px' }}
          >
            Reason (required)
          </Box>
          <RadioGroup
            aria-labelledby="ai-reject-reason-label"
            value={reason}
            onChange={event => setReason(event.target.value as RejectReason)}
          >
            {REJECT_REASONS.map(option => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio sx={{ color: '#8be0f8' }} />}
                label={option.label}
                sx={{ color: '#eef7fb' }}
              />
            ))}
          </RadioGroup>
          <TextField
            id="ai-reject-comment"
            label="Comment (optional)"
            value={comment}
            onChange={event => setComment(event.target.value.slice(0, COMMENT_MAX))}
            multiline
            minRows={2}
            fullWidth
            size="small"
            helperText={`${comment.length}/${COMMENT_MAX}`}
            sx={{ marginTop: '12px', ...FIELD_SX }}
          />
          {dialogError && (
            <Alert severity="warning" sx={{ marginTop: '14px' }}>
              {dialogError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ padding: '12px 20px 18px' }}>
          <Button
            autoFocus
            onClick={closeDialog}
            disabled={saving}
            sx={{ color: '#91b7c2' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => save('rejected')}
            disabled={saving || locked || !reason}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
          >
            {saving ? 'Saving…' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.severity === 'error' ? null : 4000}
        onClose={(_, why) => why !== 'clickaway' && setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.severity || 'success'}
          onClose={() => setToast(null)}
          action={
            toast?.severity === 'error' && retryRef.current ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  // Reopens the same dialog with the reason and comment kept.
                  const decision = retryRef.current;
                  setToast(null);
                  if (decision) {
                    setDialogError('');
                    setDialog(decision);
                  }
                }}
              >
                Retry
              </Button>
            ) : undefined
          }
          sx={{ width: '100%' }}
        >
          {toast?.text}
        </Alert>
      </Snackbar>
    </>
  );
}
