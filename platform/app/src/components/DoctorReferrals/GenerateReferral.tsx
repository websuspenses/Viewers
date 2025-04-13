import React, { useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Dialog, { DialogProps } from '@mui/material/Dialog';
import { useNavigate } from 'react-router-dom';
import { useAppConfig } from '@state';
interface Doctor {
  doc_id: string;
  doc_name: string;
  doc_specialization: string;
  doc_clinic: string;
  doc_phone_number: string;
  doc_email: string;
}

interface Props {
  open: boolean;
  handleClose: () => void;
  StudyInstanceUId: string;
}

const BootstrapDialog = styled(Dialog)<DialogProps>(() => ({
  '& .MuiDialogContent-root': {
    padding: '16px',
  },
  '& .MuiDialogActions-root': {
    padding: '8px',
  },
  '& .MuiPaper-root': {
    width: '550px !important',
  },
})) as typeof Dialog;

function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function GenerateReferral(props: Props) {
  const navigate = useNavigate();
  const { open, handleClose, StudyInstanceUId } = props;
  //const nodeAppHost = process.env.REACT_APP_HOST_NAME;

  const [value, setValue] = useState('');
  const [doctorsData, setDoctorsData] = useState<Doctor[]>([]);
  const [authHeaders, setAuthHeaders] = useState('');
  const [error, setError] = useState('');
  const [appConfig] = useAppConfig();

  const nodeAppHost = appConfig.nodeAppHostURL || 'https://ciaiteleradiology.com/teleapp';
  const hostName = appConfig.pacsHostURL;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setValue(event.target.value);
    setError('');
  };

  useEffect(() => {
    try {
      const sessInfo = JSON.parse(
        sessionStorage.getItem(
          `oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`
        ) || '{}'
      );
      const headers = `${sessInfo.token_type} ${sessInfo.access_token}`;
      setAuthHeaders(headers);
    } catch (error) {
      console.error('Error getting auth headers:', error);
      setError('Authentication error occurred');
    }
  }, []);

  useEffect(() => {
    if (!authHeaders) return;

    const fetchDoctors = async () => {
      const clientId = window.config.oidc[0].client_id;
      try {
        const response = await fetch(`${nodeAppHost}/get_referral_doctors`, {
          method: 'GET',
          headers: {
            Authorization: authHeaders,
            clientId: clientId,
            realm: clientId,
            'Content-Type': 'application/json',
            'test-header': 'test',
            isAccess: 'view_referral_doctors_list',
            labId: sessionStorage.getItem('labId') || '',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const actualData = await response.json();
        setDoctorsData(actualData.data);
      } catch (err) {
        console.error('Error fetching doctors:', err);
        setError('Failed to load doctors list');
      }
    };

    fetchDoctors();
  }, [authHeaders, nodeAppHost]);

  const sendReferralHelper = async (studyInstanceUid: string, URL: string) => {
    const clientId = window.config.oidc[0].client_id;
    if (!value) {
      setError('Please select a doctor');
      return;
    }

    try {
      // const formData = {
      //   sr_to_doctor: value,
      //   sr_requester_id: 2,
      //   sr_requester_comments: `Hello Doctor, Could you please check below URL: ${URL}`,
      // };

      const formData = {
        sr_to_doctor: value,
        sr_requester_id: 2,
        sr_requester_comments: `Hello Doctor, Could you please check below URL: ${URL}`,
        sr_url: URL,
        sr_host_name: nodeAppHost,
      };

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeaders,
          clientId: clientId,
          realm: clientId,
        },
        body: JSON.stringify(formData),
      };

      const response = await fetch(`${nodeAppHost}/send_study_referral`, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const statusBody = { status: 'Referral sent' };
      const updateResponse = await fetch(`${hostName}/studies/${studyInstanceUid}/update_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeaders,
          clientId: clientId,
          realm: clientId,
        },
        body: JSON.stringify(statusBody),
      });

      if (!updateResponse.ok) {
        throw new Error(`HTTP error! status: ${updateResponse.status}`);
      }

      alert('Referred Successfully...');
      navigate('/workList');
      handleClose();
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to send referral');
    }
  };

  // const cryptoKey = window.crypto.subtle.generateKey(
  //   {
  //     name: 'AES-GCM',
  //     length: 256,
  //   },
  //   true,
  //   ['encrypt', 'decrypt']
  // );

  // const encrypt = async text => {
  //   const encodedText = new TextEncoder().encode(text);
  //   const iv = window.crypto.getRandomValues(new Uint8Array(12));
  //   const encryptedContent = await window.crypto.subtle.encrypt(
  //     {
  //       name: 'AES-GCM',
  //       iv: iv,
  //     },
  //     await cryptoKey,
  //     encodedText
  //   );
  //   const encryptedArray = new Uint8Array(encryptedContent);
  //   const encryptedString = btoa(String.fromCharCode(...iv, ...encryptedArray));
  //   return encryptedString;
  // };

  // const decrypt = async encryptedText => {
  //   const encryptedArray = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  //   const iv = encryptedArray.slice(0, 12);
  //   const encryptedContent = encryptedArray.slice(12);
  //   const decryptedContent = await window.crypto.subtle.decrypt(
  //     {
  //       name: 'AES-GCM',
  //       iv: iv,
  //     },
  //     await cryptoKey,
  //     encryptedContent
  //   );
  //   const decodedText = new TextDecoder().decode(decryptedContent);
  //   return decodedText;
  // };

  const sendStudyReferral = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const clientId = window.config.oidc[0].client_id;
    if (!value) {
      setError('Please select a doctor');
      return;
    }

    try {
      const response = await fetch(`${hostName}studies/${StudyInstanceUId}/get_cloud_url`, {
        method: 'GET',
        headers: {
          Authorization: authHeaders,
          clientId: clientId,
          realm: clientId,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      await sendReferralHelper(StudyInstanceUId, result.url);
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'Failed to get study URL');
    }
  };

  const handleResetForm = () => {
    setValue('');
    setError('');
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
                  className={`doctorsListCls ${error ? 'is-invalid' : ''}`}
                  value={value}
                  onChange={handleChange}
                >
                  <option value="">Select</option>
                  {doctorsData.map(option => (
                    <option
                      key={option.doc_id}
                      value={option.doc_id}
                    >
                      {option.doc_name}
                    </option>
                  ))}
                </select>
                {error && <div className="invalid-feedback">{error}</div>}
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
            onClick={handleResetForm}
          >
            Clear
          </Button>
          <Button
            variant="contained"
            className="submitBtnMuiRefCls borderRadiusCls"
            onClick={sendStudyReferral}
            disabled={!value}
          >
            Refer
          </Button>
        </Stack>
      </DialogActions>
    </BootstrapDialog>
  );
}

export default GenerateReferral;
