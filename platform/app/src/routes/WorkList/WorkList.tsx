import React, { useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import PropTypes, { element, func } from 'prop-types';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import qs from 'query-string';
import isEqual from 'lodash.isequal';
import { useTranslation } from 'react-i18next';
import filtersMeta from './filtersMeta.js';
import getHeaderMenuOptions from '../../utils/getHeaderMenuOptions';
import { useAppConfig } from '@state';
import { useDebounce, useSearchParams } from '@hooks';
import { utils, hotkeys, ServicesManager } from '@ohif/core';
// import '../../style.css';
import DoDisturbIcon from '@mui/icons-material/DoDisturb';
import CloseIcon from '@mui/icons-material/Close';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
const dotenv = require('dotenv');
import SubscriptionFeaturesModal from '../../components/AdminPanel/SubscriptionFeaturesModal';
import AiAnalysisDialog from './AiAnalysisDialog/AiAnalysisDialog';
import AiStatusBadge from './AiAnalysisDialog/AiStatusBadge';
import useAiReportPipeline from './AiAnalysisDialog/useAiReportPipeline';
import WorklistTable, { WorklistRow } from './components/WorklistTable';
import StudyRowActions from './components/StudyRowActions';
import {
  CopyableText,
  WorklistPagination,
  WorklistToolbar,
  getActiveFilters,
} from './components/WorklistParts';
import './components/worklist.css';

import {
  Header,
  useModal,
  AboutModal,
  UserPreferences,
  ProgressBanner,
  StatusBadge,
} from '@ohif/ui';

import i18n from '@ohif/i18n';
import GenerateReferral from '../../components/DoctorReferrals/GenerateReferral';

const { sortBySeriesDate } = utils;

const { availableLanguages, defaultLanguage, currentLanguage } = i18n;

const seriesInStudiesMap = new Map();
//var defaultLoad = true;

// Maps a study status string to a StatusBadge variant. Mirrors the exact same
// "match on the first word" behavior the legacy `'common' + studyStatus` CSS
// class hack relied on (e.g. status.css only ever defined .commonIn-Progress,
// .commonReferral, .commonReport, .commonEmergency, .commonReady), but as an
// explicit function with a safe fallback instead of a stray-classname trick.
const getStatusBadgeVariant = (status: string) => {
  if (!status) {
    return 'neutral';
  }
  if (status.startsWith('In-Progress')) {
    return 'neutral';
  }
  // Lavender: a referral is waiting on another reader, distinct from "Ready" (sky).
  if (status.startsWith('Referral')) {
    return 'violet';
  }
  if (status.startsWith('Report')) {
    return 'success';
  }
  if (status.startsWith('Emergency')) {
    return 'emergency';
  }
  if (status.startsWith('Ready')) {
    return 'info';
  }
  return 'neutral';
};

/**
 * TODO:
 * - debounce `setFilterValues` (150ms?)
 */
function WorkList({
  data: studies,
  dataTotal: studiesTotal,
  isLoadingData,
  dataSource,
  hotkeysManager,
  dataPath,
  onRefresh,
  servicesManager,
  ...props
}) {
  const items1 = JSON.parse(localStorage.getItem('active_dark'));
  const { hotkeyDefinitions, hotkeyDefaults } = hotkeysManager;
  const { show, hide } = useModal();
  const { t } = useTranslation();
  // ~ Modes
  const [appConfig] = useAppConfig();
  const nodeAppHost = appConfig.nodeAppHostURL || 'https://ciaiteleradiology.com/teleapp';
  const hostNameurl = appConfig.pacsHostURL;
  const keyCloakhost = appConfig.keyCloakHostURL || 'https://ciaiteleradiology.com/keycloak';

  // ~ Filters
  const searchParams = useSearchParams();
  const navigate = useNavigate();

  const STUDIES_LIMIT = 25;
  const queryFilterValues = _getQueryFilterValues(searchParams);
  const [filterValues, _setFilterValues] = useState({
    ...defaultFilterValues,
    ...queryFilterValues,
  });

  const debouncedFilterValues = useDebounce(filterValues, 200);
  const { resultsPerPage, pageNumber, sortBy, sortDirection } = filterValues;

  const [isActive, setIsActive] = useState(false);
  const [referralPopup, setReferralPopup] = useState(false);
  const [showStudyInstanceId, setShowStudyInstanceID] = useState('');
  const [iframeImageflag, setIframeImageflag] = useState<string>('disableIframeFlag');
  const [iframeWindowflag, setIframeWindowflag] = useState<string>('iframeDisable');
  const [iframeBlockFlag, setIframeBlockFlag] = useState(true);
  const [stuID, setStuID] = useState('');
  const [defaultLoad, setDefaultLoad] = useState(true);
  const [loadStudentID, setloadStudentID] = useState('');
  const [modalityFlag, setModalityFlag] = useState('');
  const [mDropDowns, setMDropDowns] = useState('');
  const [subscriptionFeatures, setSubscriptionFeatures] = useState();
  const [aiAnalysisStudy, setAiAnalysisStudy] = useState<any>(null);

  const [rolesInfo, setRolesData] = useState(); // State to store fetched data
  const [authHeaders, setAuthHeaders] = useState('');
  const aiPipeline = useAiReportPipeline({
    studies,
    baseUrl: hostNameurl,
    authHeaders,
    autoGenerate: appConfig.aiReportAutoGenerate !== false,
  });

  const [userInfoData, setUserInfoResult] = useState({});
  const [isSaveToServerInprogress, setIsSaveToServerInprogress] = useState(false);
  // Named in the progress banner so the user can tell which row is in flight.
  const [savingStudyLabel, setSavingStudyLabel] = useState('');
  const [saveToServerError, setSaveToServerError] = useState('');

  /*
   * The default sort value keep the filters synchronized with runtime conditional sorting
   * Only applied if no other sorting is specified and there are less than 101 studies
   */
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = React.useState(false);

  const handleOpenSubscriptionModal = () => {
    setIsSubscriptionModalOpen(true);
  };

  const handleCloseSubscriptionModal = () => {
    setIsSubscriptionModalOpen(false);
  };

  const canSort = studiesTotal < STUDIES_LIMIT;
  const shouldUseDefaultSort = sortBy === '' || !sortBy;
  const sortModifier = sortDirection === 'descending' ? 1 : -1;
  const defaultSortValues =
    shouldUseDefaultSort && canSort ? { sortBy: 'studyDate', sortDirection: 'ascending' } : {};
  const sortedStudies = studies;
  const hostname = window.location.hostname;
  const hideOption = hostname == 'ciaiteleradiology.com' ? false : true;
  if (canSort) {
    studies.sort((s1, s2) => {
      if (shouldUseDefaultSort) {
        const ascendingSortModifier = -1;
        return _sortStringDates(s1, s2, ascendingSortModifier);
      }

      const s1Prop = s1[sortBy];
      const s2Prop = s2[sortBy];

      if (typeof s1Prop === 'string' && typeof s2Prop === 'string') {
        return s1Prop.localeCompare(s2Prop) * sortModifier;
      } else if (typeof s1Prop === 'number' && typeof s2Prop === 'number') {
        return (s1Prop > s2Prop ? 1 : -1) * sortModifier;
      } else if (!s1Prop && s2Prop) {
        return -1 * sortModifier;
      } else if (!s2Prop && s1Prop) {
        return 1 * sortModifier;
      } else if (sortBy === 'studyDate') {
        return _sortStringDates(s1, s2, sortModifier);
      }

      return 0;
    });
  }

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [activeViewerMenuStudyId, setActiveViewerMenuStudyId] = useState('');
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>, sid: any, mdFlag: any) => {
    event.preventDefault();
    setStuID(sid);
    setActiveViewerMenuStudyId(sid);
    setAnchorEl(event.currentTarget);
    setModalityFlag(mdFlag);
    localStorage.setItem('sid', sid);
    localStorage.setItem('mdFlag', mdFlag);
    localStorage.setItem('ViewerLayoutFlag', 'on');
  };
  const handleClose = () => {
    setAnchorEl(null);
    setActiveViewerMenuStudyId('');
  };

  useEffect(() => {
    console.log('appConfig.nodeAppHostURL', nodeAppHost);
    const sessInfo = JSON.parse(
      sessionStorage.getItem(
        `oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`
      )
    );
    let authHeaders = sessInfo.token_type + ' ' + sessInfo.access_token;
    setAuthHeaders(authHeaders);
  }, []);

  const generateDynamicDropdowns = (sid, md) => {
    fetch(`${nodeAppHost}/get_sub_modalities/${md}`, {
      method: 'GET',
      headers: {
        Authorization: authHeaders,
        'Content-Type': 'application/json',
        clientId: window.config.oidc[0].client_id,
        realm: window.config.oidc[0].client_id,
        isAccess: 'get_sub_modalities',
        labId: sessionStorage.getItem('labId'),
        userSub: sessionStorage.getItem('user_sub'),
      },
    })
      .then(response => response.json())
      .then(actualData => {
        if (actualData.data.length > 1) {
          const newDa =
            actualData.data &&
            actualData.data?.map((data, key) => {
              return (
                <>
                  <MenuItem
                    key={key}
                    id={data.sub_modality}
                    onClick={() => {
                      const bsurl = `/generate-report/${sid}/${data.template_id}/m`;
                      navigate(bsurl);
                    }}
                  >
                    {data.sub_modality}
                  </MenuItem>
                </>
              );
            });

          setMDropDowns(newDa);
        } else {
          setMDropDowns('');
          const bsurl = `/generate-report/${sid}/${md}/s`;
          navigate(bsurl);
        }
      })
      .catch(err => {
        console.log(err.message);
      });
  };

  const [anchorElNew, setAnchorElNew] = React.useState<null | HTMLElement>(null);
  const [activeReportMenuStudyId, setActiveReportMenuStudyId] = useState('');
  const openNew = Boolean(anchorElNew);
  const handleClickNew = (
    event: React.MouseEvent<HTMLButtonElement>,
    sid: any,
    mdFlag: any,
    isReportGenerated
  ) => {
    event.preventDefault();
    setStuID(sid);
    setActiveReportMenuStudyId(sid);
    setAnchorElNew(event.currentTarget);
    //setModalityFlag(mdFlag);

    const myArrayFlg = mdFlag.replace(/\\/g, '-');
    //var myArrayFlg = 'MR\SR'.replace(/\\/g, "-");
    let mArrayFlg = myArrayFlg;
    if (myArrayFlg.length > 2) {
      mArrayFlg = myArrayFlg.slice(0, 2);
    }

    //let mArrayFlg = myArrayFlg?.length > 0 ? myArrayFlg[0] : mdFlag;
    localStorage.setItem('sid', sid);
    //localStorage.setItem('mdFlag', mdFlag);
    localStorage.setItem('mdFlag', mArrayFlg);
    setModalityFlag(mArrayFlg);
    if (isReportGenerated !== 'true') {
      generateDynamicDropdowns(sid, mArrayFlg);
    } else {
      setMDropDowns('');
      const bsurl = `/generate-report/${sid}/${mArrayFlg}/s`;
      navigate(bsurl);
    }
  };
  const handleCloseNew = () => {
    setAnchorElNew(null);
    setActiveReportMenuStudyId('');
  };

  // Analysis runs automatically on upload, so opening the AI view never starts
  // work by itself; it shows wherever the study is in the pipeline.
  const handleOpenAiAnalysis = study => {
    handleClose();
    setAiAnalysisStudy(study);
  };

  const handleCloseAiAnalysis = () => {
    setAiAnalysisStudy(null);
  };

  const storeStidStatus = (stuID, isReportGenerated) => {
    sessionStorage.removeItem('isReportGenerated');
    sessionStorage.setItem('stuID', stuID);
    sessionStorage.setItem('isReportGenerated', isReportGenerated);
  };
  const handleDocModal = isReportGenerated => {
    const bsurl = '/viewer?StudyInstanceUIDs=' + stuID;
    storeStidStatus(stuID, isReportGenerated);
    navigate(bsurl);
  };
  const handleSegmentationModal = isReportGenerated => {
    const bsurl = '/segmentation?StudyInstanceUIDs=' + stuID;
    storeStidStatus(stuID, isReportGenerated);
    navigate(bsurl);
  };
  const handleTMTVModal = isReportGenerated => {
    const bsurl = '/tmtv?StudyInstanceUIDs=' + stuID;
    storeStidStatus(stuID, isReportGenerated);
    navigate(bsurl);
  };
  const handleMicroscopyModal = isReportGenerated => {
    const bsurl = '/microscopy?StudyInstanceUIDs=' + stuID;
    storeStidStatus(stuID, isReportGenerated);
    navigate(bsurl);
  };
  const handleDynamicVolumeModal = isReportGenerated => {
    const bsurl = '/dynamic-volume?StudyInstanceUIDs=' + stuID;
    storeStidStatus(stuID, isReportGenerated);
    navigate(bsurl);
  };

  // ~ Rows & Studies
  const [expandedRows, setExpandedRows] = useState([]);
  const [studiesWithSeriesData, setStudiesWithSeriesData] = useState([]);
  const numOfStudies = studiesTotal;
  const querying = useMemo(() => {
    return isLoadingData || expandedRows.length > 0;
  }, [isLoadingData, expandedRows]);

  const setFilterValues = val => {
    console.log('setFilterValues', val);
    if (filterValues.pageNumber === val.pageNumber) {
      val.pageNumber = 1;
    }
    _setFilterValues(val);
    setExpandedRows([]);
  };

  const onPageNumberChange = newPageNumber => {
    const oldPageNumber = filterValues.pageNumber;
    // const rollingPageNumberMod = Math.floor(101 / filterValues.resultsPerPage);
    // const rollingPageNumber = oldPageNumber % rollingPageNumberMod;
    // const isNextPage = newPageNumber > oldPageNumber;
    // const hasNextPage = Math.max(rollingPageNumber, 1) * resultsPerPage < numOfStudies;
    if (oldPageNumber < newPageNumber && numOfStudies < filterValues.resultsPerPage) {
      return;
    }
    // if (isNextPage && !hasNextPage) {
    //   return;
    // }
    setFilterValues({ ...filterValues, pageNumber: newPageNumber });
  };

  const onResultsPerPageChange = newResultsPerPage => {
    setFilterValues({
      ...filterValues,
      pageNumber: 1,
      resultsPerPage: Number(newResultsPerPage),
    });
  };

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
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

  useEffect(() => {
    const isMounted = true;
    const clientId = window.config.oidc[0].client_id;
    if (authHeaders) {
      try {
        const userInfoUrl = `${keyCloakhost}/realms/${clientId}/protocol/openid-connect/userinfo`;
        const labSubscriptionsURL = `${nodeAppHost}/get_lab_subscriptions/2`;

        const options = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeaders,
            clientId: clientId,
            realm: clientId,
            isAccess: 'get_lab_subscriptions',
          },
        };

        const options2 = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeaders,
            clientId: clientId,
            realm: clientId,
          },
        };

        Promise.all([
          fetch(userInfoUrl, options).then(response => response.json()),
          fetch(labSubscriptionsURL, options2).then(response => response.json()),
        ])
          .then(([userInfoResult, labSubscriptions]) => {
            if (userInfoResult?.realm_access?.roles) {
              setRolesData(userInfoResult.realm_access.roles);
            }
            if (!sessionStorage.getItem('user_sub')) {
              sessionStorage.setItem('user_sub', '');
            }
            sessionStorage.setItem('user_sub', userInfoResult.sub);

            if (!sessionStorage.getItem('labsubsinfo')) {
              sessionStorage.setItem('labsubsinfo', '');
            }
            if (userInfoResult) {
              const userObj = {
                user_name: userInfoResult.name,
                user_email: userInfoResult.email,
                user_roles: userInfoResult.realm_access.roles,
                lab_name: labSubscriptions?.data?.labSubscriptions[0].lab_name || '',
                lab_subscription:
                  labSubscriptions?.data?.labSubscriptions[0].subscription_type_name || '',
                lab_subscription_desc:
                  labSubscriptions?.data?.labSubscriptions[0].subscription_description || '',
              };
              setUserInfoResult(userObj);
              // Cached so the Profile menu item can render the same summary from
              // the Template Library / Study Review Specialists pages without
              // re-fetching it there.
              sessionStorage.setItem('userInfoData', JSON.stringify(userObj));
            }

            if (labSubscriptions?.data?.features[0]?.features_list) {
              setSubscriptionFeatures(labSubscriptions?.data?.features[0]?.features_list);
              sessionStorage.setItem(
                'labsubsinfo',
                labSubscriptions?.data?.features[0]?.features_list
              );
            }

            if (!sessionStorage.getItem('labId')) {
              sessionStorage.setItem('labId', '');
            }
            if (labSubscriptions?.data?.labSubscriptions[0]?.lab_id) {
              sessionStorage.setItem('labId', labSubscriptions?.data?.labSubscriptions[0]?.lab_id);
            }
          })
          .catch(err => {
            console.log(err.message);
          });
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }
  }, [authHeaders]);

  const isShowFeature = value => {
    let finalResult = false;
    if (subscriptionFeatures && rolesInfo) {
      finalResult = subscriptionFeatures.includes(value) && rolesInfo.includes(value);
    }
    return finalResult;
  };

  function handleChangeSwitch() {
    localStorage.setItem('active_dark', JSON.stringify(!isActive));
    setIsActive(!isActive);
  }
  const handleRedirectPage = () => {
    //alert(1234)
    navigate('/workList');
    //navigate(-1);
  };
  // const saveToServer = async studyId => {
  //   try {
  //     const text =
  //       'Do you really want to Save this into Server...? It will take sometime to process your request';
  //     if (confirm(text) == true) {
  //       appConfig.showLoadingIndicator = true;
  //       const result = await dataSource.query.studies.sendToCloud(studyId);

  //       console.log('sendToCloud result', result);
  //       if (result.StudyID) {
  //         appConfig.showLoadingIndicator = false;
  //       }
  //     }
  //   } catch (ex) {
  //     // TODO: UI Notification Service
  //     console.warn(ex);
  //   }
  // };
  const saveToServer = async (studyId, studyLabel = '') => {
    const confirmationText =
      'Do you really want to save this study to the server? It may take some time to process your request.';

    if (!confirm(confirmationText)) {
      return;
    }

    setSaveToServerError('');
    setSavingStudyLabel(studyLabel);
    setIsSaveToServerInprogress(true);

    try {
      const result = await dataSource.query.studies.sendToCloud(studyId);
      console.log('Study successfully saved to the server:', result);
      setIsSaveToServerInprogress(false);
      setSavingStudyLabel('');
      // Refresh the list in place. `navigate(0)` used to hard-reload the page
      // here, which tore down the progress banner the moment it appeared.
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    } catch (error) {
      console.error('Error saving the study to the server:', error);
      setIsSaveToServerInprogress(false);
      setSaveToServerError(
        error instanceof Error ? error.message : 'The study could not be saved to the server.'
      );
    }
  };

  const handleShowModal = studyId => {
    setShowStudyInstanceID(studyId);
    setReferralPopup(true);
  };

  const handleCloseModal = () => {
    setReferralPopup(false);
  };

  useEffect(() => {
    document.body.classList.remove('bg-black');
  }, [isActive]);

  // Sync URL query parameters with filters
  useEffect(() => {
    if (!debouncedFilterValues) {
      return;
    }

    const queryString = {};
    Object.keys(defaultFilterValues).forEach(key => {
      const defaultValue = defaultFilterValues[key];
      const currValue = debouncedFilterValues[key];

      // TODO: nesting/recursion?
      if (key === 'studyDate') {
        if (currValue.startDate && defaultValue.startDate !== currValue.startDate) {
          queryString.startDate = currValue.startDate;
        }
        if (currValue.endDate && defaultValue.endDate !== currValue.endDate) {
          queryString.endDate = currValue.endDate;
        }
      } else if (key === 'modalities' && currValue.length) {
        queryString.modalities = currValue.join(',');
      } else if (currValue !== defaultValue) {
        queryString[key] = currValue;
      }
    });

    const search = qs.stringify(queryString, {
      skipNull: true,
      skipEmptyString: true,
    });

    navigate({
      pathname: '/workList',
      search: search ? `?${search}` : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilterValues]);

  // Query for series information
  useEffect(() => {
    const fetchSeries = async studyInstanceUid => {
      try {
        const series = await dataSource.query.series.search(studyInstanceUid);
        seriesInStudiesMap.set(studyInstanceUid, sortBySeriesDate(series));
        setStudiesWithSeriesData([...studiesWithSeriesData, studyInstanceUid]);
      } catch (ex) {
        // TODO: UI Notification Service
        console.warn(ex);
      }
    };

    // TODO: WHY WOULD YOU USE AN INDEX OF 1?!
    // Note: expanded rows index begins at 1
    for (let z = 0; z < expandedRows.length; z++) {
      const expandedRowIndex = expandedRows[z] - 1;
      const studyInstanceUid = sortedStudies[expandedRowIndex].studyInstanceUid;

      if (studiesWithSeriesData.includes(studyInstanceUid)) {
        continue;
      }

      fetchSeries(studyInstanceUid);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedRows, studies]);

  const isFiltering = (filterValues, defaultFilterValues) => {
    return !isEqual(filterValues, defaultFilterValues);
  };

  const handleViewerImage = studyInstanceUid => {
    // setDefaultLoad(true)
    // setloadStudentID(stuID)
    // setIframeImageflag("enableIframeFlag");
    // setIframeWindowflag('iframeEnable');
    // setIframeBlockFlag(false);
    // handleClose();
  };

  const handleEmergency = (event, studyInstanceUid) => {
    fetch(`${hostNameurl}studies/${studyInstanceUid}/metadata/isEmergency`, {
      method: 'GET',
      headers: {
        Authorization: authHeaders,
      },
    })
      .then(response => response.json())
      .then(data => {
        let text = 'Do you want to make this study as Emergency!!!';
        let formData = { data: 'true' };
        if (data.isEmergency !== '') {
          formData = { data: '' };
          text = 'Do you want to Remove Emergency status of this Study?';
        }
        if (confirm(text) == true) {
          event.preventDefault();
          fetch(`${hostNameurl}studies/${studyInstanceUid}/addmetadata/isEmergency`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: authHeaders,
            },
            body: JSON.stringify(formData),
          })
            .then(response => response.json())
            .then(result => {
              window.location.reload();
            })
            .catch(err => {
              console.log(err.message);
            });
        }
      })
      .catch(err => {
        console.log(err.message);
      });
  };

  const closeImageViewer = event => {
    event.preventDefault();

    setIframeImageflag('disableIframeFlag');
    setIframeWindowflag('iframeDisable');
    setIframeBlockFlag(true);
  };

  const clearOldUser = event => {
    localStorage.setItem('fiftyPerFlag', 'false');
    localStorage.setItem('sid', '');
    localStorage.setItem('mdFlag', '');
  };

  const handleIframeInfo = () => {
    setTimeout(() => {
      if (
        document
          .querySelector('iframe')
          .contentWindow.document.getElementsByClassName('mobile-logo') &&
        document
          .querySelector('iframe')
          .contentWindow.document.getElementsByClassName('mobile-logo').length > 0
      ) {
        document
          .querySelector('iframe')
          .contentWindow.document.getElementsByClassName('mobile-logo')[0].style.display = 'none';
        const elementCls = document
          .getElementById('imageViewerId')
          .contentWindow.document.getElementsByClassName('bg-black')[0];

        if (elementCls && isActive) {
          elementCls.classList.remove('bg-black');
          elementCls.classList.add('bg-black-on');
        }
      }
    }, 3000);
    setDefaultLoad(false);
  };
  // Opens a viewer route for one study directly — the row's primary "View"
  // action — with the same session bookkeeping the viewer menu performs.
  const openViewerRoute = (route, sid, modalities, isReportGenerated) => {
    localStorage.setItem('sid', sid);
    localStorage.setItem('mdFlag', modalities);
    localStorage.setItem('ViewerLayoutFlag', 'on');
    storeStidStatus(sid, isReportGenerated);
    navigate(`${route}?StudyInstanceUIDs=${sid}`);
  };

  const menuPaperProps = { className: classnames('wl-pop', isActive && 'wl--dark') };

  const worklistRows: WorklistRow[] = sortedStudies.map(study => {
    const {
      studyInstanceUid,
      modalities,
      instances,
      description,
      mrn,
      patientName,
      date,
      time,
      studyStatus,
      inCloud,
      isEmergency,
      isReportGenerated,
    } = study;
    const aiStudy = { studyInstanceUid, patientName, description, date, time, modalities };
    const aiState = aiPipeline.states[studyInstanceUid] || aiPipeline.getState(studyInstanceUid);
    const emergency = isEmergency === 'true';
    const modalityList = String(modalities || '')
      .split(/[\\/,\s]+/)
      .filter(Boolean);

    const studyDate =
      date &&
      moment(date, ['YYYYMMDD', 'YYYY.MM.DD'], true).isValid() &&
      moment(date, ['YYYYMMDD', 'YYYY.MM.DD']).format('MMM D, YYYY');
    const studyTime =
      time &&
      moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).isValid() &&
      moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).format('hh:mm A');

    return {
      key: studyInstanceUid,
      isEmergency: emergency,
      cells: {
        patientName: (
          <div style={{ minWidth: 0 }}>
            <div className="wl-primary">
              {emergency && <span className="wl-stat">STAT</span>}
              <CopyableText text={patientName} />
            </div>
            {description && (
              <div
                className="wl-secondary wl-truncate"
                title={description}
              >
                {description}
              </div>
            )}
          </div>
        ),
        mrn: (
          <CopyableText
            text={mrn}
            className="wl-mono"
          />
        ),
        studyDate: studyDate ? (
          <div className="wl-tabular">
            <div style={{ color: 'var(--wl-text)' }}>{studyDate}</div>
            {studyTime && <div className="wl-secondary">{studyTime}</div>}
          </div>
        ) : (
          <span className="wl-empty-value">—</span>
        ),
        modalities: modalityList.length ? (
          <div
            className="wl-modalities"
            title={modalities}
          >
            {modalityList.map(modality => (
              <span
                key={modality}
                className="wl-modality"
              >
                {modality}
              </span>
            ))}
          </div>
        ) : (
          <span className="wl-empty-value">—</span>
        ),
        instances: instances ? (
          Number(instances).toLocaleString()
        ) : (
          <span className="wl-empty-value">—</span>
        ),
        status: (
          <div
            className="wl-status"
            data-id={studyInstanceUid}
          >
            <StatusBadge
              label={studyStatus || 'In-Progress'}
              variant={getStatusBadgeVariant(studyStatus || 'In-Progress')}
              isActive={isActive}
              dot
            />
            <AiStatusBadge
              state={aiState}
              isActive={isActive}
              onClick={() => handleOpenAiAnalysis(aiStudy)}
            />
          </div>
        ),
        actions: (
          <StudyRowActions
            canReport={isShowFeature('create_study_report')}
            canSaveToServer={isShowFeature('save_to_server')}
            showSaveToServer={hideOption && inCloud !== 'Yes'}
            canRefer={isShowFeature('refer_study_to_doctor')}
            canMarkEmergency={isShowFeature('make_study_as_emergency')}
            isEmergency={emergency}
            reportMenuOpen={openNew && activeReportMenuStudyId === studyInstanceUid}
            viewerMenuOpen={open && activeViewerMenuStudyId === studyInstanceUid}
            onReport={event =>
              handleClickNew(event, studyInstanceUid, modalities, isReportGenerated)
            }
            onSaveToServer={() =>
              saveToServer(
                studyInstanceUid,
                [patientName, modalities, instances && `${instances} instances`]
                  .filter(Boolean)
                  .join(' · ')
              )
            }
            onRefer={() => handleShowModal(studyInstanceUid)}
            onToggleEmergency={event => handleEmergency(event, studyInstanceUid)}
            onView={() =>
              openViewerRoute('/viewer', studyInstanceUid, modalities, isReportGenerated)
            }
            onOpenViewerMenu={event => handleClick(event, studyInstanceUid, modalities)}
          >
            {mDropDowns && (
              <Menu
                id="basic-menuNew"
                anchorEl={anchorElNew}
                open={openNew && activeReportMenuStudyId === studyInstanceUid}
                onClose={handleCloseNew}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={menuPaperProps}
              >
                {mDropDowns}
              </Menu>
            )}
            <Menu
              id="basic-menu"
              anchorEl={anchorEl}
              open={open && activeViewerMenuStudyId === studyInstanceUid}
              onClose={handleClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={menuPaperProps}
            >
              <MenuItem
                className="wl-menu-ai"
                onClick={() => handleOpenAiAnalysis(aiStudy)}
              >
                <AutoAwesomeIcon />
                AI Report
              </MenuItem>
              <MenuItem onClick={() => handleDocModal(isReportGenerated)}>View Study</MenuItem>
              <MenuItem onClick={() => handleSegmentationModal(isReportGenerated)}>
                Segmentation
              </MenuItem>
              <MenuItem onClick={() => handleTMTVModal(isReportGenerated)}>
                Total Metabolic Tumor Volume
              </MenuItem>
              <MenuItem onClick={() => handleMicroscopyModal(isReportGenerated)}>
                Microscopy
              </MenuItem>
              <MenuItem onClick={() => handleDynamicVolumeModal(isReportGenerated)}>
                4D PT/CT
              </MenuItem>
            </Menu>
          </StudyRowActions>
        ),
      },
    };
  });

  //const hasStudies = numOfStudies > 0 || pageNumber > 0;
  const hasStudies = numOfStudies > 0;
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
    {
      title: t('Header:Preferences'),
      icon: 'settings',
      onClick: () =>
        show({
          title: t('UserPreferencesModal:User Preferences'),
          content: UserPreferences,
          contentProps: {
            hotkeyDefaults: hotkeysManager.getValidHotkeyDefinitions(hotkeyDefaults),
            hotkeyDefinitions,
            onCancel: hide,
            currentLanguage: currentLanguage(),
            availableLanguages,
            defaultLanguage,
            isActive,
            onSubmit: state => {
              if (state.language.value !== currentLanguage().value) {
                i18n.changeLanguage(state.language.value);
              }
              hotkeysManager.setHotkeys(state.hotkeyDefinitions);
              hide();
            },
            onReset: () => hotkeysManager.restoreDefaultBindings(),
            hotkeysModule: !!hotkeys,
          },
        }),
    },
    ...getHeaderMenuOptions({
      t,
      isActive,
      handleChangeSwitch,
      navigate,
      appConfig,
      currentPath: '/workList',
      onProfileClick: handleOpenSubscriptionModal,
    }),
  ];

  const { customizationService } = servicesManager.services;
  const { component: dicomUploadComponent } =
    customizationService.get('dicomUploadComponent') ?? {};
  const uploadProps =
    dicomUploadComponent && dataSource.getConfig()?.dicomUploadEnabled
      ? {
          title: 'Upload files',
          closeButton: true,
          shouldCloseOnEsc: false,
          shouldCloseOnOverlayClick: false,
          content: dicomUploadComponent.bind(null, {
            dataSource,
            onComplete: () => {
              hide();
              onRefresh();
            },
            onStarted: () => {
              show({
                ...uploadProps,
                // when upload starts, hide the default close button as closing the dialogue must be handled by the upload dialogue itself
                closeButton: false,
              });
            },
          }),
        }
      : undefined;

  const displayedSort = { ...filterValues, ...defaultSortValues };
  // Sorting is client-side, so it is only offered while the whole result set is loaded.
  const isSortingEnabled = numOfStudies > 0 && numOfStudies <= 100;
  const handleSort = name => {
    let direction = 'descending';
    if (displayedSort.sortBy === name) {
      direction = displayedSort.sortDirection === 'ascending' ? 'descending' : 'ascending';
    }
    setFilterValues({ ...filterValues, sortBy: name, sortDirection: direction });
  };
  const activeFilters = getActiveFilters(filterValues, defaultFilterValues);
  const modalityOptions =
    filtersMeta.find(meta => meta.name === 'modalities')?.inputProps?.options || [];

  const { component: dataSourceConfigurationComponent } =
    customizationService.get('ohif.dataSourceConfigurationComponent') ?? {};

  return (
    <div
      className={
        isActive
          ? 'bg-surface-canvasDark trad-bg-black flex h-screen flex-col'
          : 'trad-bg-black bg-surface-canvas flex h-screen flex-col'
      }
    >
      <Header
        isSticky
        menuOptions={menuOptions}
        isReturnEnabled={false}
        WhiteLabeling={appConfig.whiteLabeling}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        screen={iframeBlockFlag ? 'WorkList' : 'Viewer'}
        handleRedirectPage={handleRedirectPage}
        iframeBlockFlag={iframeBlockFlag}
      />

      {referralPopup && (
        <GenerateReferral
          open={referralPopup}
          handleClose={handleCloseModal}
          StudyInstanceUId={showStudyInstanceId}
        />
      )}
      {subscriptionFeatures && userInfoData && (
        <SubscriptionFeaturesModal
          open={isSubscriptionModalOpen}
          handleClose={handleCloseSubscriptionModal}
          userRolesInfo={userInfoData}
          subscriptionFeaturesInfo={subscriptionFeatures}
          isActive={isActive}
        />
      )}
      {aiAnalysisStudy && (
        <AiAnalysisDialog
          open={!!aiAnalysisStudy}
          onClose={handleCloseAiAnalysis}
          study={aiAnalysisStudy}
          aiState={aiPipeline.getState(aiAnalysisStudy.studyInstanceUid)}
          onGenerateReport={() => aiPipeline.generateReport(aiAnalysisStudy.studyInstanceUid)}
          loadResult={options =>
            aiPipeline.loadReportResult(aiAnalysisStudy.studyInstanceUid, options)
          }
          loadFrameImages={instanceId =>
            aiPipeline.loadFrameImages(aiAnalysisStudy.studyInstanceUid, instanceId)
          }
        />
      )}

      <main
        className={classnames(
          'wl',
          isActive ? 'wl--dark ohif-scrollbar_darkMode' : 'ohif-scrollbar',
          iframeImageflag
        )}
      >
        <section
          className="wl-card"
          aria-labelledby="StudyList"
        >
          <WorklistToolbar
            numOfStudies={pageNumber * resultsPerPage > 100 ? 101 : numOfStudies}
            activeFilters={activeFilters}
            onClearFilter={name =>
              setFilterValues({ ...filterValues, [name]: defaultFilterValues[name] })
            }
            onClearAll={() => setFilterValues(defaultFilterValues)}
            onUploadClick={uploadProps ? () => show(uploadProps) : undefined}
            dataSourceControl={
              dataSourceConfigurationComponent ? dataSourceConfigurationComponent() : undefined
            }
          />

          {(isSaveToServerInprogress || saveToServerError) && (
            <div className="wl-banner">
              {isSaveToServerInprogress ? (
                <ProgressBanner
                  isActive={isActive}
                  title="Saving study to server"
                  statusLabel="In progress"
                  description={
                    savingStudyLabel
                      ? `${savingStudyLabel} — this can take a few minutes. The list refreshes automatically when it finishes.`
                      : 'This can take a few minutes. The list refreshes automatically when it finishes.'
                  }
                />
              ) : (
                <ProgressBanner
                  isActive={isActive}
                  variant="error"
                  title="Could not save the study to the server"
                  statusLabel="Failed"
                  description={`${
                    savingStudyLabel ? `${savingStudyLabel} — ` : ''
                  }${saveToServerError} Nothing was changed; you can try again.`}
                  onDismiss={() => {
                    setSaveToServerError('');
                    setSavingStudyLabel('');
                  }}
                />
              )}
            </div>
          )}

          <WorklistTable
            rows={hasStudies ? worklistRows : []}
            isDark={isActive}
            isLoading={isLoadingData}
            isQuerying={querying}
            filterValues={filterValues}
            modalityOptions={modalityOptions}
            onFilterChange={(name, value) => setFilterValues({ ...filterValues, [name]: value })}
            sortBy={displayedSort.sortBy}
            sortDirection={displayedSort.sortDirection}
            isSortingEnabled={isSortingEnabled}
            onSort={handleSort}
            emptyState={
              <>
                <h2>
                  {isFiltering(filterValues, defaultFilterValues)
                    ? 'No studies match these filters'
                    : 'No studies yet'}
                </h2>
                <p>
                  {isFiltering(filterValues, defaultFilterValues)
                    ? 'Try a wider date range or remove a filter.'
                    : 'Studies appear here as soon as they are received or uploaded.'}
                </p>
                <div className="wl-empty-actions">
                  {isFiltering(filterValues, defaultFilterValues) && (
                    <button
                      type="button"
                      className="wl-btn"
                      onClick={() => setFilterValues(defaultFilterValues)}
                    >
                      {t('StudyList:ClearFilters')}
                    </button>
                  )}
                  {uploadProps && (
                    <button
                      type="button"
                      className="wl-btn wl-btn--primary"
                      onClick={() => show(uploadProps)}
                    >
                      Upload studies
                    </button>
                  )}
                </div>
              </>
            }
          />

          {numOfStudies > 100 && (
            <div className="wl-notice">{t('StudyList:NumOfStudiesHiggerThan100Message')}</div>
          )}

          {(hasStudies || pageNumber > 1) && (
            <WorklistPagination
              currentPage={pageNumber}
              perPage={resultsPerPage}
              numOfStudies={numOfStudies}
              onChangePage={onPageNumberChange}
              onChangePerPage={onResultsPerPageChange}
            />
          )}
        </section>
      </main>
    </div>
  );
}

