import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../ReportTemplates/report.css';
//import { data } from './reportdata';
import classnames from 'classnames';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import { Link } from 'react-router-dom';
import { Header, AccessDenied, AboutModal, useModal } from '@ohif/ui';
import CatalogView, {
  CatalogActionButton,
  CatalogAvatar,
  CatalogColumn,
  toneFor,
} from '../Catalog/CatalogView';
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
      document.body.classList.remove('reportsList_ContainerCls');
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

  const editTemplate = template =>
    navigate(`/create-template/${template.modality}/${template.template_id}`);

  const renderTemplateCard = template => (
    <article className="cat-card">
      <div className="cat-card-head">
        <CatalogAvatar
          label={String(template.modality || '?').slice(0, 3)}
          tone={toneFor(String(template.modality || ''))}
        />
        <div style={{ minWidth: 0 }}>
          <h3 className="cat-card-title">{template.sub_modality}</h3>
          <div className="cat-card-sub">{template.modality} report template</div>
        </div>
      </div>
      <div className="cat-card-foot">
        <span className={`cat-chip cat-tone-${toneFor(String(template.modality || ''))}`}>
          {template.modality}
        </span>
        <CatalogActionButton
          icon={<EditOutlinedIcon />}
          label="Edit"
          onClick={() => editTemplate(template)}
        />
        {isShowFeature('delete_template') && (
          <CatalogActionButton
            icon={<DeleteOutlineIcon />}
            label="Delete template"
            danger
            iconOnly
            onClick={handleDeleteTemplate}
          />
        )}
      </div>
    </article>
  );

  const templateColumns: CatalogColumn<any>[] = [
    {
      key: 'name',
      label: 'Template',
      width: '55%',
      render: template => (
        <div className="cat-name">
          <CatalogAvatar
            size="sm"
            label={String(template.modality || '?').slice(0, 3)}
            tone={toneFor(String(template.modality || ''))}
          />
          <div style={{ minWidth: 0 }}>
            <strong>{template.sub_modality}</strong>
            <small>{template.modality} report template</small>
          </div>
        </div>
      ),
    },
    {
      key: 'modality',
      label: 'Modality',
      width: '20%',
      render: template => (
        <span className={`cat-chip cat-tone-${toneFor(String(template.modality || ''))}`}>
          {template.modality}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '25%',
      align: 'right',
      render: template => (
        <div className="cat-actions">
          <CatalogActionButton
            icon={<EditOutlinedIcon />}
            label="Edit"
            onClick={() => editTemplate(template)}
          />
          {isShowFeature('delete_template') && (
            <CatalogActionButton
              icon={<DeleteOutlineIcon />}
              label="Delete template"
              danger
              iconOnly
              onClick={handleDeleteTemplate}
            />
          )}
        </div>
      ),
    },
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
      {isShowFeature('view_template_list') ? (
        <CatalogView
          title="Template Library"
          noun={['template', 'templates']}
          items={templateData}
          getKey={template => String(template.template_id)}
          getSearchText={template => `${template.sub_modality} ${template.modality}`}
          searchPlaceholder="Search templates"
          renderCard={renderTemplateCard}
          columns={templateColumns}
          isDark={isActive}
          isLoading={isLoadingTemplates}
          storageKey="catalogView:templates"
          primaryAction={
            isShowFeature('add_report_template') && (
              <button
                type="button"
                className="wl-btn wl-btn--primary"
                onClick={() => navigate('/create-template')}
              >
                <NoteAddOutlinedIcon aria-hidden="true" />
                Create template
              </button>
            )
          }
          emptyTitle="No templates yet"
          emptyText="Create your first report template to get started."
        />
      ) : (
        <main className={classnames('wl', 'cat', isActive && 'wl--dark')}>
          <AccessDenied
            isActive={isActive}
            message="Sorry, you do not have the necessary permissions to view this page. If you believe this is a mistake, please contact the administrator."
          />
          <p style={{ textAlign: 'center' }}>
            <Link to="/workList">
              <span>Go Back to Home</span>
            </Link>
          </p>
        </main>
      )}
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
