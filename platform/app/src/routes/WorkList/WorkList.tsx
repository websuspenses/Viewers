import React, { useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import PropTypes, { element, func } from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import moment from 'moment';
import qs from 'query-string';
import isEqual from 'lodash.isequal';
import { useTranslation } from 'react-i18next';
import filtersMeta from './filtersMeta.js';
import { useAppConfig } from '@state';
import { useDebounce, useSearchParams } from '@hooks';
import { utils, hotkeys, ServicesManager } from '@ohif/core';
// import '../../style.css';
import DoDisturbIcon from '@mui/icons-material/DoDisturb';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
const dotenv = require('dotenv');
import SubscriptionFeaturesModal from '../../components/AdminPanel/SubscriptionFeaturesModal';

import {
  Icon,
  StudyListExpandedRow,
  LegacyButton,
  EmptyStudies,
  StudyListTable,
  StudyListPagination,
  StudyListFilter,
  TooltipClipboard,
  Header,
  useModal,
  AboutModal,
  UserPreferences,
  LoadingIndicatorProgress,
} from '@ohif/ui';

import i18n from '@ohif/i18n';
import GenerateReferral from '../../components/DoctorReferrals/GenerateReferral';

const { sortBySeriesDate } = utils;

const { availableLanguages, defaultLanguage, currentLanguage } = i18n;

const seriesInStudiesMap = new Map();
//var defaultLoad = true;

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

  const [rolesInfo, setRolesData] = useState(); // State to store fetched data
  const [authHeaders, setAuthHeaders] = useState('');

  const [userInfoData, setUserInfoResult] = useState({});
  const [isSaveToServerInprogress, setIsSaveToServerInprogress] = useState(false);

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
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>, sid: any, mdFlag: any) => {
    event.preventDefault();
    setStuID(sid);
    setAnchorEl(event.currentTarget);
    setModalityFlag(mdFlag);
    localStorage.setItem('sid', sid);
    localStorage.setItem('mdFlag', mdFlag);
    localStorage.setItem('ViewerLayoutFlag', 'on');
  };
  const handleClose = () => {
    setAnchorEl(null);
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
  const openNew = Boolean(anchorElNew);
  const handleClickNew = (
    event: React.MouseEvent<HTMLButtonElement>,
    sid: any,
    mdFlag: any,
    isReportGenerated
  ) => {
    event.preventDefault();
    setStuID(sid);
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
  const saveToServer = async studyId => {
    try {
      const confirmationText =
        'Do you really want to save this study to the server? It may take some time to process your request.';
      if (confirm(confirmationText)) {
        setIsSaveToServerInprogress(true);
        // Call the sendToCloud function
        const result = await dataSource.query.studies.sendToCloud(studyId);

        isLoadingData = true;
        if (result && result.StudyID) {
          console.log('Study successfully saved to the server:', result);
          setIsSaveToServerInprogress(false);
          // Optionally, show a success notification
          alert('Study successfully saved to the server.');
          navigate(0);
        } else {
          console.error('Failed to save the study:', result);
          setIsSaveToServerInprogress(false);
          navigate(0);
        }
      }
    } catch (error) {
      // Handle any errors that occur during the process
      console.error('Error saving the study to the server:', error);
      setIsSaveToServerInprogress(false);
      alert('An error occurred while saving the study. Please try again.');
      navigate(0);
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
  const tableDataSource = sortedStudies.map((study, key) => {
    const rowKey = key + 1;
    const isExpanded = expandedRows.some(k => k === rowKey);
    const {
      studyInstanceUid,
      // accession,
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
      isReferralSent,
      isReportGenerated,
    } = study;

    const studyDate =
      date &&
      moment(date, ['YYYYMMDD', 'YYYY.MM.DD'], true).isValid() &&
      moment(date, ['YYYYMMDD', 'YYYY.MM.DD']).format('MMM-DD-YYYY');
    const studyTime =
      time &&
      moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).isValid() &&
      moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).format('hh:mm A');

    return {
      row: [
        {
          key: 'patientName',
          content: patientName ? (
            <div className={isEmergency == 'true' ? 'show-emergency' : ''}>
              <span className="emergency-placeholder"></span>
              <TooltipClipboard ActiveMode={isActive}>{patientName}</TooltipClipboard>
              <br />
              <span className="extra-padding">
                <TooltipClipboard ActiveMode={isActive}>{description}</TooltipClipboard>
              </span>
            </div>
          ) : (
            <span className="text-gray-700">(Empty)</span>
          ),
          gridCol: 5,
        },
        {
          key: 'mrn',
          content: <TooltipClipboard ActiveMode={isActive}>{mrn}</TooltipClipboard>,
          gridCol: 2,
        },
        {
          key: 'studyDate',
          content: (
            <>
              {studyDate && <span className="mr-4">{studyDate}</span>}
              {studyTime && <span>{studyTime}</span>}
            </>
          ),
          title: `${studyDate || ''} ${studyTime || ''}`,
          gridCol: 4,
        },
        // {
        //   key: 'description',
        //   content: <TooltipClipboard ActiveMode={isActive}>{description}</TooltipClipboard>,
        //   gridCol: 3,
        // },
        {
          key: 'modality',
          content: modalities,
          title: modalities,
          gridCol: 2,
        },
        // {
        //   key: 'accession',
        //   content: <TooltipClipboard ActiveMode={isActive}>{accession}</TooltipClipboard>,
        //   gridCol: 3,
        // },
        {
          key: 'instances',
          content: (
            <>
              <Icon
                name="group-layers"
                className={
                  isActive
                    ? classnames('instances-svg mr-2 inline-flex w-4', {
                        'copyIcon-expandDarkCls': isExpanded,
                        'copyIcon-darkModeCls': !isExpanded,
                      })
                    : classnames('instances-svg mr-2 inline-flex w-4', {
                        'text-primary-active': isExpanded,
                        'text-secondary-light': !isExpanded,
                      })
                }
              />
              {instances}
            </>
          ),
          title: (instances || 0).toString(),
          gridCol: 2,
        },
        {
          key: 'status',
          title: 'In-Progress',
          content: studyStatus ? (
            <span
              data-id={studyInstanceUid}
              className={'common' + studyStatus}
            >
              {studyStatus}
            </span>
          ) : (
            <span className={'commonIn-Progress'}>{'In-Progress'}</span>
          ),
          gridCol: 4,
        },
        {
          key: 'actions',
          title: '',
          content: (
            <div className="actions-container">
              {isShowFeature('create_study_report') && (
                <>
                  <span
                    id="basic-buttonNew"
                    aria-controls={openNew ? 'basic-menuNew' : undefined}
                    aria-haspopup="true"
                    aria-expanded={openNew ? 'true' : undefined}
                    onClick={event =>
                      handleClickNew(event, studyInstanceUid, modalities, isReportGenerated)
                    }
                  >
                    {
                      <svg
                        fill="#0a7c6c"
                        version="1.1"
                        id="Capa_1"
                        width="35px"
                        height="30px"
                        className="svg-icon"
                        viewBox="0 0 1024 1024"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M948.735317 609.719602c-3.562129 3.63376-6.732331 6.949272-9.549493 10.144034-2.837628 3.189645-5.335519 5.857405-7.451716 7.998161-2.842745 2.886747-5.310959 4.984524-7.4159 6.383384l-90.278119-89.465614c4.238534-3.586688 9.003048-7.831362 14.314007-12.772908 5.310959-5.02341 9.729595-8.915044 13.294794-11.753695 8.481162-7.828292 17.683754-11.149944 27.608801-10.145058 9.886161 1.091868 18.035772 3.409656 24.420179 6.950296 7.081279 3.585665 14.688537 9.79304 22.843264 18.632359 8.128121 8.919137 14.344706 18.277272 18.563798 28.29544 2.13564 5.640464 3.560082 12.768815 4.281513 21.293979C960.057177 593.762165 956.500165 601.979314 948.735317 609.719602L948.735317 609.719602 948.735317 609.719602 948.735317 609.719602zM785.153682 772.752746l-73.275887 73.487711c-9.925047 9.925047-18.23327 18.494213-24.965601 25.575492-6.730285 7.0383-10.446933 10.969842-11.169387 11.670807-3.520173 2.843768-7.407714 5.858428-11.6749 9.096169-4.219091 3.140527-8.503675 5.858428-12.744255 7.954159-4.241604 2.14178-10.778484 4.765537-19.62599 8.042163-8.858762 3.189645-17.884322 6.164397-27.087938 9.008164-9.202593 2.843768-18.059308 5.336542-26.560936 7.433296-8.481162 2.185782-14.872732 3.584642-19.10308 4.282536-8.53028 1.449002-14.192234 0.357134-17.011442-3.184529-2.838651-3.550873-3.541663-9.583263-2.119267-18.10331 0.719384-4.282536 2.119267-10.671037 4.241604-19.152199 2.140757-8.56405 4.614088-17.270339 7.456832-26.098401 2.816139-8.92016 5.462408-17.269315 7.973602-25.096585 2.452865-7.780197 4.41659-13.114692 5.79396-15.914458 4.28663-9.267061 9.945513-17.397229 17.011442-24.52251l13.836123-13.860682 26.5374-26.625404c10.627035-10.671037 22.297842-22.556739 35.042097-35.675524 12.743232-13.114692 25.484418-26.097378 38.2123-38.865169 30.472012-30.5549 64.817238-64.660672 103.054097-102.258988l89.185228 89.451288L785.153682 772.752746 785.153682 772.752746 785.153682 772.752746zM696.507736 219.197304c0-14.559601-11.799744-26.361391-26.338878-26.361391l-52.702316 0 0-52.682873 105.409748 0c14.539134 0 26.340925 11.758812 26.340925 26.360368l0 358.368994-52.709479 57.993832L696.507736 219.197304 696.507736 219.197304 696.507736 219.197304 696.507736 219.197304zM564.753993 245.557672l-26.361391 0c-14.538111 0-26.340925-11.80179-26.340925-26.360368L512.051677 113.787556c0-14.557554 11.802814-26.360368 26.340925-26.360368l26.361391 0c14.539134 0 26.346041 11.802814 26.346041 26.360368l0 105.409748C591.100034 233.754858 579.293127 245.557672 564.753993 245.557672L564.753993 245.557672 564.753993 245.557672zM327.577199 140.15304l158.113087 0 0 52.682873L327.577199 192.835913 327.577199 140.15304 327.577199 140.15304zM274.869766 245.557672l-26.340925 0c-14.557554 0-26.365484-11.80179-26.365484-26.360368L222.163357 113.787556c0-14.557554 11.80793-26.360368 26.365484-26.360368l26.340925 0c14.539134 0 26.367531 11.802814 26.367531 26.360368l0 105.409748C301.236274 233.754858 289.408901 245.557672 274.869766 245.557672L274.869766 245.557672 274.869766 245.557672zM116.753609 219.197304l0 579.784826c0 14.558577 11.80793 26.361391 26.365484 26.361391l332.979744 0-47.920406 52.68185L90.389148 878.025371c-14.535041 0-26.341948-11.757788-26.341948-26.317389L64.0472 166.513408c0-14.602579 11.80793-26.360368 26.341948-26.360368l105.433284 0 0 52.682873-52.702316 0C128.556423 192.835913 116.753609 204.637704 116.753609 219.197304L116.753609 219.197304 116.753609 219.197304 116.753609 219.197304zM617.465518 654.048203c0 7.262404-5.9055 13.162788-13.183254 13.162788L208.98522 667.210991c-7.281847 0-13.163811-5.901407-13.163811-13.162788l0-26.356274c0-7.306406 5.881964-13.162788 13.163811-13.162788l395.297045 0c7.27673 0 13.183254 5.857405 13.183254 13.162788L617.465518 654.048203 617.465518 654.048203zM604.283288 456.376145 208.98522 456.376145c-7.281847 0-13.163811-5.9055-13.163811-13.163811l0-26.360368c0-7.300266 5.881964-13.158694 13.163811-13.158694l395.297045 0c7.27673 0 13.183254 5.858428 13.183254 13.158694l0 26.360368C617.465518 450.470645 611.560018 456.376145 604.283288 456.376145L604.283288 456.376145 604.283288 456.376145 604.283288 456.376145zM604.283288 456.376145" />
                      </svg>
                    }
                    {/* </Link> */}
                  </span>
                  {mDropDowns && (
                    <Menu
                      id="basic-menuNew"
                      anchorEl={anchorElNew}
                      open={openNew}
                      onClose={handleCloseNew}
                      MenuListProps={{
                        'aria-labelledby': 'basic-buttonNew',
                      }}
                    >
                      {mDropDowns}
                    </Menu>
                  )}
                </>
              )}
              {!isShowFeature('create_study_report') && (
                <>
                  <span
                    id="basic-buttonNew"
                    className="disabled-link"
                    title="You do not have access"
                  >
                    {
                      <svg
                        fill="#0a7c6c"
                        version="1.1"
                        id="Capa_1"
                        width="35px"
                        height="30px"
                        className="svg-icon"
                        viewBox="0 0 1024 1024"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M948.735317 609.719602c-3.562129 3.63376-6.732331 6.949272-9.549493 10.144034-2.837628 3.189645-5.335519 5.857405-7.451716 7.998161-2.842745 2.886747-5.310959 4.984524-7.4159 6.383384l-90.278119-89.465614c4.238534-3.586688 9.003048-7.831362 14.314007-12.772908 5.310959-5.02341 9.729595-8.915044 13.294794-11.753695 8.481162-7.828292 17.683754-11.149944 27.608801-10.145058 9.886161 1.091868 18.035772 3.409656 24.420179 6.950296 7.081279 3.585665 14.688537 9.79304 22.843264 18.632359 8.128121 8.919137 14.344706 18.277272 18.563798 28.29544 2.13564 5.640464 3.560082 12.768815 4.281513 21.293979C960.057177 593.762165 956.500165 601.979314 948.735317 609.719602L948.735317 609.719602 948.735317 609.719602 948.735317 609.719602zM785.153682 772.752746l-73.275887 73.487711c-9.925047 9.925047-18.23327 18.494213-24.965601 25.575492-6.730285 7.0383-10.446933 10.969842-11.169387 11.670807-3.520173 2.843768-7.407714 5.858428-11.6749 9.096169-4.219091 3.140527-8.503675 5.858428-12.744255 7.954159-4.241604 2.14178-10.778484 4.765537-19.62599 8.042163-8.858762 3.189645-17.884322 6.164397-27.087938 9.008164-9.202593 2.843768-18.059308 5.336542-26.560936 7.433296-8.481162 2.185782-14.872732 3.584642-19.10308 4.282536-8.53028 1.449002-14.192234 0.357134-17.011442-3.184529-2.838651-3.550873-3.541663-9.583263-2.119267-18.10331 0.719384-4.282536 2.119267-10.671037 4.241604-19.152199 2.140757-8.56405 4.614088-17.270339 7.456832-26.098401 2.816139-8.92016 5.462408-17.269315 7.973602-25.096585 2.452865-7.780197 4.41659-13.114692 5.79396-15.914458 4.28663-9.267061 9.945513-17.397229 17.011442-24.52251l13.836123-13.860682 26.5374-26.625404c10.627035-10.671037 22.297842-22.556739 35.042097-35.675524 12.743232-13.114692 25.484418-26.097378 38.2123-38.865169 30.472012-30.5549 64.817238-64.660672 103.054097-102.258988l89.185228 89.451288L785.153682 772.752746 785.153682 772.752746 785.153682 772.752746zM696.507736 219.197304c0-14.559601-11.799744-26.361391-26.338878-26.361391l-52.702316 0 0-52.682873 105.409748 0c14.539134 0 26.340925 11.758812 26.340925 26.360368l0 358.368994-52.709479 57.993832L696.507736 219.197304 696.507736 219.197304 696.507736 219.197304 696.507736 219.197304zM564.753993 245.557672l-26.361391 0c-14.538111 0-26.340925-11.80179-26.340925-26.360368L512.051677 113.787556c0-14.557554 11.802814-26.360368 26.340925-26.360368l26.361391 0c14.539134 0 26.346041 11.802814 26.346041 26.360368l0 105.409748C591.100034 233.754858 579.293127 245.557672 564.753993 245.557672L564.753993 245.557672 564.753993 245.557672zM327.577199 140.15304l158.113087 0 0 52.682873L327.577199 192.835913 327.577199 140.15304 327.577199 140.15304zM274.869766 245.557672l-26.340925 0c-14.557554 0-26.365484-11.80179-26.365484-26.360368L222.163357 113.787556c0-14.557554 11.80793-26.360368 26.365484-26.360368l26.340925 0c14.539134 0 26.367531 11.802814 26.367531 26.360368l0 105.409748C301.236274 233.754858 289.408901 245.557672 274.869766 245.557672L274.869766 245.557672 274.869766 245.557672zM116.753609 219.197304l0 579.784826c0 14.558577 11.80793 26.361391 26.365484 26.361391l332.979744 0-47.920406 52.68185L90.389148 878.025371c-14.535041 0-26.341948-11.757788-26.341948-26.317389L64.0472 166.513408c0-14.602579 11.80793-26.360368 26.341948-26.360368l105.433284 0 0 52.682873-52.702316 0C128.556423 192.835913 116.753609 204.637704 116.753609 219.197304L116.753609 219.197304 116.753609 219.197304 116.753609 219.197304zM617.465518 654.048203c0 7.262404-5.9055 13.162788-13.183254 13.162788L208.98522 667.210991c-7.281847 0-13.163811-5.901407-13.163811-13.162788l0-26.356274c0-7.306406 5.881964-13.162788 13.163811-13.162788l395.297045 0c7.27673 0 13.183254 5.857405 13.183254 13.162788L617.465518 654.048203 617.465518 654.048203zM604.283288 456.376145 208.98522 456.376145c-7.281847 0-13.163811-5.9055-13.163811-13.163811l0-26.360368c0-7.300266 5.881964-13.158694 13.163811-13.158694l395.297045 0c7.27673 0 13.183254 5.858428 13.183254 13.158694l0 26.360368C617.465518 450.470645 611.560018 456.376145 604.283288 456.376145L604.283288 456.376145 604.283288 456.376145 604.283288 456.376145zM604.283288 456.376145" />
                      </svg>
                    }
                  </span>
                </>
              )}
              {hideOption && inCloud !== 'Yes' && isShowFeature('save_to_server') && (
                <Link
                  title="Save to Server"
                  to=""
                >
                  <svg
                    onClick={() => saveToServer(studyInstanceUid)}
                    xmlns="http://www.w3.org/2000/svg"
                    version="1.1"
                    viewBox="-5.0 -10.0 110.0 135.0"
                    fill="#0a7c6c"
                    id="Capa_1"
                    width="35px"
                    height="30px"
                  >
                    <path d="M88.03,50c1.17-2.81,1.76-5.77,1.76-8.81c0-12.77-10.39-23.16-23.16-23.16c-7.73,0-14.99,3.93-19.27,10.34  c-2.12-0.9-4.37-1.36-6.69-1.36c-7.56,0-14.13,4.88-16.37,12C12.77,39.37,3.5,48.87,3.5,60.48c0,11.85,9.64,21.49,21.49,21.49h15.16  c0.83,0,1.5-0.67,1.5-1.5s-0.67-1.5-1.5-1.5H24.99c-10.19,0-18.49-8.29-18.49-18.49C6.5,50.29,14.79,42,24.99,42  c0.05,0,0.1,0,0.14,0.01c0.09,0.01,0.18,0.01,0.27,0.01l1.21,0.03l0.28-1.18c1.54-6.4,7.2-10.86,13.78-10.86  c2.3,0,4.51,0.54,6.56,1.62l1.27,0.66l0.72-1.24c3.61-6.18,10.28-10.03,17.41-10.03c11.12,0,20.16,9.04,20.16,20.16  c0,3.06-0.69,6.02-2.05,8.81l-0.66,1.36l1.36,0.65c4.97,2.39,8.06,7.29,8.06,12.78c0,7.82-6.36,14.19-14.19,14.19H51.5V48.19  l8.16,14.14c0.28,0.48,0.78,0.75,1.3,0.75c0.25,0,0.51-0.06,0.75-0.2c0.72-0.41,0.96-1.33,0.55-2.05L51.3,41.84  c-0.01-0.01-0.02-0.02-0.02-0.03c-0.06-0.1-0.13-0.2-0.22-0.28c0,0,0,0,0,0c-0.08-0.08-0.18-0.15-0.27-0.21  c-0.03-0.02-0.06-0.03-0.09-0.05c-0.08-0.04-0.16-0.07-0.24-0.1c-0.03-0.01-0.06-0.02-0.09-0.03c-0.12-0.03-0.23-0.05-0.36-0.05  s-0.24,0.02-0.36,0.05c-0.03,0.01-0.06,0.02-0.09,0.03c-0.08,0.03-0.17,0.06-0.24,0.1c-0.03,0.02-0.06,0.03-0.09,0.05  c-0.1,0.06-0.19,0.13-0.27,0.21c0,0,0,0,0,0c-0.08,0.08-0.15,0.18-0.22,0.28c-0.01,0.01-0.02,0.02-0.02,0.03L37.74,60.83  c-0.41,0.72-0.17,1.63,0.55,2.05c0.72,0.42,1.63,0.17,2.05-0.55l8.16-14.14v32.28c0,0.83,0.67,1.5,1.5,1.5h29.31  c9.48,0,17.19-7.71,17.19-17.19C96.5,58.72,93.22,53.07,88.03,50z" />
                  </svg>
                </Link>
              )}
              {hideOption && inCloud !== 'Yes' && !isShowFeature('save_to_server') && (
                <Link
                  className="disabled-link"
                  title="You do not have access"
                  to=""
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    version="1.1"
                    viewBox="-5.0 -10.0 110.0 135.0"
                    fill="#0a7c6c"
                    id="Capa_1"
                    width="35px"
                    height="30px"
                  >
                    <path d="M88.03,50c1.17-2.81,1.76-5.77,1.76-8.81c0-12.77-10.39-23.16-23.16-23.16c-7.73,0-14.99,3.93-19.27,10.34  c-2.12-0.9-4.37-1.36-6.69-1.36c-7.56,0-14.13,4.88-16.37,12C12.77,39.37,3.5,48.87,3.5,60.48c0,11.85,9.64,21.49,21.49,21.49h15.16  c0.83,0,1.5-0.67,1.5-1.5s-0.67-1.5-1.5-1.5H24.99c-10.19,0-18.49-8.29-18.49-18.49C6.5,50.29,14.79,42,24.99,42  c0.05,0,0.1,0,0.14,0.01c0.09,0.01,0.18,0.01,0.27,0.01l1.21,0.03l0.28-1.18c1.54-6.4,7.2-10.86,13.78-10.86  c2.3,0,4.51,0.54,6.56,1.62l1.27,0.66l0.72-1.24c3.61-6.18,10.28-10.03,17.41-10.03c11.12,0,20.16,9.04,20.16,20.16  c0,3.06-0.69,6.02-2.05,8.81l-0.66,1.36l1.36,0.65c4.97,2.39,8.06,7.29,8.06,12.78c0,7.82-6.36,14.19-14.19,14.19H51.5V48.19  l8.16,14.14c0.28,0.48,0.78,0.75,1.3,0.75c0.25,0,0.51-0.06,0.75-0.2c0.72-0.41,0.96-1.33,0.55-2.05L51.3,41.84  c-0.01-0.01-0.02-0.02-0.02-0.03c-0.06-0.1-0.13-0.2-0.22-0.28c0,0,0,0,0,0c-0.08-0.08-0.18-0.15-0.27-0.21  c-0.03-0.02-0.06-0.03-0.09-0.05c-0.08-0.04-0.16-0.07-0.24-0.1c-0.03-0.01-0.06-0.02-0.09-0.03c-0.12-0.03-0.23-0.05-0.36-0.05  s-0.24,0.02-0.36,0.05c-0.03,0.01-0.06,0.02-0.09,0.03c-0.08,0.03-0.17,0.06-0.24,0.1c-0.03,0.02-0.06,0.03-0.09,0.05  c-0.1,0.06-0.19,0.13-0.27,0.21c0,0,0,0,0,0c-0.08,0.08-0.15,0.18-0.22,0.28c-0.01,0.01-0.02,0.02-0.02,0.03L37.74,60.83  c-0.41,0.72-0.17,1.63,0.55,2.05c0.72,0.42,1.63,0.17,2.05-0.55l8.16-14.14v32.28c0,0.83,0.67,1.5,1.5,1.5h29.31  c9.48,0,17.19-7.71,17.19-17.19C96.5,58.72,93.22,53.07,88.03,50z" />
                  </svg>
                </Link>
              )}
              {isShowFeature('refer_study_to_doctor') && (
                <Link
                  title="Refer"
                  to=""
                >
                  <svg
                    onClick={() => handleShowModal(studyInstanceUid)}
                    xmlns="http://www.w3.org/2000/svg"
                    version="1.1"
                    viewBox="-5.0 -10.0 110.0 135.0"
                    fill="#0a7c6c"
                    id="Capa_1"
                    width="35px"
                    height="30px"
                  >
                    <g>
                      <path d="m6.8789 80.059v5.3203 0.33984l0.019532 0.55859c0.011718 0.37109 0.089843 0.75 0.14062 1.1211 0.16016 0.73047 0.37891 1.4609 0.73047 2.1289 0.64844 1.3594 1.6797 2.5117 2.9102 3.3711 1.2383 0.83984 2.7109 1.3711 4.2109 1.4883 0.87891 0.050781 1.1289 0.019531 1.6211 0.03125h1.3281 5.3203 10.641c4.6719-0.019531 11.602 0.96875 11.898-2.7109 0.32031-3.9805-6.9297-2.8594-11.371-2.9102l-10.41-0.089844-5.1992-0.03125h-2.6016c-0.19141-0.011719-0.48828 0-0.60156-0.019531-0.12891 0-0.25 0-0.37109-0.039062-0.25-0.03125-0.48047-0.12109-0.71094-0.19922-0.91016-0.39844-1.6094-1.2812-1.7383-2.2617-0.050781-0.23828-0.039062-0.44922-0.039062-0.96094v-1.3008-2.6016-2.6016c0-0.92969 0.011719-1.5508 0.10938-2.3203 0.17969-1.4688 0.64062-2.8984 1.3086-4.2188 0.67188-1.3203 1.5781-2.5195 2.6602-3.5391 1.2188-1.1406 2.4883-2.25 3.8008-3.3086 2.6094-2.1094 5.3906-4.0195 8.2891-5.6992 1.4492-0.82812 2.9414-1.6016 4.4492-2.3086 0.76172-0.32812 1.5195-0.69141 2.3008-0.98828l1.2812-0.51953c0.66016-0.30078 1.2812-0.73047 1.7812-1.3008 0.5-0.57031 0.89062-1.2695 1.0781-2.0312 0.10156-0.37891 0.14844-0.76953 0.14844-1.1602v-0.35156c0-0.078124 0-0.35156-0.019531-0.51172-0.070312-0.76172-0.30078-1.5-0.71094-2.1719-0.21094-0.33984-0.46094-0.64844-0.76172-0.94141-0.14844-0.14062-0.30859-0.28125-0.48828-0.39844l-0.30859-0.21875c-1.3008-0.87891-2.5-1.8984-3.5586-3.0586-4.2812-4.6016-6.1719-11.27-4.9102-17.398 1.1719-6.1211 5.3984-11.578 11.02-14.129 2.7812-1.3008 5.8516-1.9492 8.8984-1.8594 1.5312 0.058594 3.0117 0.32031 4.4609 0.69141 1.4297 0.46094 2.8516 0.98047 4.1406 1.75 2.6211 1.4609 4.8711 3.5508 6.5117 6.0195 1.6602 2.4414 2.7383 5.2305 3.0391 8.0703 0.039063 0.32813 0.078125 0.67188 0.12109 1.0117 0 0.35156 0.011719 0.69922 0.019531 1.0586 0.039063 0.71094 0.011719 1.4492-0.03125 2.1797-0.078125 1.4688-0.28125 2.8984-0.41016 4.2109-0.25 2.6016-0.35938 4.8984 1.8398 6.1289 1.7695 0.98828 3.9805-0.75 5.3594-4.0195 0.67969-1.6211 1.1406-3.5586 1.2891-5.5312 0.17188-1.9609 0.019531-3.9609-0.23828-5.7109-0.60156-3.9805-2.1094-7.8203-4.3984-11.078-2.2891-3.2695-5.2891-6.0195-8.7383-8.0312-3.4805-1.9609-7.4219-3.1484-11.43-3.3789-3.9805-0.19141-8 0.48047-11.672 2.0312-7.3086 3.1211-13.09 9.6211-15.078 17.309-1 3.8203-1.2109 7.8398-0.46875 11.711 0.73828 3.8711 2.3594 7.5703 4.6992 10.719 1.2305 1.6484 2.6484 3.1602 4.2188 4.4688 0.39844 0.32031 0.78906 0.64844 1.2109 0.94922l0.14062 0.10156-0.73047 0.28906c-1.7383 0.73828-3.4492 1.5391-5.1094 2.4219-3.3203 1.7695-6.4688 3.8086-9.4297 6.0781-1.4805 1.1289-2.9219 2.3203-4.3086 3.5586l-1.0391 0.94141c-0.33984 0.32812-0.78125 0.73828-1.1289 1.1289-0.73828 0.80078-1.4219 1.6719-2.0117 2.5898-1.1797 1.8516-2.0508 3.8984-2.5195 6.0508-0.23828 1.0703-0.37891 2.1719-0.42188 3.2695l-0.019531 0.80859v0.67187 1.3281zm27.641-29.5h-0.03125v0.011718c0.011719 0 0.03125-0.011718 0.03125-0.011718z" />
                      <path d="m92.191 79.16c0.55078-1.2812 0.85938-2.6406 0.91016-4.0391 0.14844-2.8984-1.1289-5.9609-3.1602-7.8984l-4.1211-4.1289-8.2617-8.2305c-0.91016-0.89844-1.5508-2.9414-4.2109-0.39844-2.8711 2.75-0.67969 3.3711 0.14062 4.2617 2.5898 2.7891 5.2617 5.4883 7.9609 8.1719l4.0586 4.0117 0.48828 0.48828c0.10938 0.12109 0.23047 0.23047 0.32812 0.37109 0.21094 0.25 0.37891 0.53125 0.53125 0.82031 0 0.019531 0.019531 0.039062 0.019531 0.058594-0.17969 0.03125-0.35938 0.058593-0.51953 0.050781-10.891-0.57812-21.789 0.89062-32.672-1.8398-1.2695-0.32031-3.1094-0.69922-3.0703 4.3008 0.03125 4.1016 1.7695 3.6406 2.9492 3.6602 5.3281 0.078126 10.648-0.48828 15.98-0.48828 5.3281 0 10.719 0.011719 16.078-0.019531-1.1992 1.1289-2.5391 2.3516-3.8398 3.4805-2.8711 2.5117-5.8516 4.8984-9.0195 7.1016-1.4805 1.0312-3.5703 2.5703 0.011719 6.0703 2.9414 2.8711 4.3203 0.82031 5.4883-0.32031 2.6602-2.6016 5.1992-5.3203 7.7383-8.0391l3.8086-4.0781c0.76172-0.78906 1.6992-1.8711 2.3516-3.3398z" />
                    </g>
                  </svg>
                </Link>
              )}
              {!isShowFeature('refer_study_to_doctor') && (
                <Link
                  className="disabled-link"
                  title="You do not have access"
                  to=""
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    version="1.1"
                    viewBox="-5.0 -10.0 110.0 135.0"
                    fill="#0a7c6c"
                    id="Capa_1"
                    width="35px"
                    height="30px"
                  >
                    <g>
                      <path d="m6.8789 80.059v5.3203 0.33984l0.019532 0.55859c0.011718 0.37109 0.089843 0.75 0.14062 1.1211 0.16016 0.73047 0.37891 1.4609 0.73047 2.1289 0.64844 1.3594 1.6797 2.5117 2.9102 3.3711 1.2383 0.83984 2.7109 1.3711 4.2109 1.4883 0.87891 0.050781 1.1289 0.019531 1.6211 0.03125h1.3281 5.3203 10.641c4.6719-0.019531 11.602 0.96875 11.898-2.7109 0.32031-3.9805-6.9297-2.8594-11.371-2.9102l-10.41-0.089844-5.1992-0.03125h-2.6016c-0.19141-0.011719-0.48828 0-0.60156-0.019531-0.12891 0-0.25 0-0.37109-0.039062-0.25-0.03125-0.48047-0.12109-0.71094-0.19922-0.91016-0.39844-1.6094-1.2812-1.7383-2.2617-0.050781-0.23828-0.039062-0.44922-0.039062-0.96094v-1.3008-2.6016-2.6016c0-0.92969 0.011719-1.5508 0.10938-2.3203 0.17969-1.4688 0.64062-2.8984 1.3086-4.2188 0.67188-1.3203 1.5781-2.5195 2.6602-3.5391 1.2188-1.1406 2.4883-2.25 3.8008-3.3086 2.6094-2.1094 5.3906-4.0195 8.2891-5.6992 1.4492-0.82812 2.9414-1.6016 4.4492-2.3086 0.76172-0.32812 1.5195-0.69141 2.3008-0.98828l1.2812-0.51953c0.66016-0.30078 1.2812-0.73047 1.7812-1.3008 0.5-0.57031 0.89062-1.2695 1.0781-2.0312 0.10156-0.37891 0.14844-0.76953 0.14844-1.1602v-0.35156c0-0.078124 0-0.35156-0.019531-0.51172-0.070312-0.76172-0.30078-1.5-0.71094-2.1719-0.21094-0.33984-0.46094-0.64844-0.76172-0.94141-0.14844-0.14062-0.30859-0.28125-0.48828-0.39844l-0.30859-0.21875c-1.3008-0.87891-2.5-1.8984-3.5586-3.0586-4.2812-4.6016-6.1719-11.27-4.9102-17.398 1.1719-6.1211 5.3984-11.578 11.02-14.129 2.7812-1.3008 5.8516-1.9492 8.8984-1.8594 1.5312 0.058594 3.0117 0.32031 4.4609 0.69141 1.4297 0.46094 2.8516 0.98047 4.1406 1.75 2.6211 1.4609 4.8711 3.5508 6.5117 6.0195 1.6602 2.4414 2.7383 5.2305 3.0391 8.0703 0.039063 0.32813 0.078125 0.67188 0.12109 1.0117 0 0.35156 0.011719 0.69922 0.019531 1.0586 0.039063 0.71094 0.011719 1.4492-0.03125 2.1797-0.078125 1.4688-0.28125 2.8984-0.41016 4.2109-0.25 2.6016-0.35938 4.8984 1.8398 6.1289 1.7695 0.98828 3.9805-0.75 5.3594-4.0195 0.67969-1.6211 1.1406-3.5586 1.2891-5.5312 0.17188-1.9609 0.019531-3.9609-0.23828-5.7109-0.60156-3.9805-2.1094-7.8203-4.3984-11.078-2.2891-3.2695-5.2891-6.0195-8.7383-8.0312-3.4805-1.9609-7.4219-3.1484-11.43-3.3789-3.9805-0.19141-8 0.48047-11.672 2.0312-7.3086 3.1211-13.09 9.6211-15.078 17.309-1 3.8203-1.2109 7.8398-0.46875 11.711 0.73828 3.8711 2.3594 7.5703 4.6992 10.719 1.2305 1.6484 2.6484 3.1602 4.2188 4.4688 0.39844 0.32031 0.78906 0.64844 1.2109 0.94922l0.14062 0.10156-0.73047 0.28906c-1.7383 0.73828-3.4492 1.5391-5.1094 2.4219-3.3203 1.7695-6.4688 3.8086-9.4297 6.0781-1.4805 1.1289-2.9219 2.3203-4.3086 3.5586l-1.0391 0.94141c-0.33984 0.32812-0.78125 0.73828-1.1289 1.1289-0.73828 0.80078-1.4219 1.6719-2.0117 2.5898-1.1797 1.8516-2.0508 3.8984-2.5195 6.0508-0.23828 1.0703-0.37891 2.1719-0.42188 3.2695l-0.019531 0.80859v0.67187 1.3281zm27.641-29.5h-0.03125v0.011718c0.011719 0 0.03125-0.011718 0.03125-0.011718z" />
                      <path d="m92.191 79.16c0.55078-1.2812 0.85938-2.6406 0.91016-4.0391 0.14844-2.8984-1.1289-5.9609-3.1602-7.8984l-4.1211-4.1289-8.2617-8.2305c-0.91016-0.89844-1.5508-2.9414-4.2109-0.39844-2.8711 2.75-0.67969 3.3711 0.14062 4.2617 2.5898 2.7891 5.2617 5.4883 7.9609 8.1719l4.0586 4.0117 0.48828 0.48828c0.10938 0.12109 0.23047 0.23047 0.32812 0.37109 0.21094 0.25 0.37891 0.53125 0.53125 0.82031 0 0.019531 0.019531 0.039062 0.019531 0.058594-0.17969 0.03125-0.35938 0.058593-0.51953 0.050781-10.891-0.57812-21.789 0.89062-32.672-1.8398-1.2695-0.32031-3.1094-0.69922-3.0703 4.3008 0.03125 4.1016 1.7695 3.6406 2.9492 3.6602 5.3281 0.078126 10.648-0.48828 15.98-0.48828 5.3281 0 10.719 0.011719 16.078-0.019531-1.1992 1.1289-2.5391 2.3516-3.8398 3.4805-2.8711 2.5117-5.8516 4.8984-9.0195 7.1016-1.4805 1.0312-3.5703 2.5703 0.011719 6.0703 2.9414 2.8711 4.3203 0.82031 5.4883-0.32031 2.6602-2.6016 5.1992-5.3203 7.7383-8.0391l3.8086-4.0781c0.76172-0.78906 1.6992-1.8711 2.3516-3.3398z" />
                    </g>
                  </svg>
                </Link>
              )}
              <>
                <span
                  id="basic-button"
                  aria-controls={open ? 'basic-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={open ? 'true' : undefined}
                  //onClick={handleClick}
                  //onClick={(event) => handleViewerImage(event, studyInstanceUid)}
                  onClick={event => handleClick(event, studyInstanceUid, modalities)}
                >
                  <svg
                    fill="#0a7c6c"
                    version="1.1"
                    //id="Capa_1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 28"
                    width="35px"
                    height="30px"
                    id="basic-button"
                    aria-controls={open ? 'basic-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={open ? 'true' : undefined}
                    // onClick={handleClick}
                    //onClick={(event) => handleClick(event, studyInstanceUid, modalities)}
                  >
                    <g
                      id="_01_align_center"
                      data-name="01 align center"
                    >
                      <path d="M23.821,11.181v0C22.943,9.261,19.5,3,12,3S1.057,9.261.179,11.181a1.969,1.969,0,0,0,0,1.64C1.057,14.739,4.5,21,12,21s10.943-6.261,11.821-8.181A1.968,1.968,0,0,0,23.821,11.181ZM12,19c-6.307,0-9.25-5.366-10-6.989C2.75,10.366,5.693,5,12,5c6.292,0,9.236,5.343,10,7C21.236,13.657,18.292,19,12,19Z" />
                      <path d="M12,7a5,5,0,1,0,5,5A5.006,5.006,0,0,0,12,7Zm0,8a3,3,0,1,1,3-3A3,3,0,0,1,12,15Z" />
                    </g>
                  </svg>
                </span>
                <Menu
                  id="basic-menu"
                  className="viewer-sub-menu"
                  anchorEl={anchorEl}
                  open={open}
                  onClose={handleClose}
                  MenuListProps={{
                    'aria-labelledby': 'basic-button',
                  }}
                >
                  <MenuItem className="ai-class-li">
                    <span className="text-common-light">Analyze with AI</span>
                    <span className="ai-img-class">
                      <img
                        // src="/assets/images/ai-icon-new.svg"
                        src="/ai-icon-new.png"
                        alt="AI"
                      />
                    </span>
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
              </>
              {isShowFeature('make_study_as_emergency') && (
                <Link
                  title="Add"
                  to="javascript:void(0)"
                  onClick={event => handleEmergency(event, studyInstanceUid)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="35"
                    height="30"
                    viewBox="0 0 128 128"
                  >
                    <title>Emergency</title>
                    <g>
                      <g>
                        <g>
                          <path
                            d="M55.672,30.778V27.1a5.4,5.4,0,0,1,5.405-5.4h0a5.4,5.4,0,0,1,5.405,5.4v3.682Z"
                            fill={isEmergency !== 'true' ? '#ff9000' : '#5b5b5b'}
                          />
                          <path
                            d="M30.49,87.108,34.149,80.1a22.264,22.264,0,0,0,2.527-10.3V54.579a24.4,24.4,0,0,1,24.4-24.4h0a24.4,24.4,0,0,1,24.4,24.4V69.8a22.264,22.264,0,0,0,2.527,10.3l3.658,7.011Z"
                            fill={isEmergency !== 'true' ? '#ffd92e' : '#5b5b5b'}
                          />
                          <path
                            d="M70.632,96.754a9.555,9.555,0,0,1-19.109,0Z"
                            fill={isEmergency !== 'true' ? '#ffd92e' : '#5b5b5b'}
                          />
                          <path
                            d="M30.567,87.108H91.881a3.34,3.34,0,0,1,3.34,3.34v6.306a0,0,0,0,1,0,0H26.934a0,0,0,0,1,0,0V90.741A3.633,3.633,0,0,1,30.567,87.108Z"
                            fill={isEmergency !== 'true' ? '#ff9000' : '#5b5b5b'}
                          />
                        </g>
                        <circle
                          cx="85.479"
                          cy="58.643"
                          r="15.587"
                          fill="#f25a3c"
                        />
                      </g>
                      <g>
                        <path
                          d="M85.479,61.9a1.3,1.3,0,0,1-1.3-1.3V51.643a1.3,1.3,0,0,1,2.6,0V60.6A1.3,1.3,0,0,1,85.479,61.9Z"
                          fill="#e9f3fb"
                        />
                        <circle
                          cx="85.479"
                          cy="65.282"
                          r="1.67"
                          fill="#e9f3fb"
                        />
                      </g>
                    </g>
                  </svg>
                </Link>
              )}
              {!isShowFeature('make_study_as_emergency') && (
                <Link
                  className="disabled-link"
                  title="You do not have access"
                  to="javascript:void(0)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="35"
                    height="30"
                    viewBox="0 0 128 128"
                  >
                    <title>Emergency</title>
                    <g>
                      <g>
                        <g>
                          <path
                            d="M55.672,30.778V27.1a5.4,5.4,0,0,1,5.405-5.4h0a5.4,5.4,0,0,1,5.405,5.4v3.682Z"
                            fill={isEmergency !== 'true' ? '#ff9000' : '#5b5b5b'}
                          />
                          <path
                            d="M30.49,87.108,34.149,80.1a22.264,22.264,0,0,0,2.527-10.3V54.579a24.4,24.4,0,0,1,24.4-24.4h0a24.4,24.4,0,0,1,24.4,24.4V69.8a22.264,22.264,0,0,0,2.527,10.3l3.658,7.011Z"
                            fill={isEmergency !== 'true' ? '#ffd92e' : '#5b5b5b'}
                          />
                          <path
                            d="M70.632,96.754a9.555,9.555,0,0,1-19.109,0Z"
                            fill={isEmergency !== 'true' ? '#ffd92e' : '#5b5b5b'}
                          />
                          <path
                            d="M30.567,87.108H91.881a3.34,3.34,0,0,1,3.34,3.34v6.306a0,0,0,0,1,0,0H26.934a0,0,0,0,1,0,0V90.741A3.633,3.633,0,0,1,30.567,87.108Z"
                            fill={isEmergency !== 'true' ? '#ff9000' : '#5b5b5b'}
                          />
                        </g>
                        <circle
                          cx="85.479"
                          cy="58.643"
                          r="15.587"
                          fill="#f25a3c"
                        />
                      </g>
                      <g>
                        <path
                          d="M85.479,61.9a1.3,1.3,0,0,1-1.3-1.3V51.643a1.3,1.3,0,0,1,2.6,0V60.6A1.3,1.3,0,0,1,85.479,61.9Z"
                          fill="#e9f3fb"
                        />
                        <circle
                          cx="85.479"
                          cy="65.282"
                          r="1.67"
                          fill="#e9f3fb"
                        />
                      </g>
                    </g>
                  </svg>
                </Link>
              )}
            </div>
          ),
          gridCol: 6,
        },
      ],
      // Todo: This is actually running for all rows, even if they are
      // not clicked on.

      expandedContent: (
        <StudyListExpandedRow
          seriesTableColumns={{
            description: 'Description',
            seriesNumber: 'Series',
            modality: 'Modality',
            instances: 'Instances',
          }}
          seriesTableDataSource={
            seriesInStudiesMap.has(studyInstanceUid)
              ? seriesInStudiesMap.get(studyInstanceUid).map(s => {
                  return {
                    description: s.description || '(empty)',
                    seriesNumber: s.seriesNumber ?? '',
                    modality: s.modality || '',
                    instances: s.numSeriesInstances || '',
                  };
                })
              : []
          }
          isActive={isActive}
        >
          <div className="flex flex-row gap-2">
            {appConfig.loadedModes.map((mode, i) => {
              const modalitiesToCheck = modalities.replaceAll('/', '\\');

              const isValidMode = mode.isValidMode({
                modalities: modalitiesToCheck,
                study,
              });
              // TODO: Modes need a default/target route? We mostly support a single one for now.
              // We should also be using the route path, but currently are not
              // mode.routeName
              // mode.routes[x].path
              // Don't specify default data source, and it should just be picked up... (this may not currently be the case)
              // How do we know which params to pass? Today, it's just StudyInstanceUIDs and configUrl if exists
              const query = new URLSearchParams();
              if (filterValues.configUrl) {
                query.append('configUrl', filterValues.configUrl);
              }
              query.append('StudyInstanceUIDs', studyInstanceUid);

              const originUrl = window.location.href;
              const path = originUrl.replace('/workList', '/');

              return (
                mode.displayName && (
                  <Link
                    className={isValidMode ? '' : 'cursor-not-allowed'}
                    key={i}
                    to={
                      path +
                      `${dataPath ? '../../' : ''}${mode.routeName}${
                        dataPath || ''
                      }?${query.toString()}`
                    }
                    onClick={event => {
                      // In case any event bubbles up for an invalid mode, prevent the navigation.
                      // For example, the event bubbles up when the icon embedded in the disabled button is clicked.
                      if (!isValidMode) {
                        event.preventDefault();
                      }
                    }}
                    // to={`${mode.routeName}/dicomweb?StudyInstanceUIDs=${studyInstanceUid}`}
                  >
                    {/* TODO revisit the completely rounded style of buttons used for launching a mode from the worklist later - for now use LegacyButton*/}
                    <LegacyButton
                      rounded="full"
                      variant={isValidMode ? 'contained' : 'disabled'}
                      disabled={!isValidMode}
                      endIcon={<Icon name="launch-arrow" />} // launch-arrow | launch-info
                      onClick={() => {}}
                      // className={isActive ? 'bg-primary-light_dark' : ''}
                    >
                      {t(`Modes:${mode.displayName}`)}
                    </LegacyButton>
                  </Link>
                )
              );
            })}
          </div>
        </StudyListExpandedRow>
      ),
      onClickRow: () =>
        setExpandedRows(s => (isExpanded ? s.filter(n => rowKey !== n) : [...s, rowKey])),
      isExpanded,
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
    {
      title: t('Header:Predefined Templates'),
      icon: 'templates',
      onClick: () => {
        navigate(`/report-templates`);
      },
    },
    // {
    //   title: t('Header:Profile & Acessibility'),
    //   icon: 'templates',
    //   onClick: () => {
    //     navigate(`/profile-accessibility`);
    //   },
    // },
    {
      title: t('Header:Profile'),
      icon: 'info',
      onClick: handleOpenSubscriptionModal,
    },

    {
      title: t('Header:Doctors Referrals'),
      icon: 'doctorReferrals',
      onClick: () => {
        navigate(`/doctor-referrals`);
      },
    },
    {
      title: t('Header:Dark/Light Mode'),
      icon: isActive ? 'darkModeIcon' : 'lightModeIcon',
      onClick: () => {
        //navigate(`/doctor-referrals`);
        handleChangeSwitch();
      },
    },
  ];

  if (appConfig.oidc) {
    menuOptions.push({
      icon: 'power-off',
      title: t('Header:Logout'),
      onClick: () => {
        navigate(`/logout?redirect_uri=${encodeURIComponent(window.location.href)}`);
      },
    });
  }

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

  const { component: dataSourceConfigurationComponent } =
    customizationService.get('ohif.dataSourceConfigurationComponent') ?? {};

  return (
    <div
      className={
        isActive
          ? 'bg-black-on trad-bg-black flex h-screen flex-col'
          : 'trad-bg-black flex h-screen flex-col bg-black'
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
        />
      )}

      <div style={{ display: 'flex', margin: '10px', flexGrow: '1' }}>
        <div
          // className={
          //   isActive
          //     ? 'ohif-scrollbar_darkMode flex grow flex-col overflow-y-auto'
          //     : 'ohif-scrollbar flex grow flex-col overflow-y-auto'
          // }

          className={
            isActive
              ? `ohif-scrollbar_darkMode flex grow flex-col overflow-y-auto ${iframeImageflag} `
              : `ohif-scrollbar flex grow flex-col overflow-y-auto ${iframeImageflag} `
          }

          //style={{ width: '50%' }}
        >
          <StudyListFilter
            style={{ minWidth: '1280px' }}
            numOfStudies={pageNumber * resultsPerPage > 100 ? 101 : numOfStudies}
            filtersMeta={filtersMeta}
            filterValues={{ ...filterValues, ...defaultSortValues }}
            onChange={setFilterValues}
            clearFilters={() => setFilterValues(defaultFilterValues)}
            isFiltering={isFiltering(filterValues, defaultFilterValues)}
            onUploadClick={uploadProps ? () => show(uploadProps) : undefined}
            getDataSourceConfigurationComponent={
              dataSourceConfigurationComponent
                ? () => dataSourceConfigurationComponent()
                : undefined
            }
            isActive={isActive}
          />

          {isSaveToServerInprogress && (
            <div className="flex flex-row items-center justify-between px-4">
              <p className="saveServer-text">
                Processing your request, Your file is being processed...
              </p>
              <LoadingIndicatorProgress className={'h-full w-full bg-black'} />
            </div>
          )}
          {hasStudies ? (
            <div
              className="flex grow flex-col"
              style={{ minWidth: '1250px' }}
            >
              <StudyListTable
                tableDataSource={tableDataSource}
                numOfStudies={numOfStudies}
                querying={querying}
                filtersMeta={filtersMeta}
                isActive={isActive}
              />
              <div className="grow">
                <StudyListPagination
                  onChangePage={onPageNumberChange}
                  onChangePerPage={onResultsPerPageChange}
                  currentPage={pageNumber}
                  perPage={resultsPerPage}
                  numOfStudies={numOfStudies}
                  isActive={isActive}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-48">
              {appConfig.showLoadingIndicator && isLoadingData ? (
                <LoadingIndicatorProgress className={'h-full w-full bg-black'} />
              ) : (
                <EmptyStudies isActive={isActive} />
              )}
            </div>
          )}
        </div>
      </div>
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
