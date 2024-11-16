import React, { useState, useEffect } from 'react';
import '../ReportTemplates/report.css';
//import { data } from './reportdata';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Link } from 'react-router-dom';
import { Header } from '@ohif/ui';
import ConfirmationDialog from '../AdminPanel/Users/ConfirmationDialog';
import { useNavigate } from 'react-router-dom';

import CreateFetaureSubPermissions from './CreateFetaureSubPermissions';

function ReportTemplatesList() {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [subscriptionsData, setSubscriptionsData] = useState([]);
  const [subscriptionsFeturesData, setSubscriptionsFeaturesData] = useState([]);
  const [showconfirm, setShowConfirm] = useState(false);

  const [showLabEditConfirm, setShowLabEditConfirm] = useState(false);
  const [editLabItem, setEachLabItem] = useState('');
  const [referralLabPopup, setLabPopup] = useState(false);

  const [showLabConfirm, setShowLabConfirm] = useState(false);






  const labId = 2;
  const nodeAppHost = '/teleapp';

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
    //fetch(`${nodeAppHost}/read_templates/${labId}`)
    let authHeaders = localStorage.getItem('auth-t');
    fetch(`${nodeAppHost}/get_all_subscription_features`, {
      method: 'GET',
      headers: {
        'Authorization': authHeaders
      },
    })
      .then(response => response.json())
      .then(result => {
        console.log('Fetures Data ', result);
        setSubscriptionsFeaturesData(result.data);
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

  useEffect(() => {
    localStorage.setItem('active_dark', JSON.stringify(isActive));
    document.body.classList.remove('bg-black');
  }, [isActive]);

  const handleDeleteTemplate = () => {
    setShowConfirm(true);
  };
  // const handleCloseConfirmation = () => {
  //   setShowConfirm(false);
  // };
  const handleRedirectPage = () => {
    navigate('/workList');
  }

  const handleCloseConfirmation = () => {
    if (showLabConfirm) {
      setShowLabConfirm(false);
    } else if (referralLabPopup) {
      setLabPopup(false);
    } else {
      setShowLabEditConfirm(false);
    }
  };

  const handleUpdateFeatureSubscription = (labSubId) => {

    let newSubscriptionsArray = [];
    for (const [key, value] of Object.entries(subscriptionsFeturesData)) {
      console.log(`${key}: ${value}`);
      newSubscriptionsArray.push(value);
    }
    const editSubData = newSubscriptionsArray.find(item => item.feature_id == labSubId);
    console.log("editSubData 123 ", editSubData);
    setEachLabItem(editSubData);
    setShowLabEditConfirm(true);
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
        <div className="createBtnCls">
          <Link
            to="/create-template"
            style={{ textDecoration: 'none' }}
          >
            <Button
              variant="contained"
              color="success"
              className="createUserCls"
            //</div>onClick={() => setShowAddMode(true)
            >
              Create Subscription
            </Button>
          </Link>
        </div>
        <ul className="templatesList subscriptionsList">
          {/* {subscriptionsData[0]} */}
          {subscriptionsData.map(item => (
            <li
              key={item.subscription_type_name}
              className={isActive ? 'templatesList_dark' : 'templates-item'}
            >
              <div className='modality-area'>
                <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                  {item.subscription_type_name}
                </strong>
              </div>
            </li>
          ))}
        </ul>
      </div>


      <div className="reportcontainer permissionsSection">
        <div className="createBtnCls Permissions">
          <h2 className="subPermissions">Features & Permissions</h2>
        </div>
        <div className="createBtnCls">
          <Link style={{ textDecoration: 'none', width: '20%', textAlign: 'right' }}>

            <Button
              variant="contained"
              color="success"
              className="createUserCls"
              onClick={() => setLabPopup(true)}
            >
              Create Subscription
            </Button>
          </Link>
        </div>
        <table className="templatesList featuresSubscriptions">
          <tr className={isActive ? 'templatesList_dark' : 'templates-item'}><th></th><th>Basic</th><th>Standard</th><th>Premium</th><th></th></tr>
          {Object.keys(subscriptionsFeturesData).map((item) => (
            <tr className={isActive ? 'templatesList_dark' : 'templates-item'}>
              <td><strong>{subscriptionsFeturesData[item].feature_name}</strong></td>
              <td className="subscriptionInfo">{subscriptionsFeturesData[item].feature_is_available_for__basic ? "Yes" : "No"}</td>
              <td className="subscriptionInfo">{subscriptionsFeturesData[item].feature_is_available_for__standard ? "Yes" : "No"}</td>
              <td className="subscriptionInfo">{subscriptionsFeturesData[item].feature_is_available_for__premium ? "Yes" : "No"}</td>
              <td><Button
                className="updateSuscriptionButton"
                startIcon={<EditIcon />}
                onClick={() => handleUpdateFeatureSubscription(subscriptionsFeturesData[item].feature_id)}
              ></Button></td>
            </tr>
          ))}
        </table>

      </div>

      {showLabEditConfirm && (
        <CreateFetaureSubPermissions
          open={showLabEditConfirm}
          handleClose={handleCloseConfirmation}
          screen="EditScreen"
          editData={editLabItem}
        />
      )}
      {showconfirm && (
        <ConfirmationDialog
          open={showconfirm}
          handleClose={handleCloseConfirmation}
          screen="DoctorReferralsList"
        />
      )}
      {referralLabPopup && (
        <CreateFetaureSubPermissions
          open={referralLabPopup}
          handleClose={handleCloseConfirmation}
          screen="CreateScreen"
          setLabPopup={setLabPopup}
        />
      )}


      {/* {showconfirm && (
        <ConfirmationDialog
          open={showconfirm}
          handleClose={handleCloseConfirmation}
          screen="ReportTemplatesList"
        />
      )} */}
    </div>
  );
}

export default ReportTemplatesList;
