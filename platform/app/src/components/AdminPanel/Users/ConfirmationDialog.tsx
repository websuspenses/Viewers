import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import isDarkTheme from '../../../utils/isDarkTheme';

const MESSAGES = {
  ReportTemplatesList: 'Are you sure you want to delete this report template?',
  DoctorReferralsList: 'Are you sure you want to delete this specialist?',
};

/** Delete confirmation, themed like the rest of the app (ui Modal/ciai-dialog.css). */
export default function ConfirmationDialog(props) {
  const { open, handleClose, screen, isActive } = props;
  const isDark = isActive ?? isDarkTheme();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      PaperProps={{
        className: `ciai-dialog ciai-dialog--sm${isDark ? ' ciai-dialog--dark' : ''}`,
      }}
    >
      <div className="ciai-dialog__head">
        <div className="ciai-dialog__icon ciai-dialog__icon--danger">
          <DeleteOutlineIcon />
        </div>
        <div className="ciai-dialog__titles">
          <h2
            id="confirm-dialog-title"
            className="ciai-dialog__title"
          >
            Delete confirmation
          </h2>
          <p
            id="confirm-dialog-description"
            className="ciai-dialog__subtitle"
          >
            {MESSAGES[screen] || 'Are you sure you want to delete this user?'} This cannot be
            undone.
          </p>
        </div>
        <button
          type="button"
          className="ciai-dialog__close"
          aria-label="Close"
          onClick={handleClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="ciai-dialog__foot">
        <span className="ciai-spacer" />
        <button
          type="button"
          className="ciai-btn"
          onClick={handleClose}
          autoFocus
        >
          Cancel
        </button>
        <button
          type="button"
          className="ciai-btn ciai-btn--danger"
          onClick={handleClose}
        >
          Delete
        </button>
      </div>
    </Dialog>
  );
}
