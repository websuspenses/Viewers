import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { Divider } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '@mui/material/styles';

export default function ConfirmationDialog(props) {
  const { open, handleClose, screen } = props;

  const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuiDialogActions-root': {
      padding: theme.spacing(1),
    },
    '& .MuiPaper-root': {
      width: '495px !important',
    },

  }));

  return (
    <BootstrapDialog
      open={open}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{'Delete Confirmation'}</DialogTitle>
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: (theme) => theme.palette.grey[500],
        }}
      >
        <CloseIcon className='closeIconCls' />
      </IconButton>
      <Divider className='dividerCls' />
      <DialogContent>
        <DialogContentText id="alert-dialog-description" className='dialogContentCls'>
          {screen === 'ReportTemplatesList'
            ? 'Are you sure you want to delete this report template ? '
            : 'Are you sure you want to delete this user ? '}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          className='noBtnDialogCls'
          onClick={handleClose}>No</Button>
        <Button
          className='okBtnDialogCls'
          onClick={handleClose}
          autoFocus
        >
          Yes
        </Button>
      </DialogActions>
    </BootstrapDialog>
  );
}
