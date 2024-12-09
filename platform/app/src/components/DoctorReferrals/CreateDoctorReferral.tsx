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
import { Dispatch, SetStateAction } from 'react';

interface FormValues {
  doctorId: string;
  doctorName: string;
  specialization: string;
  clinic: string;
  phoneNumber: string;
  email: string;
}

interface FormErrors {
  doctorName?: string;
  specialization?: string;
  clinic?: string;
  phoneNumber?: string;
  email?: string;
}

interface EditData {
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
  screen?: string;
  editData?: EditData;
  setReferralPopup?: Dispatch<SetStateAction<boolean>>;
  sendUpdateMessage: (message: { message: string; status: string }) => void;
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

function CreateDoctorReferral(props: Props) {
  const { open, handleClose, screen, editData, sendUpdateMessage } = props;
  const navigate = useNavigate();

  const [initialValues, setInitialValues] = useState<FormValues>({
    doctorId: '',
    doctorName: '',
    specialization: '',
    clinic: '',
    phoneNumber: '',
    email: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const nodeAppHost = '/teleapp';

  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    if (!initialValues.doctorName.trim()) {
      newErrors.doctorName = 'Doctor name is required';
    }
    
    if (!initialValues.specialization.trim()) {
      newErrors.specialization = 'Specialization is required';
    }
    
    if (!initialValues.clinic.trim()) {
      newErrors.clinic = 'Clinic is required';
    }
    
    if (!initialValues.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\d{10}$/.test(initialValues.phoneNumber)) {
      newErrors.phoneNumber = 'Invalid phone number format';
    }
    
    if (!initialValues.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(initialValues.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handelChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const { name, value } = event.target;
    setInitialValues(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  useEffect(() => {
    if (editData) {
      setInitialValues({
        doctorId: editData.doc_id,
        doctorName: editData.doc_name,
        specialization: editData.doc_specialization,
        clinic: editData.doc_clinic,
        phoneNumber: editData.doc_phone_number,
        email: editData.doc_email,
      });
    }
  }, [editData]);

  const handleSubmit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const sessInfo = JSON.parse(sessionStorage.getItem(`oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`) || '{}');
      const authHeaders = sessInfo.token_type + ' ' + sessInfo.access_token;
      const clientId = window.config.oidc[0].client_id;
      
      let url = `${nodeAppHost}/add_referral_doctor`;
      let apitype = 'create';

      const formData = {
        doc_id: initialValues.doctorId,
        doc_name: initialValues.doctorName,
        doc_specialization: initialValues.specialization,
        doc_clinic: initialValues.clinic,
        doc_phone_number: initialValues.phoneNumber,
        doc_email: initialValues.email,
      };

      if (initialValues.doctorId !== '') {
        apitype = 'update';
        url = `${nodeAppHost}/update_referral_doctor`;
      }

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeaders,
          'clientId': clientId,
          'realm': clientId,
          'isAccess': 'create_referral_doctor',
          'labId': sessionStorage.getItem('labId') || '',
          'userSub': sessionStorage.getItem('user_sub') || '',
        },
        body: JSON.stringify(formData),
      };

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result) {
        setInitialValues({
          doctorId: '',
          doctorName: '',
          specialization: '',
          clinic: '',
          phoneNumber: '',
          email: '',
        });
        
        sendUpdateMessage({
          message: apitype === 'update' ? 'Updated Successfully...' : 'Created Successfully...',
          status: "success"
        });
        
        handleClose();
        navigate('/doctor-referrals');
      }
    } catch (error) {
      console.error('Error:', error);
      sendUpdateMessage({
        message: error instanceof Error ? error.message : 'Something went wrong...',
        status: "error"
      });
    }
  };

  const handleResetForm = () => {
    setInitialValues({
      doctorId: '',
      doctorName: '',
      specialization: '',
      clinic: '',
      phoneNumber: '',
      email: '',
    });
    setErrors({});
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
        {screen === 'EditScreen' ? 'Update Doctor Details' : 'Add Doctor Details'}
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
          <div className="box">
            <div className="row doctor-name">
              <div className="col-sm-12 col-md-6">
                <p className='doctor-name-p'>
                  <span>Doctor Name</span>
                  <input
                    type="text"
                    className={`form-control ${errors.doctorName ? 'is-invalid' : ''}`}
                    placeholder="Enter Doctor Name"
                    name="doctorName"
                    value={initialValues.doctorName}
                    onChange={handelChangeInput}
                  />
                  {errors.doctorName && <div className="invalid-feedback">{errors.doctorName}</div>}
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Specialization</span>
                  <input
                    type="text"
                    className={`form-control ${errors.specialization ? 'is-invalid' : ''}`}
                    name="specialization"
                    placeholder="Enter Specialization"
                    value={initialValues.specialization}
                    onChange={handelChangeInput}
                  />
                  {errors.specialization && <div className="invalid-feedback">{errors.specialization}</div>}
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Clinic</span>
                  <input
                    type="text"
                    className={`form-control ${errors.clinic ? 'is-invalid' : ''}`}
                    name="clinic"
                    placeholder="Enter Clinic"
                    value={initialValues.clinic}
                    onChange={handelChangeInput}
                  />
                  {errors.clinic && <div className="invalid-feedback">{errors.clinic}</div>}
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Phone Number</span>
                  <input
                    type="text"
                    className={`form-control ${errors.phoneNumber ? 'is-invalid' : ''}`}
                    name="phoneNumber"
                    placeholder="Enter Phone Number"
                    value={initialValues.phoneNumber}
                    onChange={handelChangeInput}
                  />
                  {errors.phoneNumber && <div className="invalid-feedback">{errors.phoneNumber}</div>}
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Email ID</span>
                  <input
                    type="text"
                    name="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    placeholder="Enter Email ID"
                    value={initialValues.email}
                    onChange={handelChangeInput}
                  />
                  {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                </p>
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
            disabled={screen === 'EditScreen'}
          >
            Clear
          </Button>
          <Button
            variant="contained"
            color="success"
            className="submitBtnMuiCls borderRadiusCls"
            onClick={handleSubmit}
          >
            {screen === 'EditScreen' ? 'Update' : 'Submit'}
          </Button>
        </Stack>
      </DialogActions>
    </BootstrapDialog>
  );
}

export default CreateDoctorReferral;
