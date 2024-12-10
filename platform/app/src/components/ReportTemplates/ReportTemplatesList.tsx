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
  const [templateData, setData] = useState([]);
  const [showconfirm, setShowConfirm] = useState(false);
  const [authHeaders, setAuthHeaders] = useState('');
  const [rolesInfo, setuserRoles] = useState('');
  const [subscriptionFeatures, setLabsubsInfo] = useState('');


  const labId = sessionStorage.getItem('labId') || '';
  const nodeAppHost = '/teleapp';

  useEffect(() => {
    //let authHeaders = localStorage.getItem('auth-t');
    const clientId = window.config.oidc[0].client_id;

    console.log("local headers read_templates ", authHeaders);
    if (authHeaders) {
      fetch(`${nodeAppHost}/read_templates`, {
        method: 'GET',
        headers: {
          'Authorization': authHeaders,
          'clientId': clientId,
          'realm': clientId,
          'Content-Type': 'application/json',
          'isAccess': 'view_template_list',
          'labId': labId
        },
      })
        .then(response => response.json())
        .then(actualData => {
          console.log('actualData ', actualData);
          setData(actualData.data);
        })
        .catch(err => {
          console.log(err.message);
        });
    }


  }, [authHeaders]);


  const isShowFeature = (value) => {
    let finalResult = false;
    console.log("subscriptionFeatures ", subscriptionFeatures, "rolesInfo ", rolesInfo);
    if (subscriptionFeatures && rolesInfo) {
      finalResult = subscriptionFeatures.includes(value) && rolesInfo.includes(value);
    }
    return finalResult;
  };

  useEffect(() => {
    const sessInfo = JSON.parse(sessionStorage.getItem(`oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`));
    if (!sessInfo) {
      navigate('/workList');
    }
    let authHeaders = sessInfo.token_type + ' ' + sessInfo.access_token;
    console.log("local headers sessInfo", sessInfo);
    setAuthHeaders(authHeaders);
    setuserRoles(sessInfo.profile?.realm_access?.roles);

    // Read labsubsinfo from sessionStorage
    const storedLabsubsInfo = sessionStorage.getItem('labsubsinfo') || '';
    setLabsubsInfo(storedLabsubsInfo);
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
          {isShowFeature('add_report_template') && <Link 
            to="/create-template"
            style={{ textDecoration: 'none' }}
          >
            <Button
              variant="contained"
              color="success"
              className="createUserCls"
            //</div>onClick={() => setShowAddMode(true)
            >
              Create Template
            </Button>
          </Link>}
        </div>
        <h1 className='doctors-list-title'>Template Library</h1>
        {isShowFeature('view_template_list') && <ul className="templatesList">

          {templateData.map(item => (
            <li
              key={item.labName}
              className={isActive ? 'templatesList_dark' : 'templates-item'}
            >
              <div className='modality-area'>
                <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                  {item.sub_modality}
                </strong>
                <p className='sub-modality'>{item.modality}</p>
              </div>


              <div className="reports-justify-between items-center sm:flex">
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
                  {isShowFeature('delete_template') && <Button
                    variant="contained"
                    color="success"
                    className="createUserCls"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteTemplate}
                  >
                    Delete
                  </Button>}
                </Stack>
              </div>
            </li>
          ))}
        </ul>}
        {!isShowFeature('view_template_list') && <div className="noDataCls"><h1>Access Denied</h1>
          <p>Sorry, you do not have the necessary permissions to view this page.</p>
          <p>If you believe this is a mistake, please contact the administrator.</p>
          <p><Link
            to="/workList"
          >
            <li>
              <span>Go Back to Home</span>
            </li>
          </Link></p></div>}
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
