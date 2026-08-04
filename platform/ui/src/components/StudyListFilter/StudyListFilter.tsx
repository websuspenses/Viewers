import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import classnames from 'classnames';
import LegacyButton from '../LegacyButton';
import Icon from '../Icon';
import Typography from '../Typography';
import InputGroup from '../InputGroup';
import StatusBadge from '../StatusBadge';

const StudyListFilter = ({
  filtersMeta,
  filterValues,
  onChange,
  clearFilters,
  isFiltering,
  numOfStudies,
  onUploadClick,
  getDataSourceConfigurationComponent,
  isActive,
  //enableFullWidthFlag,
}) => {
  const { t } = useTranslation('StudyList');
  const { sortBy, sortDirection } = filterValues;
  const filterSorting = { sortBy, sortDirection };
  const setFilterSorting = sortingValues => {
    onChange({
      ...filterValues,
      ...sortingValues,
    });
  };
  const isSortingEnabled = numOfStudies > 0 && numOfStudies <= 100;


  return (
    <React.Fragment>
      <div>
        <div
          className={classnames(isActive ? 'bg-black-on' : 'bg-black', 'py-1')}
          id="containerId"
        >
          <div className="container relative mx-auto flex flex-col pt-2 pb-5">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[1px] shrink flex-row items-center gap-3">
                <Typography
                  variant="h6"
                  className={classnames(
                    'text-[22px] font-semibold tracking-tight',
                    isActive ? 'text-white-On' : 'text-white'
                  )}
                  id="StudyList"
                >
                  {t('StudyList')}
                </Typography>
                <StatusBadge
                  label={`${numOfStudies > 100 ? '100+' : numOfStudies} ${t('Studies')}`}
                  variant="info"
                  isActive={isActive}
                  data-cy="num-studies"
                />
                {getDataSourceConfigurationComponent && getDataSourceConfigurationComponent()}
                {onUploadClick && (
                  <div
                    className="text-primary-active hover:text-accent flex cursor-pointer items-center gap-2 self-center text-base font-semibold transition-colors duration-150"
                    onClick={onUploadClick}
                  >
                    <Icon name="icon-upload"></Icon>
                    <span>Upload</span>
                  </div>
                )}
              </div>
              <div className="flex flex-row items-center">
                {/* TODO revisit the completely rounded style of button used for clearing the study list filter - for now use LegacyButton*/}
                {isFiltering && (
                  <LegacyButton
                    rounded="full"
                    variant="outlined"
                    color={isActive ? "primaryActive_dark_color" : "primaryActive"}
                    border={isActive ? "primaryActive_dark_border" : "primaryActive"}
                    startIcon={<Icon name="cancel" />}
                    onClick={clearFilters}
                  >
                    {t('ClearFilters')}
                  </LegacyButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sticky -top-1 z-10 mx-auto">
        <div
          className={classnames(
            'rounded-t-xl',
            isActive ? 'bg-primary-dark-on headContentCls' : 'bg-primary-dark border-border-subtle border-b pb-4',
            'pt-4'
          )}
        >
          <InputGroup
            inputMeta={filtersMeta}
            values={filterValues}
            onValuesChange={onChange}
            sorting={filterSorting}
            onSortingChange={setFilterSorting}
            isSortingEnabled={isSortingEnabled}
            isActive={isActive}
          />
        </div>
        {numOfStudies > 100 && (
          <div className="container m-auto">
            <div className="bg-primary-main rounded-b py-1 text-center text-base">
              <p className="text-white">{t('NumOfStudiesHiggerThan100Message')}</p>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
};

StudyListFilter.propTypes = {
  filtersMeta: PropTypes.arrayOf(
    PropTypes.shape({
      /** Identifier used to map a field to it's value in `filterValues` */
      name: PropTypes.string.isRequired,
      /** Friendly label for filter field */
      displayName: PropTypes.string.isRequired,
      /** One of the supported filter field input types */
      inputType: PropTypes.oneOf(['Text', 'MultiSelect', 'DateRange', 'None']).isRequired,
      isSortable: PropTypes.bool.isRequired,
      /** Size of filter field in a 12-grid system */
      gridCol: PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).isRequired,
      /** Options for a "MultiSelect" inputType */
      option: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.string,
          label: PropTypes.string,
        })
      ),
    })
  ).isRequired,
  filterValues: PropTypes.object.isRequired,
  numOfStudies: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  clearFilters: PropTypes.func.isRequired,
  isFiltering: PropTypes.bool.isRequired,
  onUploadClick: PropTypes.func,
  getDataSourceConfigurationComponent: PropTypes.func,
};

export default StudyListFilter;
