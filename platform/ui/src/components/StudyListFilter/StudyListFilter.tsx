import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import classnames from 'classnames';
import LegacyButton from '../LegacyButton';
import Icon from '../Icon';
import Typography from '../Typography';
import InputGroup from '../InputGroup';
import StatusBadge from '../StatusBadge';

/** Renders a single active filter's value as a short, human-readable chip label. */
const formatChipLabel = (fieldMeta, value) => {
  const { inputType, displayName } = fieldMeta;

  if (inputType === 'Text') {
    return `${displayName}: ${value}`;
  }

  if (inputType === 'MultiSelect' && Array.isArray(value) && value.length > 0) {
    const shown = value.slice(0, 3).join(', ');
    const overflow = value.length > 3 ? ` +${value.length - 3}` : '';
    return `${displayName}: ${shown}${overflow}`;
  }

  if (inputType === 'DateRange' && value && (value.startDate || value.endDate)) {
    const { startDate, endDate } = value;
    if (startDate && endDate) {
      return `${displayName}: ${startDate} – ${endDate}`;
    }
    return `${displayName}: ${startDate ? `from ${startDate}` : `until ${endDate}`}`;
  }

  return null;
};

/** Derives the active-filter chip list by diffing `filterValues` against `defaultFilterValues`. */
const getActiveFilterChips = (filtersMeta, filterValues, defaultFilterValues) => {
  return filtersMeta
    .filter(fieldMeta => fieldMeta.inputType !== 'None')
    .map(fieldMeta => {
      const { name } = fieldMeta;
      const value = filterValues[name];
      const defaultValue = defaultFilterValues[name];

      const isActive =
        fieldMeta.inputType === 'MultiSelect'
          ? Array.isArray(value) && value.length > 0
          : fieldMeta.inputType === 'DateRange'
            ? Boolean(value?.startDate || value?.endDate)
            : Boolean(value) && value !== defaultValue;

      if (!isActive) {
        return null;
      }

      const label = formatChipLabel(fieldMeta, value);
      if (!label) {
        return null;
      }

      return { name, label, defaultValue };
    })
    .filter(Boolean);
};

const StudyListFilter = ({
  filtersMeta,
  filterValues,
  defaultFilterValues,
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

  const activeFilterChips = defaultFilterValues
    ? getActiveFilterChips(filtersMeta, filterValues, defaultFilterValues)
    : [];
  const clearOneFilter = name => {
    onChange({ ...filterValues, [name]: defaultFilterValues[name] });
  };


  return (
    <React.Fragment>
      <div>
        <div
          className={classnames(isActive ? 'bg-black-on' : 'bg-black', 'py-2')}
          id="containerId"
        >
          <div className="container relative mx-auto flex flex-col pt-3 pb-5">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[1px] shrink flex-row items-center gap-3">
                <Typography
                  variant="h6"
                  className={classnames(
                    'text-xl font-bold tracking-tight',
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
                    role="button"
                    tabIndex={0}
                    className="text-primary-active hover:text-accent focus-visible:ring-accent/60 flex cursor-pointer items-center gap-2 self-center rounded text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2"
                    onClick={onUploadClick}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onUploadClick();
                      }
                    }}
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
            {activeFilterChips.length > 0 && (
              <div
                className="mt-3 flex flex-row flex-wrap items-center gap-2"
                data-cy="active-filter-chips"
              >
                {activeFilterChips.map(chip => (
                  <span
                    key={chip.name}
                    className={classnames(
                      'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-3 pr-1.5 text-xs font-medium',
                      isActive
                        ? 'bg-white/10 text-content-primaryDark'
                        : 'bg-black/5 text-content-primary'
                    )}
                  >
                    <span className="truncate">{chip.label}</span>
                    <button
                      type="button"
                      aria-label={`Clear ${chip.label}`}
                      onClick={() => clearOneFilter(chip.name)}
                      className={classnames(
                        'flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-150',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                        isActive ? 'hover:bg-white/20' : 'hover:bg-black/10'
                      )}
                    >
                      <Icon
                        name="cancel"
                        className="h-2.5 w-2.5"
                      />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
  /** Same shape as `filterValues`; used to detect which fields are active for filter chips. */
  defaultFilterValues: PropTypes.object,
  numOfStudies: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  clearFilters: PropTypes.func.isRequired,
  isFiltering: PropTypes.bool.isRequired,
  onUploadClick: PropTypes.func,
  getDataSourceConfigurationComponent: PropTypes.func,
};

export default StudyListFilter;
