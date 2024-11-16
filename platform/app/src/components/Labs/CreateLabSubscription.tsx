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

function CreateLabSubscription(props) {
  const { open, handleClose, screen, editData, sendUpdateMessage } = props;
  const navigate = useNavigate();
  const [subscriptionsData, setSubscriptionsData] = useState([]);
  const [labsData, setLabsData] = useState([]);

  const [labValue, setLabValue] = useState('');

  const [subValue, setSubValue] = useState('');

  const [statusValue, setStatusValue] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [isSuccess, setErrorStatus] = useState('');

  const [initialValues, setInitialValues] = useState({
    lab_id: '',
    subscription_type_id: '',
    lab_sub_status: '',
    lab_sub_id:''

  });
  console.log("setUpdateError function...", sendUpdateMessage);

  const nodeAppHost = '/teleapp';


  const handelChangeInput = event => {
    event.preventDefault();
    const { name, value } = event.target;
    setInitialValues({ ...initialValues, [name]: value });
  };

  useEffect(() => {
    //fetch(`${nodeAppHost}/read_templates/${labId}`)
    let authHeaders = localStorage.getItem('auth-t');
    console.log("local headers read_templates ", authHeaders);
    fetch(`${nodeAppHost}/get_all_subscription_types`, {
      method: 'GET',
      headers: {
        'Authorization': authHeaders
      },
    })
      .then(response => response.json())
      .then(result => {
        console.log('Subscriptions Data ', result);
        setSubscriptionsData(result.data);
      })
      .catch(err => {
        console.log(err.message);
      });
  }, []);


  useEffect(() => {
    let authHeaders = localStorage.getItem('auth-t');
    fetch(`${nodeAppHost}/get_all_labs_info`, {
      method: 'GET',
      headers: {
        'Authorization': authHeaders
      },
    })
      .then(response => response.json())
      .then(result => {
        console.log('Labs Data ', result);
        setLabsData(result.data);
      })
      .catch(err => {
        console.log(err.message);
      });
  }, []);

  useEffect(() => {
    if (editData) {
      setInitialValues({
        ...initialValues,
        lab_sub_id:editData.lab_sub_id,
        lab_id: editData.lab_id,
        subscription_type_id: editData.subscription_type_id,
        lab_sub_status: editData.lab_sub_status
      });
    }
  }, [editData]);

  const handleSubmit = event => {
    event.preventDefault();
    if (
      initialValues.lab_id !== '' &&
      initialValues.subscription_type_id !== ''
    ) {

      let authHeaders = localStorage.getItem('auth-t');
      let url = `${nodeAppHost}/create_lab_subscription`;
      let apitype = 'create';

      const formData = {
        lab_id: initialValues.lab_id,
        subscription_type_id: initialValues.subscription_type_id,
        lab_sub_status: initialValues.lab_sub_status,
        lab_sub_id:initialValues.lab_sub_id
      };
      if (initialValues.lab_sub_id !== '') {
        apitype = 'update';
        url = `${nodeAppHost}/update_lab_subscription`;
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
            console.log('Update Lab Suscription Info ', result);
            if (result) {
              setInitialValues({
                ...initialValues,
                lab_id: '',
                subscription_type_id: '',
                lab_sub_status: '',
                lab_sub_id:''
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

  const handleLabChange = event => {
    console.log('dropdown value', event.target.name, event.target.value);

    setLabValue(event.target.value);
    initialValues.lab_id = event.target.value;
  };
  const handleSubChange = event => {
    console.log('dropdown value', event.target.name, event.target.value);

    setSubValue(event.target.value);
    initialValues.subscription_type_id = event.target.value;
  };
  const handleStatusChange = event => {
    console.log('dropdown value', event.target.name, event.target.value);

    setStatusValue(event.target.value);
    initialValues.lab_sub_status = event.target.value;
  };

  const handleResetForm = () => {
    setInitialValues({
      ...initialValues,
      lab_id: '',
      subscription_type_id: '',
      lab_sub_status: '',
      lab_sub_id:''
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
        {screen === 'EditScreen' ? 'Update Subscription' : 'Add Subscription'}
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
                  <span>Lab Name</span>
                  <select
                    className="doctorsListCls"
                    onChange={handleLabChange}
                    name="lab_id"
                    value={initialValues.lab_id}
                  >
                    <option value="">Select</option>
                    {labsData.map((option, index) => (
                      <option
                        key={index}
                        value={option.lab_id}
                      >
                        {option.lab_name}
                      </option>
                    ))}
                  </select>
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p className='doctor-name-p'>
                  <span>Subscription Type</span>
                  <select
                    className="doctorsListCls"
                    onChange={handleSubChange}
                    name="subscription_type_id"
                    value={initialValues.subscription_type_id}
                  >
                    <option value="">Select</option>
                    {subscriptionsData.map((option, index) => (
                      <option
                        key={index}
                        value={option.subscription_type_id}
                      >
                        {option.subscription_type_name}
                      </option>
                    ))}
                  </select>
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p className='doctor-name-p'>
                  <span>Subscription Type</span>
                  <select 
                    className="doctorsListCls"
                    id="dropdown" 
                    name="lab_sub_status"
                    value={initialValues.lab_sub_status} 
                    onChange={handleStatusChange}>
                    <option value="" disabled>
                      Select an option
                    </option>
                    <option value="active">Active</option>
                    <option value="trail">In Trail</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

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

export default CreateLabSubscription;
