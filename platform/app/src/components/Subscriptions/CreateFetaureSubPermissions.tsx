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

function CreateFetaureSubPermissions(props) {
  const { open, handleClose, screen, editData, sendUpdateMessage } = props;
  const navigate = useNavigate();
  const [subscriptionsData, setSubscriptionsData] = useState([]);
  const [labsData, setLabsData] = useState([]);

  const [labValue, setLabValue] = useState('');

  const [subValue, setSubValue] = useState('');

  // const [statusValue, setStatusValue] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [isSuccess, setErrorStatus] = useState('');



  const [initialValues, setInitialValues] = useState({
    // lab_id: '',
    // subscription_type_id: '',
    // lab_sub_status: '',
    // lab_sub_id:''

    feature_id: '',
    feature_name: '',
    feature_unique_identifier: '',
    feature_is_available_for__basic: false,
    feature_is_available_for__standard: false,
    feature_is_available_for__premium: false,
    feature_description: '',
    feature_access_updated_by: ''


  });

  const [isChecked, setIsChecked] = useState(false);
  const [isChecked1, setIsChecked1] = useState(false);
  const [isChecked2, setIsChecked2] = useState(false);
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
    console.log("editData ", editData);
    if (editData) {
      setInitialValues({
        ...initialValues,
        feature_id: editData.feature_id,
        feature_name: editData.feature_name,
        feature_unique_identifier: editData.feature_unique_identifier,
        feature_is_available_for__basic: editData.feature_is_available_for__basic,
        feature_is_available_for__standard: editData.feature_is_available_for__standard,
        feature_is_available_for__premium: editData.feature_is_available_for__premium,
        feature_description: editData.feature_description
      });
      setIsChecked(editData.feature_is_available_for__basic);
      setIsChecked1(editData.feature_is_available_for__standard);
      setIsChecked2(editData.feature_is_available_for__premium);
    }
  }, [editData]);

  const handleSubmit = event => {
    event.preventDefault();
    if (
      initialValues.feature_name !== '' &&
      initialValues.feature_unique_identifier !== ''
    ) {

      let authHeaders = localStorage.getItem('auth-t');
      let url = `${nodeAppHost}/create_subscription_feature`;
      let apitype = 'create';

      const formData = {
        feature_name: initialValues.feature_name,
        feature_unique_identifier: initialValues.feature_unique_identifier,
        feature_is_available_for__basic: initialValues.feature_is_available_for__basic,
        feature_is_available_for__standard: initialValues.feature_is_available_for__standard,
        feature_is_available_for__premium: initialValues.feature_is_available_for__premium,
        feature_description: initialValues.feature_description,
        feature_access_updated_by: 2,
        feature_id: initialValues.feature_id

      };
      if (initialValues.feature_id !== '') {
        apitype = 'update';
        url = `${nodeAppHost}/update_subscription_feature`;
      }
      formData.feature_access_updated_by = 2; // update when keycloak integration
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
                feature_name: '',
                feature_unique_identifier: '',
                feature_is_available_for__basic: false,
                feature_is_available_for__standard: false,
                feature_is_available_for__premium: false,
                feature_description: '',
                feature_access_updated_by: '',
                feature_id: ''
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


  const onHandleChangeBasic = event => {
    console.log('dropdown value', event.target.name, event.target.value, "checked ", event.target.checked);
    setIsChecked(event.target.checked);
    initialValues.feature_is_available_for__basic = event.target.checked;
  };
  const onHandleChangeStd = event => {
    console.log('dropdown value', event.target.name, event.target.value);

    // setSubValue(event.target.value);
    setIsChecked1(event.target.checked);
    initialValues.feature_is_available_for__standard = event.target.checked;
  };
  const onHandleChangePremium = event => {
    console.log('dropdown value', event.target.name, event.target.value);

    // setStatusValue(event.target.value);
    setIsChecked2(event.target.checked);
    initialValues.feature_is_available_for__premium = event.target.checked;
  };

  const handleResetForm = () => {
    setInitialValues({
      ...initialValues,
      feature_name: '',
      feature_unique_identifier: '',
      feature_is_available_for__basic: false,
      feature_is_available_for__standard: false,
      feature_is_available_for__premium: false,
      feature_description: '',
      feature_id: ''
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
                  <span>Name</span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Name"
                    name="feature_name"
                    value={initialValues.feature_name}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p className='doctor-name-p'>
                  <span>Unique identifier</span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: fature_name"
                    name="feature_unique_identifier"
                    value={initialValues.feature_unique_identifier}
                    disabled={initialValues.feature_unique_identifier}
                    onChange={handelChangeInput}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p className='doctor-name-p'>
                  <span>Description</span>
                  <textarea
                    type="text"
                    className="form-control"
                    placeholder="Descripion"
                    name="feature_description"
                    value={initialValues.feature_description}
                    onChange={handelChangeInput}
                  ></textarea>
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p className='doctor-name-p'>
                  <span className='CheckName'>Available for Basic? {isChecked}</span>
                  {/* <p>The checkbox is {isChecked ? "checked" : "unchecked"}.</p> */}
                  <input
                    type="checkbox"
                    name="feature_is_available_for__basic"
                    className="form-control chkBox"
                    onChange={onHandleChangeBasic}
                    checked={isChecked}
                    value={initialValues.feature_is_available_for__basic}
                  />

                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p className='doctor-name-p'>
                  <span className='CheckName'>Available for Standard? {isChecked1}</span>
                  <input
                    type="checkbox"
                    name="feature_is_available_for__standard"
                    className="form-control chkBox"
                    onChange={onHandleChangeStd}
                    checked={isChecked1}
                    value={initialValues.feature_is_available_for__standard}
                  />
                </p>
              </div>
              <div className="col-sm-12 col-md-6">
                <p className='doctor-name-p'>
                  <span className='CheckName'>Available for Premium? {isChecked2}</span>
                  <input
                    type="checkbox"
                    name="feature_is_available_for__premium"
                    className="form-control chkBox"
                    onChange={onHandleChangePremium}
                    checked={isChecked2}
                    value={initialValues.feature_is_available_for__premium}
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

export default CreateFetaureSubPermissions;
