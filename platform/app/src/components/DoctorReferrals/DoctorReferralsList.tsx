import React, { useState, useEffect, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import '../ReportTemplates/report.css';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Link } from 'react-router-dom';
import { Header, AccessDenied, InlineAlert, AboutModal, useModal } from '@ohif/ui';
import ConfirmationDialog from '../AdminPanel/Users/ConfirmationDialog';
import CreateDoctorReferral from './CreateDoctorReferral';
import SubscriptionFeaturesModal from '../AdminPanel/SubscriptionFeaturesModal';
import getHeaderMenuOptions from '../../utils/getHeaderMenuOptions';
import './ReferralStyle.css';
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
  const { t } = useTranslation();
  const { show } = useModal();
  const [isActive, setIsActive] = useState(false);
  const [showconfirm, setShowConfirm] = useState(false);
  const [referralPopup, setReferralPopup] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [editItem, setEachItem] = useState<Doctor | null>(null);
  const [updateError, setUpdateError] = useState('');
  const [isSuccess, setErrorStatus] = useState('');
  const [rolesInfo, setuserRoles] = useState('');
  const [subscriptionFeatures, setLabsubsInfo] = useState('');
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [userInfoData, setUserInfoData] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('userInfoData') || 'null');
    } catch (e) {
      return null;
    }
  });
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
        setIsLoadingDoctors(false);
      })
      .catch(err => {
        console.log(err.message);
        setIsLoadingDoctors(false);
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

  const versionNumber = process.env.VERSION_NUMBER;
  const commitHash = process.env.COMMIT_HASH;

  const menuOptions = [
    {
      title: t('Header:About'),
      icon: 'info',
      onClick: () =>
        show({
          content: AboutModal,
          title: 'About Tele Radiology',
          contentProps: { versionNumber, commitHash, isActive },
        }),
    },
    ...getHeaderMenuOptions({
      t,
      isActive,
      handleChangeSwitch,
      navigate,
      appConfig,
      currentPath: '/doctor-referrals',
      onProfileClick: userInfoData ? () => setIsSubscriptionModalOpen(true) : undefined,
    }),
  ];

  return (
    <div>
      <HeaderWrapper
        isSticky={true}
        menuOptions={menuOptions}
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
      {userInfoData && subscriptionFeatures && (
        <SubscriptionFeaturesModal
          open={isSubscriptionModalOpen}
          handleClose={() => setIsSubscriptionModalOpen(false)}
          userRolesInfo={userInfoData}
          subscriptionFeaturesInfo={subscriptionFeatures}
          isActive={isActive}
        />
      )}
      <div className="reportcontainer">
        <h1 className="doctors-list-title">Study Review Specialists</h1>
        {isShowFeature('create_referral_doctor') && (
          <div className="createBtnCls flex flex-wrap items-center justify-between gap-3">
            <div className="response-container grow">
              {updateError && (
                <InlineAlert
                  type={isSuccess === 'success' ? 'success' : 'error'}
                  message={updateError}
                  isActive={isActive}
                />
              )}
            </div>
            <div>
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
          <>
            {isLoadingDoctors ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <CircularProgress size={28} sx={{ color: '#0a7c6c' }} />
                <p style={{ color: isActive ? '#8890a0' : '#6b7280', fontSize: 13 }}>
                  Loading specialists…
                </p>
              </div>
            ) : doctorsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <p style={{ fontWeight: 600, color: isActive ? '#f3f4f6' : '#111827' }}>
                  No study review specialists yet
                </p>
                <p style={{ fontSize: 13, color: isActive ? '#8890a0' : '#6b7280' }}>
                  Add a specialist to start referring studies for review.
                </p>
              </div>
            ) : (
              <ul className="templatesList grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {doctorsList.map(item => (
                  <li
                    key={item.doc_id}
                    className={isActive ? 'templatesList_dark' : 'templates-item'}
                  >
                    <div className="modality-area">
                      <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                        {item.doc_name}
                      </strong>
                      <p className="sub-modality">
                        {item.doc_specialization}, {item.doc_clinic}
                      </p>
                      {(item.doc_phone_number || item.doc_email) && (
                        <p
                          className="sub-modality"
                          style={{ fontSize: 12, opacity: 0.8 }}
                        >
                          {item.doc_phone_number}
                          {item.doc_phone_number && item.doc_email ? ' · ' : ''}
                          {item.doc_email}
                        </p>
                      )}
                    </div>

                    <div className="buttonAdjustCls mt-3 flex items-center">
                      <Stack
                        direction="row"
                        spacing={1.5}
                      >
                        {isShowFeature('create_referral_doctor') && (
                          <Button
                            variant="outlined"
                            color="success"
                            size="small"
                            startIcon={<EditIcon fontSize="small" />}
                            onClick={() => handleEditItem(item.doc_id)}
                          >
                            Edit
                          </Button>
                        )}
                        {isShowFeature('delete_referral_doctor') && (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<DeleteIcon fontSize="small" />}
                            onClick={handleDeleteTemplate}
                          >
                            Delete
                          </Button>
                        )}
                      </Stack>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {!isShowFeature('view_referral_doctors_list') && (
          <>
            <AccessDenied
              isActive={isActive}
              message="Sorry, you do not have the necessary permissions to view this page. If you believe this is a mistake, please contact the administrator."
            />
            <p style={{ textAlign: 'center' }}>
              <Link to="/workList">
                <span>Go Back to Home</span>
              </Link>
            </p>
          </>
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
