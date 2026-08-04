import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../ReportTemplates/report.css';
//import { data } from './reportdata';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Link } from 'react-router-dom';
import { Header, AccessDenied, StatusBadge, AboutModal, useModal } from '@ohif/ui';
import ConfirmationDialog from '../AdminPanel/Users/ConfirmationDialog';
import SubscriptionFeaturesModal from '../AdminPanel/SubscriptionFeaturesModal';
import getHeaderMenuOptions from '../../utils/getHeaderMenuOptions';
import { useNavigate } from 'react-router-dom';
import { useAppConfig } from '@state';

function ReportTemplatesList() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { show } = useModal();
  const [isActive, setIsActive] = useState(false);
  const [templateData, setData] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [showconfirm, setShowConfirm] = useState(false);
  const [authHeaders, setAuthHeaders] = useState('');
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
  const [appConfig] = useAppConfig();

  const labId = sessionStorage.getItem('labId') || '';
  //const nodeAppHost = process.env.REACT_APP_HOST_NAME;
  const nodeAppHost = appConfig.nodeAppHostURL || 'https://ciaiteleradiology.com/teleapp';

  useEffect(() => {
    //let authHeaders = localStorage.getItem('auth-t');
    const clientId = window.config.oidc[0].client_id;

    // console.log("local headers read_templates ", authHeaders);
    if (authHeaders) {
      fetch(`${nodeAppHost}/read_templates`, {
        method: 'GET',
        headers: {
          Authorization: authHeaders,
          clientId: clientId,
          realm: clientId,
          'Content-Type': 'application/json',
          isAccess: 'view_template_list',
          labId: labId,
        },
      })
        .then(response => response.json())
        .then(actualData => {
          // console.log('actualData ', actualData);
          setData(actualData.data);
          setIsLoadingTemplates(false);
        })
        .catch(err => {
          console.log(err.message);
          setIsLoadingTemplates(false);
        });
    }
  }, [authHeaders]);

  const isShowFeature = value => {
    let finalResult = false;
    // console.log("subscriptionFeatures ", subscriptionFeatures, "rolesInfo ", rolesInfo);
    if (subscriptionFeatures && rolesInfo) {
      finalResult = subscriptionFeatures.includes(value) && rolesInfo.includes(value);
    }
    return finalResult;
  };

  useEffect(() => {
    const sessInfo = JSON.parse(
      sessionStorage.getItem(
        `oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`
      )
    );
    if (!sessInfo) {
      navigate('/workList');
    }
    let authHeaders = sessInfo.token_type + ' ' + sessInfo.access_token;
    // console.log("local headers sessInfo", sessInfo);
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
      currentPath: '/report-templates',
      onProfileClick: userInfoData ? () => setIsSubscriptionModalOpen(true) : undefined,
    }),
  ];

  return (
    <div>
      <Header
        isSticky
        menuOptions={menuOptions}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        handleRedirectPage={handleRedirectPage}
        screen="ReportTemplateList"
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
        <div className="createBtnCls">
          {isShowFeature('add_report_template') && (
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
                Create Template
              </Button>
            </Link>
          )}
        </div>
        <h1 className="doctors-list-title">Template Library</h1>
        {isShowFeature('view_template_list') && (
          <>
            {isLoadingTemplates ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <CircularProgress size={28} sx={{ color: '#0a7c6c' }} />
                <p style={{ color: isActive ? '#8890a0' : '#6b7280', fontSize: 13 }}>
                  Loading templates…
                </p>
              </div>
            ) : templateData.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <p
                  style={{
                    fontWeight: 600,
                    color: isActive ? '#f3f4f6' : '#111827',
                  }}
                >
                  No templates yet
                </p>
                <p style={{ fontSize: 13, color: isActive ? '#8890a0' : '#6b7280' }}>
                  Create your first report template to get started.
                </p>
              </div>
            ) : (
              <ul className="templatesList grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {templateData.map(item => (
                  <li
                    key={item.labName}
                    className={isActive ? 'templatesList_dark' : 'templates-item'}
                  >
                    <div className="modality-area flex items-start justify-between gap-2">
                      <div>
                        <strong className={isActive ? 'templateTitleCls' : 'templateTitleCls_dark'}>
                          {item.sub_modality}
                        </strong>
                        <p className="sub-modality">{item.modality}</p>
                      </div>
                      <StatusBadge
                        label={item.modality}
                        variant="info"
                        isActive={isActive}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <Stack
                        direction="row"
                        spacing={1.5}
                      >
                        <Link
                          to={`/create-template/${item.modality}/${item.template_id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Button
                            variant="outlined"
                            color="success"
                            size="small"
                            startIcon={<EditIcon fontSize="small" />}
                          >
                            Edit
                          </Button>
                        </Link>
                        {isShowFeature('delete_template') && (
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
        {!isShowFeature('view_template_list') && (
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
