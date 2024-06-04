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

function CreateDoctorReferral(props) {
  const { open, handleClose, screen, editData } = props;
  const navigate = useNavigate();

  const [initialValues, setInitialValues] = useState({
    doctorName: '',
    specialization: '',
    clinic: '',
    phoneNumber: '',
    email: '',
  });

  const nodeAppHost = 'http://localhost:3300';

  const handelChangeInput = event => {
    event.preventDefault();
    const { name, value } = event.target;
    setInitialValues({ ...initialValues, [name]: value });
  };

  useEffect(() => {
    if (editData) {
      setInitialValues({
        ...initialValues,
        doctorName: editData.doc_name,
        specialization: editData.doc_specialization,
        clinic: editData.doc_clinic,
        phoneNumber: editData.doc_phone_number,
        email: editData.doc_email,
      }); // Set initial values with editData
    }
  }, [editData]);

  const handleSubmit = event => {
    event.preventDefault();
    if (
      initialValues.doctorName !== '' &&
      initialValues.specialization !== '' &&
      initialValues.clinic !== '' &&
      initialValues.phoneNumber !== '' &&
      initialValues.email !== ''
    ) {
      const url = `${nodeAppHost}/add_referral_doctor`;

      const formData = {
        doc_name: initialValues.doctorName,
        doc_specialization: initialValues.specialization,
        doc_clinic: initialValues.clinic,
        doc_phone_number: initialValues.phoneNumber,
        doc_email: initialValues.email,
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
          setInitialValues({
            ...initialValues,
            doctorName: '',
            specialization: '',
            clinic: '',
            phoneNumber: '',
            email: '',
          });
          handleClose();
          navigate('/doctor-referrals');
        }
        console.log('response ', res);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  const handleResetForm = () => {
    setInitialValues({
      ...initialValues,
      doctorName: '',
      specialization: '',
      clinic: '',
      phoneNumber: '',
      email: '',
    });
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
        {screen === 'EditScreen' ? 'Update Confirmation' : 'Create Confirmation'}
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
            <div className="row">
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Doctor Name</span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter Doctor Name"
                    name="doctorName"
                    value={initialValues.doctorName}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Specialization</span>
                  <input
                    type="text"
                    className="form-control"
                    name="specialization"
                    placeholder="Enter Specialization"
                    value={initialValues.specialization}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Clinic</span>
                  <input
                    type="text"
                    className="form-control"
                    name="clinic"
                    placeholder="Enter Clinic"
                    value={initialValues.clinic}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Phone Number</span>
                  <input
                    type="text"
                    className="form-control"
                    name="phoneNumber"
                    placeholder="Enter Phone Number"
                    value={initialValues.phoneNumber}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Email ID</span>
                  <input
                    type="text"
                    name="email"
                    className="form-control"
                    placeholder="Enter Email ID"
                    value={initialValues.email}
                    onChange={handelChangeInput}
                  />
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