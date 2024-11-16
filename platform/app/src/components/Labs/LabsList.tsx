import React, { useState, useEffect } from 'react';
import '../ReportTemplates/report.css';
//import { data } from './reportdata';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Link } from 'react-router-dom';
import { Header } from '@ohif/ui';
import ConfirmationDialog from '../AdminPanel/Users/ConfirmationDialog';
import { useNavigate } from 'react-router-dom';


import CreateLab from './CreateLab';

import CreateLabSubscription from './CreateLabSubscription';


function ReportTemplatesList() {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [labsData, setLabsData] = useState([]);
  const [labsSubscriptionsData, setLabsSubscriptionsData] = useState([]);
  const [showLabConfirm, setShowLabConfirm] = useState(false);
  const [showLabSubConfirm, setShowLabSubConfirm] = useState(false);


  const [referralLabPopup, setLabPopup] = useState(false);
  const [referralLabSubPopup, setLabSubPopup] = useState(false);
  const [editLabItem, setEachLabItem] = useState('');
  const [editLabSubItem, setEachLabSubItem] = useState('');
  const [showLabEditConfirm, setShowLabEditConfirm] = useState(false);
  const [showLabSubEditConfirm, setShowLabSubEditConfirm] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [isSuccess, setErrorStatus] = useState('');


  const labId = 2;
  const nodeAppHost = '/teleapp';

  useEffect(() => {
    //fetch(`${nodeAppHost}/read_templates/${labId}`)
    let authHeaders = localStorage.getItem('auth-t');
    console.log("local headers read_templates ", authHeaders);
    fetch(`${nodeAppHost}/get_all_labs_subscriptions`, {
      method: 'GET',
      headers: {
        'Authorization': authHeaders
      },
    })
      .then(response => response.json())
      .then(result => {
        console.log('Labs Subscription Data ', result);
        setLabsSubscriptionsData(result.data);
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

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('reportsList_ContainerCls');
    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.add('reportsList_ContainerCls');
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      document.body.classList.remove('bg-black');
      document.body.classList.add('bg-black-on');
    } else {
      document.body.classList.remove('bg-black-on');
      document.body.classList.add('bg-black');
    }
  }, [isActive]);

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('active_dark'));
    if (items) {
      setIsActive(items);
    }
  }, []);

  function handleChangeSwitch() {
    setIsActive(!isActive);
  }

  const handleEditLabItem = labId => {
    const editData = labsData.find(item => item.lab_id === labId);
    console.log("editData ", editData);
    setEachLabItem(editData);
    setShowLabEditConfirm(true);
  };

  const handleEditLabSubItem = labSubId => {
    const editSubData = labsSubscriptionsData.find(item => item.lab_id === labSubId);
    console.log("editSubData ", editSubData);
    setEachLabSubItem(editSubData);
    setShowLabSubEditConfirm(true);
  };


  const handleCloseConfirmation = () => {
    if (showLabConfirm) {
      setShowLabConfirm(false);
    } else if (referralLabPopup) {
      setLabPopup(false);
    } else {
      setShowLabEditConfirm(false);
    }
  };

  const handleCloseConfirmationSub = () => {
    if (showLabConfirm) {
      setShowLabSubConfirm(false);
    } else if (referralLabSubPopup) {
      setLabSubPopup(false);
    } else {
      setShowLabSubEditConfirm(false);
    }
  };

  const sendUpdateMessage = (response) => {
    console.log("sendUpdateMessage ", response.message);
    setUpdateError(response.message);
    setErrorStatus(response.status);
    setTimeout(() => {
      setUpdateError('');
      setErrorStatus('');
    }, 3000);
  }

  useEffect(() => {
    localStorage.setItem('active_dark', JSON.stringify(isActive));
    document.body.classList.remove('bg-black');
  }, [isActive]);

  const handleDeleteTemplate = () => {
    setShowLabConfirm(true);
  };

  const handleRedirectPage = () => {
    navigate('/workList');
  }

  const handleUpdateFeatureSubscription = () => {

  }
  return (
    <div>
      <Header
        isSticky
        menuOptions={[]}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        handleRedirectPage={handleRedirectPage}
        screen="ReportTemplateList"
      />
      <div className="reportcontainer">
        <h2 className="subPermissions">Labs</h2>
        <div className="createBtnCls">
          <Link style={{ textDecoration: 'none', width: '20%', textAlign: 'right' }}>

            <Button
              variant="contained"
              color="success"
              className="createUserCls"
              onClick={() => setLabPopup(true)}
            >
              Create Lab
            </Button>
          </Link>
        </div>
        {/* <ul className="templatesList subscriptionsList">
          {labsData.map(item => (
            <li
              key={item.lab_name}
              className={isActive ? 'templatesList_dark' : 'templates-item'}
            >
              <div className='modality-area'>
                <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                  {item.lab_name}
                </strong>
              </div>
            </li>
          ))}
        </ul> */}

        <table className="templatesList featuresSubscriptions">
          {labsData.map((item) => (
            <tr className={isActive ? 'templatesList_dark' : 'templates-item'}>
              <td><strong>{item.lab_name}</strong><br /><span>{item.lab_unique_identifier} </span></td>
              <td className="subscriptionInfo"><span>{item.lab_address}</span><br /><span>{item.lab_city}, </span><span>{item.lab_state}</span><br /><span>{item.lab_zipcode}</span></td>
              <td className="subscriptionInfo">{item.lab_subscription_status}</td>
              <td className="subscriptionInfo">{item.lab_status}</td>
              <td>
                <div className="buttonAdjustCls items-center sm:flex">
                  <Stack
                    direction="row"
                    spacing={2}
                  >
                    <Tooltip title="Edit">
                      <EditIcon
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleEditLabItem(item.lab_id)}
                      />
                    </Tooltip>
                    <Tooltip title="Delete">
                      <DeleteIcon
                        style={{ cursor: 'pointer' }}
                        onClick={handleDeleteTemplate}
                      />
                    </Tooltip>
                  </Stack>
                </div>
              </td>
              {/* <td><Button
              className="updateSuscriptionButton"
                startIcon={<EditIcon />}
                onClick={handleUpdateFeatureSubscription}
              ></Button></td> */}
            </tr>
          ))}
        </table>
      </div>


      <div className="reportcontainer permissionsSection">
        <div className="createBtnCls Permissions">
          <h2 className="subPermissions">Labs & Subscriptions</h2>
        </div>
        <div className="createBtnCls">
          <Link style={{ textDecoration: 'none', width: '20%', textAlign: 'right' }}>

            <Button
              variant="contained"
              color="success"
              className="createUserCls"
              onClick={() => setLabSubPopup(true)}
            >
              Add Subscription to Lab
            </Button>
          </Link>
        </div>
        <table className="templatesList featuresSubscriptions">
          {labsSubscriptionsData.map((item) => (
            <tr className={isActive ? 'templatesList_dark' : 'templates-item'}>
              <td><strong>{item.lab_name}</strong></td>
              <td className="subscriptionInfo">{item.lab_unique_identifier}</td>
              <td className="subscriptionInfo">{item.subscription_type_name}</td>
              <td className="subscriptionInfo">{item.subscription_description}</td>
              <td>
                <div className="buttonAdjustCls items-center sm:flex">
                  <Stack
                    direction="row"
                    spacing={2}
                  >
                    <Tooltip title="Edit">
                      <EditIcon
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleEditLabSubItem(item.lab_id)}
                      />
                    </Tooltip>
                    <Tooltip title="Delete">
                      <DeleteIcon
                        style={{ cursor: 'pointer' }}
                        onClick={handleDeleteTemplate}
                      />
                    </Tooltip>
                  </Stack>
                </div>
              </td>
              {/* <td><Button
              className="updateSuscriptionButton"
                startIcon={<EditIcon />}
                onClick={handleUpdateFeatureSubscription}
              ></Button></td> */}
            </tr>
          ))}
        </table>

      </div>
      {showLabEditConfirm && (
        <CreateLab
          open={showLabEditConfirm}
          handleClose={handleCloseConfirmation}
          screen="EditScreen"
          editData={editLabItem}
        />
      )}
      {showLabConfirm && (
        <ConfirmationDialog
          open={showLabConfirm}
          handleClose={handleCloseConfirmation}
          screen="DoctorReferralsList"
        />
      )}
      {referralLabPopup && (
        <CreateLab
          open={referralLabPopup}
          handleClose={handleCloseConfirmation}
          screen="CreateScreen"
          setLabPopup={setLabPopup}
        />
      )}

      {showLabSubEditConfirm && (
        <CreateLabSubscription
          open={showLabSubEditConfirm}
          handleClose={handleCloseConfirmationSub}
          screen="EditScreen"
          editData={editLabSubItem}
          sendUpdateMessage={sendUpdateMessage}

        />
      )}
      {showLabSubConfirm && (
        <ConfirmationDialog
          open={showLabSubConfirm}
          handleClose={handleCloseConfirmationSub}
          screen="DoctorReferralsList"
        />
      )}
      {referralLabSubPopup && (
        <CreateLabSubscription
          open={referralLabSubPopup}
          handleClose={handleCloseConfirmationSub}
          screen="CreateScreen"
          setLabSubPopup={setLabSubPopup}
          sendUpdateMessage={sendUpdateMessage}

        />
      )}

    </div>
  );
}

export default ReportTemplatesList;
