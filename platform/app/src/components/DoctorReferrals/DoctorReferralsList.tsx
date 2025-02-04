import React, { useState, useEffect, ReactElement } from 'react';
import '../ReportTemplates/report.css';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Link } from 'react-router-dom';
import { Header } from '@ohif/ui';
import ConfirmationDialog from '../AdminPanel/Users/ConfirmationDialog';
import CreateDoctorReferral from './CreateDoctorReferral';
import './ReferralStyle.css';
import Tooltip from '@mui/material/Tooltip';
import { useNavigate } from 'react-router-dom';

import { useAppConfig } from '@state';

// Declare window.config type
declare global {
  interface Window {
    config: {
      oidc: Array<{
        authority: string;
        client_id: string;
      }>;
    };
  }
}

interface Doctor {
  doc_id: string;
  doc_name: string;
  doc_specialization: string;
  doc_clinic: string;
  doc_phone_number: string;
  doc_email: string;
}

interface HeaderProps {
  isSticky: boolean;
  menuOptions: any[];
  isReturnEnabled: boolean;
  WhiteLabeling: Record<string, unknown>;
  isActive: boolean;
  handleChange: () => void;
  handleRedirectPage: () => void;
  screen: string;
  children: React.ReactNode;
  onClickReturnButton: () => void;
  modalityValue: string;
  iframeBlockFlag: boolean;
}

// Create a wrapper component for Header
const HeaderWrapper = (props: HeaderProps): ReactElement => {
  if (!Header) return <></>;
  return <div>{Header(props)}</div>;
};

