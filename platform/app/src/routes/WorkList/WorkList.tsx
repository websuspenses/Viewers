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
  const { hotkeyDefinitions, hotkeyDefaults } = hotkeysManager;
  const { show, hide } = useModal();
  const { t } = useTranslation();
  // ~ Modes
  const [appConfig] = useAppConfig();
  // ~ Filters
  const searchParams = useSearchParams();
  const navigate = useNavigate();

  const STUDIES_LIMIT = 101;
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

  /*
   * The default sort value keep the filters synchronized with runtime conditional sorting
   * Only applied if no other sorting is specified and there are less than 101 studies
   */

  const canSort = studiesTotal < STUDIES_LIMIT;
  const shouldUseDefaultSort = sortBy === '' || !sortBy;
  const sortModifier = sortDirection === 'descending' ? 1 : -1;
  const defaultSortValues =
    shouldUseDefaultSort && canSort ? { sortBy: 'studyDate', sortDirection: 'ascending' } : {};
  const sortedStudies = studies;

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

  // ~ Rows & Studies
  const [expandedRows, setExpandedRows] = useState([]);
  const [studiesWithSeriesData, setStudiesWithSeriesData] = useState([]);
  const numOfStudies = studiesTotal;
  const querying = useMemo(() => {
    return isLoadingData || expandedRows.length > 0;
  }, [isLoadingData, expandedRows]);

  const setFilterValues = val => {
    if (filterValues.pageNumber === val.pageNumber) {
      val.pageNumber = 1;
    }
    _setFilterValues(val);
    setExpandedRows([]);
  };

  const onPageNumberChange = newPageNumber => {
    const oldPageNumber = filterValues.pageNumber;
    const rollingPageNumberMod = Math.floor(101 / filterValues.resultsPerPage);
    const rollingPageNumber = oldPageNumber % rollingPageNumberMod;
    const isNextPage = newPageNumber > oldPageNumber;
    const hasNextPage = Math.max(rollingPageNumber, 1) * resultsPerPage < numOfStudies;

    if (isNextPage && !hasNextPage) {
      return;
    }
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

  function handleChangeSwitch() {
    setIsActive(!isActive);
  }

  const handleShowModal = studyId => {
    setShowStudyInstanceID(studyId);
    setReferralPopup(true);
  };

  const handleCloseModal = () => {
    setReferralPopup(false);
  };

  useEffect(() => {
    localStorage.setItem('active_dark', JSON.stringify(isActive));
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

  const rollingPageNumberMod = Math.floor(101 / resultsPerPage);
  const rollingPageNumber = (pageNumber - 1) % rollingPageNumberMod;
  const offset = resultsPerPage * rollingPageNumber;
  const offsetAndTake = offset + resultsPerPage;
  const tableDataSource = sortedStudies.map((study, key) => {
    const rowKey = key + 1;
    const isExpanded = expandedRows.some(k => k === rowKey);
    const {
      studyInstanceUid,
      accession,
      modalities,
      instances,
      description,
      mrn,
      patientName,
      date,
      time,
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
            <TooltipClipboard ActiveMode={isActive}>{patientName}</TooltipClipboard>
          ) : (
            <span className="text-gray-700">(Empty)</span>
          ),
          gridCol: 4,
        },
        {
          key: 'mrn',
          content: <TooltipClipboard ActiveMode={isActive}>{mrn}</TooltipClipboard>,
          gridCol: 3,
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
          gridCol: 5,
        },
        {
          key: 'description',
          content: <TooltipClipboard ActiveMode={isActive}>{description}</TooltipClipboard>,
          gridCol: 4,
        },
        {
          key: 'modality',
          content: modalities,
          title: modalities,
          gridCol: 3,
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
                    ? classnames('mr-2 inline-flex w-4', {
                      'copyIcon-expandDarkCls': isExpanded,
                      'copyIcon-darkModeCls': !isExpanded,
                    })
                    : classnames('mr-2 inline-flex w-4', {
                      'text-primary-active': isExpanded,
                      'text-secondary-light': !isExpanded,
                    })
                }
              />
              {instances}
            </>
          ),
          title: (instances || 0).toString(),
          gridCol: 4,
        },
        {
          key: 'status',
          title: 'In-Progress',
          content: 'In-Progress',
          gridCol: 2,
        },
        {
          key: 'actions',
          title: 'Generate Reports',
          content: (
            <Link to={`/generate-report/${studyInstanceUid}/${modalities}`}>
              <svg
                fill="#0a7c6c"
                version="1.1"
                id="Capa_1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 60 60"
                width="20px"
                height="30px"
              >
                <g
                  id="SVGRepo_bgCarrier"
                  strokeWidth="0"
                />

                <g
                  id="SVGRepo_tracerCarrier"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <g id="SVGRepo_iconCarrier">
                  {' '}
                  <g>
                    {' '}
                    <g>
                      {' '}
                      <path d="M2,2h39v7h2V1c0-0.6-0.4-1-1-1H1C0.4,0,0,0.4,0,1v58c0,0.6,0.4,1,1,1h32v-2H2V2z" />{' '}
                      <path d="M43.7,21.3l-2.8-6.6c-0.1-0.4-0.5-0.6-0.9-0.6s-0.7,0.2-0.9,0.6l-2.8,6.6C36.1,21.5,36,21.7,36,22v31v6c0,0.6,0.4,1,1,1h6 c0.6,0,1-0.4,1-1v-6V22C44,21.7,43.9,21.4,43.7,21.3z M38,23h4v29h-4V23z M40,17.5l1.5,3.5h-3L40,17.5z M42,58h-4v-4h4V58z" />{' '}
                      <path d="M59,38H48c-0.6,0-1,0.4-1,1v20c0,0.6,0.4,1,1,1h11c0.6,0,1-0.4,1-1V39C60,38.4,59.6,38,59,38z M58,40v5h-9v-5H58z M49,58 V47h9v11H49z" />{' '}
                      <path d="M27,11c0-3.3-2.7-6-6-6s-6,2.7-6,6s2.7,6,6,6S27,14.3,27,11z M17,11c0-2.2,1.8-4,4-4s4,1.8,4,4s-1.8,4-4,4S17,13.2,17,11z " />{' '}
                      <rect
                        x="15"
                        y="20"
                        width="12"
                        height="2"
                      />{' '}
                      <rect
                        x="15"
                        y="25"
                        width="12"
                        height="2"
                      />{' '}
                      <rect
                        x="6"
                        y="31"
                        width="15"
                        height="2"
                      />{' '}
                      <rect
                        x="6"
                        y="36"
                        width="26"
                        height="2"
                      />{' '}
                      <rect
                        x="6"
                        y="41"
                        width="26"
                        height="2"
                      />{' '}
                      <rect
                        x="6"
                        y="46"
                        width="8"
                        height="2"
                      />{' '}
                      <rect
                        x="6"
                        y="51"
                        width="11"
                        height="2"
                      />{' '}
                      <rect
                        x="21"
                        y="46"
                        width="8"
                        height="2"
                      />{' '}
                      <rect
                        x="21"
                        y="51"
                        width="11"
                        height="2"
                      />{' '}
                    </g>{' '}
                  </g>{' '}
                </g>
              </svg>
            </Link>
          ),
          gridCol: 3,
        },
        {
          key: 'actions',
          title: 'Refer',
          content: (
            // <Link to="/generate-referral">
            <svg
              onClick={() => handleShowModal(studyInstanceUid)}
              xmlns="http://www.w3.org/2000/svg"
              version="1.1"
              viewBox="-5.0 -10.0 110.0 135.0"
              fill="#0a7c6c"
              id="Capa_1"
              width="20px"
              height="30px"
            >
              <g>
                <path d="m6.8789 80.059v5.3203 0.33984l0.019532 0.55859c0.011718 0.37109 0.089843 0.75 0.14062 1.1211 0.16016 0.73047 0.37891 1.4609 0.73047 2.1289 0.64844 1.3594 1.6797 2.5117 2.9102 3.3711 1.2383 0.83984 2.7109 1.3711 4.2109 1.4883 0.87891 0.050781 1.1289 0.019531 1.6211 0.03125h1.3281 5.3203 10.641c4.6719-0.019531 11.602 0.96875 11.898-2.7109 0.32031-3.9805-6.9297-2.8594-11.371-2.9102l-10.41-0.089844-5.1992-0.03125h-2.6016c-0.19141-0.011719-0.48828 0-0.60156-0.019531-0.12891 0-0.25 0-0.37109-0.039062-0.25-0.03125-0.48047-0.12109-0.71094-0.19922-0.91016-0.39844-1.6094-1.2812-1.7383-2.2617-0.050781-0.23828-0.039062-0.44922-0.039062-0.96094v-1.3008-2.6016-2.6016c0-0.92969 0.011719-1.5508 0.10938-2.3203 0.17969-1.4688 0.64062-2.8984 1.3086-4.2188 0.67188-1.3203 1.5781-2.5195 2.6602-3.5391 1.2188-1.1406 2.4883-2.25 3.8008-3.3086 2.6094-2.1094 5.3906-4.0195 8.2891-5.6992 1.4492-0.82812 2.9414-1.6016 4.4492-2.3086 0.76172-0.32812 1.5195-0.69141 2.3008-0.98828l1.2812-0.51953c0.66016-0.30078 1.2812-0.73047 1.7812-1.3008 0.5-0.57031 0.89062-1.2695 1.0781-2.0312 0.10156-0.37891 0.14844-0.76953 0.14844-1.1602v-0.35156c0-0.078124 0-0.35156-0.019531-0.51172-0.070312-0.76172-0.30078-1.5-0.71094-2.1719-0.21094-0.33984-0.46094-0.64844-0.76172-0.94141-0.14844-0.14062-0.30859-0.28125-0.48828-0.39844l-0.30859-0.21875c-1.3008-0.87891-2.5-1.8984-3.5586-3.0586-4.2812-4.6016-6.1719-11.27-4.9102-17.398 1.1719-6.1211 5.3984-11.578 11.02-14.129 2.7812-1.3008 5.8516-1.9492 8.8984-1.8594 1.5312 0.058594 3.0117 0.32031 4.4609 0.69141 1.4297 0.46094 2.8516 0.98047 4.1406 1.75 2.6211 1.4609 4.8711 3.5508 6.5117 6.0195 1.6602 2.4414 2.7383 5.2305 3.0391 8.0703 0.039063 0.32813 0.078125 0.67188 0.12109 1.0117 0 0.35156 0.011719 0.69922 0.019531 1.0586 0.039063 0.71094 0.011719 1.4492-0.03125 2.1797-0.078125 1.4688-0.28125 2.8984-0.41016 4.2109-0.25 2.6016-0.35938 4.8984 1.8398 6.1289 1.7695 0.98828 3.9805-0.75 5.3594-4.0195 0.67969-1.6211 1.1406-3.5586 1.2891-5.5312 0.17188-1.9609 0.019531-3.9609-0.23828-5.7109-0.60156-3.9805-2.1094-7.8203-4.3984-11.078-2.2891-3.2695-5.2891-6.0195-8.7383-8.0312-3.4805-1.9609-7.4219-3.1484-11.43-3.3789-3.9805-0.19141-8 0.48047-11.672 2.0312-7.3086 3.1211-13.09 9.6211-15.078 17.309-1 3.8203-1.2109 7.8398-0.46875 11.711 0.73828 3.8711 2.3594 7.5703 4.6992 10.719 1.2305 1.6484 2.6484 3.1602 4.2188 4.4688 0.39844 0.32031 0.78906 0.64844 1.2109 0.94922l0.14062 0.10156-0.73047 0.28906c-1.7383 0.73828-3.4492 1.5391-5.1094 2.4219-3.3203 1.7695-6.4688 3.8086-9.4297 6.0781-1.4805 1.1289-2.9219 2.3203-4.3086 3.5586l-1.0391 0.94141c-0.33984 0.32812-0.78125 0.73828-1.1289 1.1289-0.73828 0.80078-1.4219 1.6719-2.0117 2.5898-1.1797 1.8516-2.0508 3.8984-2.5195 6.0508-0.23828 1.0703-0.37891 2.1719-0.42188 3.2695l-0.019531 0.80859v0.67187 1.3281zm27.641-29.5h-0.03125v0.011718c0.011719 0 0.03125-0.011718 0.03125-0.011718z" />
                <path d="m92.191 79.16c0.55078-1.2812 0.85938-2.6406 0.91016-4.0391 0.14844-2.8984-1.1289-5.9609-3.1602-7.8984l-4.1211-4.1289-8.2617-8.2305c-0.91016-0.89844-1.5508-2.9414-4.2109-0.39844-2.8711 2.75-0.67969 3.3711 0.14062 4.2617 2.5898 2.7891 5.2617 5.4883 7.9609 8.1719l4.0586 4.0117 0.48828 0.48828c0.10938 0.12109 0.23047 0.23047 0.32812 0.37109 0.21094 0.25 0.37891 0.53125 0.53125 0.82031 0 0.019531 0.019531 0.039062 0.019531 0.058594-0.17969 0.03125-0.35938 0.058593-0.51953 0.050781-10.891-0.57812-21.789 0.89062-32.672-1.8398-1.2695-0.32031-3.1094-0.69922-3.0703 4.3008 0.03125 4.1016 1.7695 3.6406 2.9492 3.6602 5.3281 0.078126 10.648-0.48828 15.98-0.48828 5.3281 0 10.719 0.011719 16.078-0.019531-1.1992 1.1289-2.5391 2.3516-3.8398 3.4805-2.8711 2.5117-5.8516 4.8984-9.0195 7.1016-1.4805 1.0312-3.5703 2.5703 0.011719 6.0703 2.9414 2.8711 4.3203 0.82031 5.4883-0.32031 2.6602-2.6016 5.1992-5.3203 7.7383-8.0391l3.8086-4.0781c0.76172-0.78906 1.6992-1.8711 2.3516-3.3398z" />
              </g>
            </svg>
            // </Link>
          ),
          gridCol: 3,
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
                      `${dataPath ? '../../' : ''}${mode.routeName}${dataPath || ''
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
                      onClick={() => { }}
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
    {
      title: t('Header:Doctors Referrals'),
      icon: 'doctorReferrals',
      onClick: () => {
        navigate(`/doctor-referrals`);
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
        screen="WorkList"
      />
      {referralPopup && (
        <GenerateReferral
          open={referralPopup}
          handleClose={handleCloseModal}
          StudyInstanceUId={showStudyInstanceId}
        />
      )}

      <div
        className={
          isActive
            ? 'ohif-scrollbar_darkMode flex grow flex-col overflow-y-auto'
            : 'ohif-scrollbar flex grow flex-col overflow-y-auto'
        }
      >
        <StudyListFilter
          numOfStudies={pageNumber * resultsPerPage > 100 ? 101 : numOfStudies}
          filtersMeta={filtersMeta}
          filterValues={{ ...filterValues, ...defaultSortValues }}
          onChange={setFilterValues}
          clearFilters={() => setFilterValues(defaultFilterValues)}
          isFiltering={isFiltering(filterValues, defaultFilterValues)}
          onUploadClick={uploadProps ? () => show(uploadProps) : undefined}
          getDataSourceConfigurationComponent={
            dataSourceConfigurationComponent ? () => dataSourceConfigurationComponent() : undefined
          }
          isActive={isActive}
        />
        {hasStudies ? (
          <div className="flex grow flex-col">
            <StudyListTable
              tableDataSource={tableDataSource.slice(offset, offsetAndTake)}
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
  accession: '',
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
    accession: params.get('accession'),
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