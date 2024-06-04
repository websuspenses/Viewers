import React, { useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
  '& .MuiPaper-root': {
    width: '550px !important',
  },
}));

function GenerateReferral(props) {
  const { open, handleClose, StudyInstanceUId } = props;

  const [value, setValue] = useState('');
  const [doctorsData, setDoctorsData] = useState([]);

  const handleChange = event => {
    console.log('dropdown value', event.target.name, doctorsData);

    setValue(event.target.value);
  };

  // const object = doctorsData && doctorsData.find(item => item.doc_id === value);
  // console.log('object', object, value);

  useEffect(() => {
    fetch(`http://localhost:3300/get_referral_doctors`)
      .then(response => response.json())
      .then(actualData => {
        console.log('actualData ', actualData);
        setDoctorsData(actualData.data);
      })
      .catch(err => {
        console.log(err.message);
      });
  }, []);

  function sendStudyReferral(event) {
    event.preventDefault();
    const url = 'http://localhost:3300/send_study_referral';

    const viewerUrl = 'http://localhost:3000';

    const formData = {
      sr_to_doctor: value,
      sr_requester_id: 2,
      sr_requester_comments: `Hello Dr. Laxman,I have shared below study with you.Can you please check and provide your feedback sir,Link: ${viewerUrl}/viewer?StudyInstanceUIDs=${StudyInstanceUId}`,
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    };

    try {
      const res = fetch(url, options);
      if (res) {
        handleClose();
      }
      console.log('response ', res);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  const handleResetInform = () => {
    setValue('');
  };

  return (
    <BootstrapDialog
      aria-labelledby="customized-dialog-title"
      open={open}
    >
      <DialogTitle
        sx={{ m: 0, p: 2 }}
        id="customized-dialog-title"
      >
        Doctor Referral
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
        <CloseIcon className="closeIconCls" />
      </IconButton>
      <DialogContent>
        <div className="user-view _add-view">
          <div className="box-AlignCls">
            <div className="row">
              <div className="col-sm-12 col-md-6">
                <label
                  htmlFor="dropdown"
                  className="PatientNameCls"
                >
                  Doctor Name :
                </label>
                &nbsp;&nbsp;
                <select
                  className="doctorsListCls"
                  value={value}
                  onChange={handleChange}
                >
                  <option value="">Select</option>
                  {doctorsData.map((option, index) => (
                    <option
                      key={index}
                      value={option.doc_id}
                    >
                      {option.doc_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Stack
          direction="row"
          spacing={2}
        >
          <Button
            variant="contained"
            color="error"
            className="borderRadiusCls"
            onClick={handleResetInform}
          >
            Clear
          </Button>
          <Button
            variant="contained"
            className="submitBtnMuiRefCls borderRadiusCls"
            onClick={sendStudyReferral}
          >
            Refer
          </Button>
        </Stack>
      </DialogActions>
    </BootstrapDialog>
  );
}

export default GenerateReferral;