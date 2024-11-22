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

function CreateLab(props) {
  const { open, handleClose, screen, editData, sendUpdateMessage } = props;
  const navigate = useNavigate();

  const [initialValues, setInitialValues] = useState({
    lab_id: '',
    lab_unique_identifier: '',
    lab_name: '',
    lab_address: '',
    lab_city: '',
    lab_state: '',
    lab_zipcode: '',
    lab_phone:'',
    lab_updated_by:''
  });
  console.log("setUpdateError function...", sendUpdateMessage);

  const nodeAppHost = '/teleapp';

  const handelChangeInput = event => {
    event.preventDefault();
    const { name, value } = event.target;
    setInitialValues({ ...initialValues, [name]: value });
  };

  useEffect(() => {
    if (editData) {
      setInitialValues({
        ...initialValues,
        lab_id: editData.lab_id,
        lab_unique_identifier: editData.lab_unique_identifier,
        lab_name: editData.lab_name,
        lab_address: editData.lab_address,
        lab_city: editData.lab_city,
        lab_state: editData.lab_state,
        lab_zipcode: editData.lab_zipcode,
        lab_phone:editData.lab_phone,
        lab_updated_by:'2'
      });
    }
  }, [editData]);

  const handleSubmit = event => {
    event.preventDefault();
    if (
      initialValues.lab_name !== '' &&
      initialValues.lab_address !== '' &&
      initialValues.lab_unique_identifier !== ''
    ) {

      let authHeaders = localStorage.getItem('auth-t');
      let url = `${nodeAppHost}/create_lab`;
      let apitype = 'create';

      const formData = {
        lab_id: initialValues.lab_id,
        lab_unique_identifier: initialValues.lab_unique_identifier,
        lab_name: initialValues.lab_name,
        lab_address: initialValues.lab_address,
        lab_city: initialValues.lab_city,
        lab_state: initialValues.lab_state,
        lab_zipcode: initialValues.lab_zipcode,
        lab_phone:initialValues.lab_phone,
        lab_updated_by:initialValues.lab_updated_by
      };
      if (initialValues.lab_id !== '') {
        apitype = 'update';
        url = `${nodeAppHost}/update_lab`;
      }
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeaders
        },
        body: JSON.stringify(formData),
      };

      try {
        const res = fetch(url, options)
          .then(response => response.json())
          .then(result => {
            console.log('Update Lab Info ', result);
            if (result) {
              setInitialValues({
                ...initialValues,
                lab_unique_identifier: '',
                lab_name: '',
                lab_address: '',
                lab_city: '',
                lab_state: '',
                lab_zipcode: '',
                lab_phone:''
              });

              if (apitype == 'update') {
                sendUpdateMessage({ "message": 'Updated Successfully...', "status": "success" });
              }
              else {
                sendUpdateMessage({ "message": 'Created Successfully...', "status": "success" });
              }
              handleClose();
              navigate('/doctor-referrals');
            }
          })
          .catch(err => {
            console.log(err.message);
            sendUpdateMessage({ "message": 'Something went wrong...', "status": "error" });
          });
      } catch (error) {
        console.error('Error:', error);
        sendUpdateMessage({ "message": 'Something went wrong...', "status": "error" });
      }
    }
  };


  const handleResetForm = () => {
    setInitialValues({
      ...initialValues,
      lab_unique_identifier: '',
      lab_name: '',
      lab_address: '',
      lab_city: '',
      lab_state: '',
      lab_zipcode: '',
      lab_phone:''
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
        {screen === 'EditScreen' ? 'Update Lab Details' : 'Add Lab Details'}
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
                  <span>Name</span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter Doctor Name"
                    name="lab_name"
                    value={initialValues.lab_name}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Unique identifier</span>
                  {/* {initialValues.lab_unique_identifier && <span className="lab-unique-span">{initialValues.lab_unique_identifier}</span>} */}
                  <input 
                    type="text"
                    className="form-control"
                    name="lab_unique_identifier"
                    placeholder="Enter Specialization"
                    value={initialValues.lab_unique_identifier}
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
                    name="lab_phone"
                    placeholder="Enter Clinic"
                    value={initialValues.lab_phone}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Address</span>
                  <input
                    type="text"
                    className="form-control"
                    name="lab_address"
                    placeholder="Enter Clinic"
                    value={initialValues.lab_address}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>City</span>
                  <input
                    type="text"
                    className="form-control"
                    name="lab_city"
                    placeholder="Enter Phone Number"
                    value={initialValues.lab_city}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>State</span>
                  <input
                    type="text"
                    name="lab_state"
                    className="form-control"
                    placeholder="Enter Email ID"
                    value={initialValues.lab_state}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p>
                  <span>Zip code</span>
                  <input
                    type="text"
                    name="lab_zipcode"
                    className="form-control"
                    placeholder="Enter Email ID"
                    value={initialValues.lab_zipcode}
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

export default CreateLab;
