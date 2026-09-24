import React, { useState, useEffect, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import '../ReportTemplates/report.css';
import classnames from 'classnames';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { Link } from 'react-router-dom';
import CatalogView, {
  CatalogActionButton,
  CatalogAvatar,
  CatalogColumn,
  toneFor,
} from '../Catalog/CatalogView';
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
      document.body.classList.remove('reportsList_ContainerCls');
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

  const initialsOf = (name = '') =>
    name
      .replace(/^(dr\.?|doctor)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?';

  const doctorActions = (doctor: Doctor) => (
    <>
      {isShowFeature('create_referral_doctor') && (
        <CatalogActionButton
          icon={<EditOutlinedIcon />}
          label="Edit"
          onClick={() => handleEditItem(doctor.doc_id)}
        />
      )}
      {isShowFeature('delete_referral_doctor') && (
        <CatalogActionButton
          icon={<DeleteOutlineIcon />}
          label="Delete specialist"
          danger
          iconOnly
          onClick={handleDeleteTemplate}
        />
      )}
    </>
  );

  const renderDoctorCard = (doctor: Doctor) => (
    <article className="cat-card">
      <div className="cat-card-head">
        <CatalogAvatar
          label={initialsOf(doctor.doc_name)}
          tone={toneFor(doctor.doc_name || '')}
        />
        <div style={{ minWidth: 0 }}>
          <h3 className="cat-card-title">{doctor.doc_name}</h3>
          <div className="cat-card-sub">{doctor.doc_specialization}</div>
        </div>
      </div>
      <ul className="cat-card-meta">
        {doctor.doc_clinic && (
          <li title={doctor.doc_clinic}>
            <ApartmentOutlinedIcon aria-hidden="true" />
            <span>{doctor.doc_clinic}</span>
          </li>
        )}
        {doctor.doc_phone_number && (
          <li title={doctor.doc_phone_number}>
            <PhoneOutlinedIcon aria-hidden="true" />
            <span>{doctor.doc_phone_number}</span>
          </li>
        )}
        {doctor.doc_email && (
          <li title={doctor.doc_email}>
            <MailOutlineIcon aria-hidden="true" />
            <span>{doctor.doc_email}</span>
          </li>
        )}
      </ul>
      <div className="cat-card-foot">
        <span style={{ marginRight: 'auto' }} />
        {doctorActions(doctor)}
      </div>
    </article>
  );

  const doctorColumns: CatalogColumn<Doctor>[] = [
    {
      key: 'name',
      label: 'Specialist',
      width: '30%',
      render: doctor => (
        <div className="cat-name">
          <CatalogAvatar
            size="sm"
            label={initialsOf(doctor.doc_name)}
            tone={toneFor(doctor.doc_name || '')}
          />
          <div style={{ minWidth: 0 }}>
            <strong title={doctor.doc_name}>{doctor.doc_name}</strong>
            <small title={doctor.doc_specialization}>{doctor.doc_specialization}</small>
          </div>
        </div>
      ),
    },
    { key: 'clinic', label: 'Clinic', width: '20%', render: doctor => doctor.doc_clinic || '—' },
    { key: 'phone', label: 'Phone', width: '15%', render: doctor => doctor.doc_phone_number || '—' },
    { key: 'email', label: 'Email', width: '20%', render: doctor => doctor.doc_email || '—' },
    {
      key: 'actions',
      label: 'Actions',
      width: '15%',
      align: 'right',
      render: doctor => <div className="cat-actions">{doctorActions(doctor)}</div>,
    },
  ];

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
      {isShowFeature('view_referral_doctors_list') ? (
        <CatalogView<Doctor>
          title="Study Review Specialists"
          noun={['specialist', 'specialists']}
          items={doctorsList || []}
          getKey={doctor => doctor.doc_id}
          getSearchText={doctor =>
            [doctor.doc_name, doctor.doc_specialization, doctor.doc_clinic, doctor.doc_email].join(' ')
          }
          searchPlaceholder="Search specialists"
          renderCard={renderDoctorCard}
          columns={doctorColumns}
          isDark={isActive}
          isLoading={isLoadingDoctors}
          storageKey="catalogView:specialists"
          primaryAction={
            isShowFeature('create_referral_doctor') && (
              <button
                type="button"
                className="wl-btn wl-btn--primary"
                onClick={handleCreateReferral}
              >
                <PersonAddAlt1OutlinedIcon aria-hidden="true" />
                Add specialist
              </button>
            )
          }
          notice={
            updateError ? (
              <InlineAlert
                type={isSuccess === 'success' ? 'success' : 'error'}
                message={updateError}
                isActive={isActive}
              />
            ) : null
          }
          emptyTitle="No study review specialists yet"
          emptyText="Add a specialist to start referring studies for review."
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
