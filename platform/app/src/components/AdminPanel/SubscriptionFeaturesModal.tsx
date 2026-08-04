import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { Divider, Typography } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { StatusBadge } from '@ohif/ui';
import '../AdminPanel/style.css';

const getInitials = (name: string) => {
  if (!name) {
    return '?';
  }
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
};

export default function SubscriptionFeaturesModal(props) {
  const { open, handleClose, userRolesInfo, subscriptionFeaturesInfo, isActive } = props;

  let labsubsInfoArray = [];
  if (subscriptionFeaturesInfo) {
    labsubsInfoArray = subscriptionFeaturesInfo.split(',').map(item => item.trim());
  }

  const toCamelCase = (str: string) => {
    let fs = str
      .toLowerCase()
      .replace(/_/g, ' ');
    return fs.charAt(0).toUpperCase() + fs.slice(1);
  };

  const paperBg = isActive ? '#171a21' : '#ffffff';
  const paperColor = isActive ? '#f3f4f6' : '#111827';
  const mutedColor = isActive ? '#8890a0' : '#6b7280';
  const borderColor = isActive ? '#262b36' : '#e5e7eb';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="subscription-dialog-title"
      aria-describedby="subscription-dialog-description"
      PaperProps={{
        sx: {
          backgroundColor: paperBg,
          color: paperColor,
        },
      }}
      sx={{
        '& .MuiDialogContent-root': {
          padding: 2,
        },
        '& .MuiDialogActions-root': {
          padding: 1,
        },
        '& .MuiPaper-root': {
          width: '100% !important',
          maxHeight: '80vh',
          margin: '0 20%',
          maxWidth: 'unset',
          borderRadius: '12px',
        },
        '& .MuiDivider-root': {
          borderColor,
        },
      }}
    >
      <DialogTitle
        id="subscription-dialog-title"
        sx={{ fontWeight: 700 }}
      >
        User Information &amp; Subscription Features
      </DialogTitle>

      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: mutedColor,
        }}
      >
        <CloseIcon />
      </IconButton>
      <Divider />
      <DialogContent>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '16px',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #0a7c6c 0%, #2db4d3 100%)',
            }}
          >
            {getInitials(userRolesInfo.user_name)}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>
              {userRolesInfo.user_name}
            </p>
            <p style={{ margin: 0, color: mutedColor, fontSize: '13px' }}>
              {userRolesInfo.user_email}
            </p>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${borderColor}`,
            borderRadius: '10px',
            padding: '14px 16px',
          }}
        >
          <p style={{ margin: 0, fontSize: '13px', color: mutedColor }}>Lab</p>
          <p style={{ margin: '2px 0 10px', fontWeight: 600 }}>{userRolesInfo.lab_name}</p>
          <p style={{ margin: 0, fontSize: '13px', color: mutedColor }}>Subscription</p>
          <p style={{ margin: '2px 0 4px', fontWeight: 600 }}>{userRolesInfo.lab_subscription}</p>
          <p style={{ margin: '0 0 8px', fontSize: '13px' }}>{userRolesInfo.lab_subscription_desc}</p>
          <p style={{ margin: 0, fontSize: '12px', color: mutedColor }}>
            Some features are restricted based on your role and lab subscription type. Please
            reach out to your Lab Admin / TeleRadiology super admin for more information.
          </p>
        </div>
      </DialogContent>
      <DialogContent>
        <Typography
          variant="subtitle2"
          sx={{ mb: 1, fontWeight: 700 }}
        >
          Subscription Features
        </Typography>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {labsubsInfoArray.length > 0 ? (
            labsubsInfoArray.map((item, index) => (
              <StatusBadge
                key={index}
                label={toCamelCase(item)}
                variant="success"
                isActive={isActive}
              />
            ))
          ) : (
            <span style={{ fontSize: '13px', color: mutedColor }}>No features listed.</span>
          )}
        </div>
        <Typography
          variant="subtitle2"
          sx={{ mb: 1, fontWeight: 700 }}
        >
          Roles
        </Typography>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.entries(userRolesInfo?.user_roles || {}).length > 0 ? (
            Object.entries(userRolesInfo?.user_roles || {}).map(([key, value], index) => (
              <StatusBadge
                key={index}
                label={toCamelCase(value as string)}
                variant="info"
                isActive={isActive}
              />
            ))
          ) : (
            <span style={{ fontSize: '13px', color: mutedColor }}>No roles listed.</span>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button className="close-button" onClick={handleClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
