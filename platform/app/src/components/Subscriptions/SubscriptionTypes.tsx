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

function ReportTemplatesList() {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [subscriptionsData, setSubscriptionsData] = useState([]);
  const [subscriptionsFeturesData, setSubscriptionsFeaturesData] = useState([]);
  const [showconfirm, setShowConfirm] = useState(false);

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
  const handleCloseConfirmation = () => {
    setShowConfirm(false);
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
                {/* <p className='sub-modality'>{item.modality}</p> */}
              </div>


              {/* <div className="reports-justify-between items-center sm:flex">
                <Stack
                  direction="row"
                  spacing={2}
                >
                  <Link
                    to={`/create-template/${item.modality}/${item.template_id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button
                      variant="contained"
                      color="success"
                      className="createUserCls"
                      startIcon={<EditIcon />}
                    //onClick={() => setShowEditMode(true)}
                    >
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="contained"
                    color="success"
                    className="createUserCls"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteTemplate}
                  >
                    Delete
                  </Button>
                </Stack>
              </div> */}
            </li>
          ))}
        </ul>
      </div>


      <div className="reportcontainer permissionsSection">
        <div className="createBtnCls Permissions">
          <h2 className="subPermissions">Permissions</h2>
          {/* <Link
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
          </Link> */}
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
                onClick={handleUpdateFeatureSubscription}
              ></Button></td>
            </tr>
          ))}
        </table>
        {/* <ul className="templatesList">
          {Object.keys(subscriptionsFeturesData).map((item) => (
            <li
              key={subscriptionsFeturesData[item].feature_name}
              className={isActive ? 'templatesList_dark' : 'templates-item'}
            >
              <div className='modality-area'>
                <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                  {subscriptionsFeturesData[item].feature_name}
                </strong>
                <table>
                  <th></th>
                </table>
              </div>


            </li>
          ))}
        </ul> */}
        {/* <ul>
                {Object.keys(subscriptionsFeturesData).map((key) => {
                    const feature = subscriptionsFeturesData[key];
                    return (
                        <li key={feature.feature_id}>
                            <h2>{feature.feature_name}</h2>
                            <p><strong>Description:</strong> {feature.feature_description || "No description available"}</p>
                            <p><strong>Available for Basic:</strong> {feature.feature_is_available_for__basic ? "Yes" : "No"}</p>
                            <p><strong>Available for Standard:</strong> {feature.feature_is_available_for__standard ? "Yes" : "No"}</p>
                            <p><strong>Available for Premium:</strong> {feature.feature_is_available_for__premium ? "Yes" : "No"}</p>
                            <p><strong>Created Date:</strong> {feature.feature_access_created_date}</p>
                        </li>
                    );
                })}
            </ul> */}
      </div>


      {showconfirm && (
        <ConfirmationDialog
          open={showconfirm}
          handleClose={handleCloseConfirmation}
          screen="ReportTemplatesList"
        />
      )}
    </div>
  );
}

export default ReportTemplatesList;
