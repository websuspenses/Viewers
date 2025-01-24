import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { Divider, Typography, List, ListItem, ListItemText } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import '../AdminPanel/style.css';



export default function SubscriptionFeaturesModal(props) {
  const { open, handleClose, userRolesInfo, subscriptionFeaturesInfo } = props;
  // console.log("userRolesInfo ", userRolesInfo);

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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="subscription-dialog-title"
      aria-describedby="subscription-dialog-description"
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
          maxWidth: 'unset'
        },
      }}
    >
      <DialogTitle id="subscription-dialog-title">
        User Information & Subscription Features
      </DialogTitle>

      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: theme => theme.palette.grey[500],
        }}
      >
        <CloseIcon />
      </IconButton>
      <Divider />
      <DialogContent className='user-lab-details'>
        <p>Name: <span className="user-name">{userRolesInfo.user_name}</span></p>
        <p>Email: <span className="user-name">{userRolesInfo.user_email}</span></p>
        <br />
        <p>Lab Name: <span className="user-name">{userRolesInfo.lab_name}</span></p>
        <p>Subscription: <span className="user-name">{userRolesInfo.lab_subscription}</span><br />
        <span>{userRolesInfo.lab_subscription_desc}</span><br />
        <span className='sub-note'>There are some features restrcited based on your role and Lab Subscription type. Please reach out to your Lab Admin / TeleRadiology super Admin for more information</span>
        </p>
      </DialogContent>
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Subscription Details
        </Typography>
        <Divider />
        {labsubsInfoArray.map((item, index) => (
          <span className="sub-item" key={index}>{toCamelCase(item)}</span>
        ))}
        <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
           Roles
        </Typography>
        <Divider />
        {Object.entries(userRolesInfo?.user_roles || {}).map(([key, value], index) => (

          <span className="sub-item" key={index}> {toCamelCase(value)}</span>

        ))}

      </DialogContent>
      <DialogActions>
        <Button className="close-button" onClick={handleClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
