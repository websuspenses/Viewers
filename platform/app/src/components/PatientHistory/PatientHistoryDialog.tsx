import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

import type { ReviewApi } from '../../routes/WorkList/AiAnalysisDialog/aiReview';
import PatientHistoryPanel from './PatientHistoryPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  api: ReviewApi;
  patientId: string;
  patientName?: string;
  studyId?: string;
};

/** The patient's clinical history from the worklist (history icon next to the name). */
export default function PatientHistoryDialog({ open, onClose, api, patientId, patientName, studyId }: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="ph-dialog-title">
      <DialogTitle id="ph-dialog-title" sx={{ pr: 6 }}>
        Patient Clinical History
        <div className="ph-dialog-sub">
          {[patientName, patientId && `ID ${patientId}`].filter(Boolean).join(' · ')}
        </div>
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {open && <PatientHistoryPanel api={api} patientId={patientId} patientName={patientName} studyId={studyId} />}
      </DialogContent>
    </Dialog>
  );
}
