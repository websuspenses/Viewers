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
  const [labsData, setLabsData] = useState([]);
  const [labsSubscriptionsData, setLabsSubscriptionsData] = useState([]);
  const [showconfirm, setShowConfirm] = useState(false);

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
    //fetch(`${nodeAppHost}/read_templates/${labId}`)
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
      <h2 className="subPermissions">Labs</h2>
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
              <td><strong>{item.lab_name}</strong></td>
              <td className="subscriptionInfo"><span>{item.lab_address}</span><br /><span>{item.lab_city}, </span><span>{item.lab_state}</span><br /><span>{item.lab_zipcode}</span></td>
              <td className="subscriptionInfo">{item.lab_subscription_status}</td>
              <td className="subscriptionInfo">{item.lab_status}</td>
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
        <table className="templatesList featuresSubscriptions">
          {labsSubscriptionsData.map((item) => (
            <tr className={isActive ? 'templatesList_dark' : 'templates-item'}>
              <td><strong>{item.lab_name}</strong></td>
              <td className="subscriptionInfo">{item.lab_unique_identifier}</td>
              <td className="subscriptionInfo">{item.subscription_type_name}</td>
              <td className="subscriptionInfo">{item.subscription_description}</td>
              {/* <td><Button
              className="updateSuscriptionButton"
                startIcon={<EditIcon />}
                onClick={handleUpdateFeatureSubscription}
              ></Button></td> */}
            </tr>
          ))}
        </table>
        
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
