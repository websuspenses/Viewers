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
import { useNavigate } from 'react-router-dom';

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

function generaterandomString(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

function GenerateReferral(props) {
  const navigate = useNavigate();
  const { open, handleClose, StudyInstanceUId } = props;
  const nodeAppHost = '/teleapp';
  const hostName = '/pacs/dicom-web/';
  const [value, setValue] = useState('');
  const [doctorsData, setDoctorsData] = useState([]);

  const handleChange = event => {
    console.log('dropdown value', event.target.name, doctorsData);

    setValue(event.target.value);
  };

  // const object = doctorsData && doctorsData.find(item => item.doc_id === value);
  // console.log('object', object, value);

  useEffect(() => {
    let authHeaders = localStorage.getItem('auth-t');
    console.log("local headers ", authHeaders);
    fetch(`${nodeAppHost}/get_referral_doctors`, {
      method: 'GET',
      headers: {
        'Authorization': authHeaders
      },
    })
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
    //const url = 'http://ciaiteleradiology.com/teleapp/send_study_referral';

    let authHeaders = localStorage.getItem('auth-t');

    let referralUrl = '';
    fetch(`${hostName}studies/${StudyInstanceUId}/get_cloud_url`, {
      method: 'GET',
      headers: {
        Authorization: authHeaders,
      },
    })
      .then(response => response.json())
      .then(result => {
        console.log('Cloud URL info ', result);
        referralUrl = result.url;
        sendMessage(referralUrl, StudyInstanceUId);
      })
      .catch(err => {
        console.log(err.message);
      });
  }
  function sendReferralHelper(studyInstanceUid, URL) {
    let authHeaders = localStorage.getItem('auth-t');
    const url = `${nodeAppHost}/send_study_referral`;
    const formData = {
      sr_to_doctor: value,
      sr_requester_id: 2,
      sr_requester_comments: `Hello Doctor,Could you please check below URL: ${URL}`,
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeaders
      },
      body: JSON.stringify(formData),
    };






    try {
      const res = fetch(url, options);
      if (res) {
        let url = `${hostName}/studies/${studyInstanceUid}/update_status`;
        const statusBody = { "status": "Referral sent" };
        const options2 = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeaders,
          },
          body: JSON.stringify(statusBody),
        };

        try {
          const res = fetch(url, options2);
          if (res) {
            alert("Referred Succesfully...")
            navigate('/workList');
            console.log('Status updated Save to server', res);
          }
          console.log('response ', res);
        } catch (error) {
          console.error('Error:', error);
        }
        //navigate('/workList');
        handleClose();
      }
      console.log('response ', res);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  const sendMessage = (referralUrl, studyInstanceUid) => {



    // WhatsApp API info

    const body = {
      "url": referralUrl,
      "alias": "ciaitr" + generaterandomString(6)
    }

    const whatsAppSvcURL = 'https://api.tinyurl.com/create?api_token=5YCcwTA4TrhQhqh2M2mWq8UX9s4o3OpUDRWi58ItBI6JwsGKJ73srA8AoCoQ';

    const whatsAppSvcOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(body),
    }

    try {
      fetch(whatsAppSvcURL, whatsAppSvcOptions)
        .then(response => response.json())
        .then(tinyUrlResponse => {
          console.log('Tiny URL info ', tinyUrlResponse, tinyUrlResponse.data.tiny_url);
          sendReferralHelper(studyInstanceUid, tinyUrlResponse.data.tiny_url);
        })
        .catch(err => {
          console.log(err.message);
          sendReferralHelper(studyInstanceUid, referralUrl);
        });


    } 
    catch (error) {
      console.error('Error:', error);
      sendReferralHelper(studyInstanceUid, referralUrl);
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