function DoctorReferralsList() {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [showconfirm, setShowConfirm] = useState(false);
  const [referralPopup, setReferralPopup] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [editItem, setEachItem] = useState<Doctor | null>(null);
  const [updateError, setUpdateError] = useState('');
  const [isSuccess, setErrorStatus] = useState('');
  const [rolesInfo, setuserRoles] = useState('');
  const [subscriptionFeatures, setLabsubsInfo] = useState('');
  const labId = sessionStorage.getItem('labId') || '';
  const [appConfig] = useAppConfig();

  //const nodeAppHost = process.env.REACT_APP_HOST_NAME;
  const nodeAppHost = appConfig.nodeAppHostURL || 'https://ciaiteleradiology.com/teleapp';

  useEffect(() => {
    document.body.classList.add('bg-black');
    document.body.classList.add('reportsList_ContainerCls');
    return () => {
      document.body.classList.remove('bg-black');
      document.body.classList.add('reportsList_ContainerCls');
    };
  }, []);

  useEffect(() => {
    readDoctorsList();
  }, []);

  const isShowFeature = value => {
    let finalResult = false;
    // console.log("subscriptionFeatures ", subscriptionFeatures, "rolesInfo ", rolesInfo);
    if (subscriptionFeatures && rolesInfo) {
      finalResult = subscriptionFeatures.includes(value) && rolesInfo.includes(value);
    }
    return finalResult;
  };

  const readDoctorsList = () => {
    const sessInfo = JSON.parse(
      sessionStorage.getItem(
        `oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`
      ) || '{}'
    );

    if (!sessInfo) {
      navigate('/workList');
    }
    const authHeaders = `${sessInfo.token_type} ${sessInfo.access_token}`;
    const clientId = window.config.oidc[0].client_id;
    setuserRoles(sessInfo.profile?.realm_access?.roles);

    // Read labsubsinfo from sessionStorage
    const storedLabsubsInfo = sessionStorage.getItem('labsubsinfo') || '';
    setLabsubsInfo(storedLabsubsInfo);

    fetch(`${nodeAppHost}/get_referral_doctors`, {
      method: 'GET',
      headers: {
        Authorization: authHeaders,
        clientId: clientId,
        realm: clientId,
        'Content-Type': 'application/json',
        'test-header': 'test',
        isAccess: 'view_referral_doctors_list',
        labId: labId,
      },
    })
      .then(response => response.json())
      .then(actualData => {
        // console.log('actualData ', actualData);
        setDoctorsList(actualData.data);
      })
      .catch(err => {
        console.log(err.message);
      });
  };

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
    const items = JSON.parse(localStorage.getItem('active_dark') || 'false');
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

  const handleEditItem = (docId: string) => {
    const editData = doctorsList.find(item => item.doc_id === docId);
    if (editData) {
      setEachItem(editData);
      setShowEditConfirm(true);
    }
  };

  const handleCloseConfirmation = () => {
    if (showconfirm) {
      setShowConfirm(false);
    } else if (referralPopup) {
      setReferralPopup(false);
    } else {
      setShowEditConfirm(false);
    }
  };

  const sendUpdateMessage = (response: { message: string; status: string }) => {
    setUpdateError(response.message);
    setErrorStatus(response.status);
    readDoctorsList();
    setTimeout(() => {
      setUpdateError('');
      setErrorStatus('');
    }, 3000);
  };

  const handleRedirectPage = () => {
    navigate('/workList');
  };

  const onClickReturnButton = () => {
    // Handle return button click if needed
  };

  const handleCreateReferral = (event: React.MouseEvent) => {
    event.preventDefault();
    setReferralPopup(true);
  };

  return (
    <div>
      <HeaderWrapper
        isSticky={true}
        menuOptions={[]}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        handleRedirectPage={handleRedirectPage}
        screen="ReportTemplateList"
        children={null}
        onClickReturnButton={onClickReturnButton}
        modalityValue=""
        iframeBlockFlag={true}
      />
      <div className="reportcontainer">
        <h1 className="doctors-list-title">Study Review Specialists</h1>
        {isShowFeature('create_referral_doctor') && (
          <div className="createBtnCls">
            <div className="response-container">
              <span
                className={
                  isSuccess === 'success'
                    ? 'success-message'
                    : isSuccess === 'error'
                      ? 'error-message'
                      : ''
                }
              >
                {updateError}
              </span>
            </div>
            <div style={{ width: '20%', textAlign: 'right' }}>
              <Button
                variant="contained"
                color="success"
                className="createUserCls"
                onClick={handleCreateReferral}
              >
                Create Referral
              </Button>
            </div>
          </div>
        )}

        {isShowFeature('view_referral_doctors_list') && (
          <ul className="templatesList">
            {doctorsList.map(item => (
              <li
                key={item.doc_id}
                className={isActive ? 'templatesList_dark' : 'templates-item'}
              >
                <div className="modality-area">
                  <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                    {item.doc_name}
                  </strong>
                  <p
                    className="sub-modality"
                    style={{ fontWeight: 'italic' }}
                  >
                    {item.doc_specialization}, {item.doc_clinic}
                  </p>
                </div>

                <div className="buttonAdjustCls items-center sm:flex">
                  <Stack
                    direction="row"
                    spacing={2}
                  >
                    {isShowFeature('create_referral_doctor') && (
                      <Tooltip title="Edit">
                        <EditIcon
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleEditItem(item.doc_id)}
                        />
                      </Tooltip>
                    )}
                    {isShowFeature('delete_referral_doctor') && (
                      <Tooltip title="Delete">
                        <DeleteIcon
                          style={{ cursor: 'pointer' }}
                          onClick={handleDeleteTemplate}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!isShowFeature('view_referral_doctors_list') && (
          <div className="noDataCls">
            <h1>Access Denied</h1>
            <p>Sorry, you do not have the necessary permissions to view this page.</p>
            <p>If you believe this is a mistake, please contact the administrator.</p>
            <p>
              <Link to="/workList">
                <li>
                  <span>Go Back to Home</span>
                </li>
              </Link>
            </p>
          </div>
        )}
      </div>
      {showEditConfirm && editItem && (
        <CreateDoctorReferral
          open={showEditConfirm}
          handleClose={handleCloseConfirmation}
          screen="EditScreen"
          editData={editItem}
          sendUpdateMessage={sendUpdateMessage}
        />
      )}
      {showconfirm && (
        <ConfirmationDialog
          open={showconfirm}
          handleClose={handleCloseConfirmation}
          screen="DoctorReferralsList"
        />
      )}
      {referralPopup && (
        <CreateDoctorReferral
          open={referralPopup}
          handleClose={handleCloseConfirmation}
          screen="CreateScreen"
          setReferralPopup={setReferralPopup}
          sendUpdateMessage={sendUpdateMessage}
        />
      )}
    </div>
  );
}

export default DoctorReferralsList;