WorkList.propTypes = {
  data: PropTypes.array.isRequired,
  dataSource: PropTypes.shape({
    query: PropTypes.object.isRequired,
    getConfig: PropTypes.func,
  }).isRequired,
  isLoadingData: PropTypes.bool.isRequired,
  servicesManager: PropTypes.instanceOf(ServicesManager),
};

const defaultFilterValues = {
  patientName: '',
  mrn: '',
  studyDate: {
    startDate: null,
    endDate: null,
  },
  description: '',
  modalities: [],
  // accession: '',
  sortBy: '',
  sortDirection: 'none',
  pageNumber: 1,
  resultsPerPage: 25,
  datasources: '',
  configUrl: null,
};

function _tryParseInt(str, defaultValue) {
  let retValue = defaultValue;
  if (str && str.length > 0) {
    if (!isNaN(str)) {
      retValue = parseInt(str);
    }
  }
  return retValue;
}

function _getQueryFilterValues(params) {
  const queryFilterValues = {
    patientName: params.get('patientname'),
    mrn: params.get('mrn'),
    studyDate: {
      startDate: params.get('startdate') || null,
      endDate: params.get('enddate') || null,
    },
    description: params.get('description'),
    modalities: params.get('modalities') ? params.get('modalities').split(',') : [],
    // accession: params.get('accession'),
    sortBy: params.get('sortby'),
    sortDirection: params.get('sortdirection'),
    pageNumber: _tryParseInt(params.get('pagenumber'), undefined),
    resultsPerPage: _tryParseInt(params.get('resultsperpage'), undefined),
    datasources: params.get('datasources'),
    configUrl: params.get('configurl'),
  };

  // Delete null/undefined keys
  Object.keys(queryFilterValues).forEach(
    key => queryFilterValues[key] == null && delete queryFilterValues[key]
  );

  return queryFilterValues;
}

function _sortStringDates(s1, s2, sortModifier) {
  // TODO: Delimiters are non-standard. Should we support them?
  const s1Date = moment(s1.date, ['YYYYMMDD', 'YYYY.MM.DD'], true);
  const s2Date = moment(s2.date, ['YYYYMMDD', 'YYYY.MM.DD'], true);

  if (s1Date.isValid() && s2Date.isValid()) {
    return (s1Date.toISOString() > s2Date.toISOString() ? 1 : -1) * sortModifier;
  } else if (s1Date.isValid()) {
    return sortModifier;
  } else if (s2Date.isValid()) {
    return -1 * sortModifier;
  }
}

export default WorkList;
