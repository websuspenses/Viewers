import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import classnames from 'classnames';
import Icon from '../Icon';
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
          className={classnames(
            isActive ? 'bg-surface-overlayDark' : 'bg-surface-canvas',
            'rounded-t-xl'
          )}
          id="containerId"
        >
          <div className="container relative mx-auto flex flex-col pt-4 pb-3">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[1px] shrink flex-row items-center gap-3">
                {/* A plain heading, not <Typography>: that component defaults to
                    `color="initial"` -> `text-white`, and legacy styles.css
                    repaints `.text-white` brand teal — which is why the page
                    title rendered as if it were a link. */}
                <h1
                  id="StudyList"
                  className={classnames(
                    'm-0 text-[21px] font-semibold leading-tight tracking-[-0.01em]',
                    isActive ? 'text-content-primaryDark' : 'text-content-primary'
                  )}
                >
                  {t('StudyList')}
                </h1>
                <StatusBadge
                  label={`${numOfStudies > 100 ? '100+' : numOfStudies} ${t('Studies')}`}
                  variant="neutral"
                  isActive={isActive}
                  data-cy="num-studies"
                />
                {getDataSourceConfigurationComponent && getDataSourceConfigurationComponent()}
              </div>
              <div className="flex flex-row items-center gap-2">
                {onUploadClick && (
                  <button
                    type="button"
                    className={classnames(
                      'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold',
                      'focus-visible:ring-accent/50 transition-colors duration-150 focus:outline-none focus-visible:ring-2',
                      isActive
                        ? 'border-border-defaultDark text-content-secondaryDark hover:border-border-strongDark hover:text-content-primaryDark'
                        : 'border-border-default bg-surface-raised text-content-secondary hover:border-border-strong hover:text-content-primary'
                    )}
                    onClick={onUploadClick}
                  >
                    <Icon
                      name="icon-upload"
                      className="h-4 w-4"
                    />
                    <span>Upload</span>
                  </button>
                )}
                {isFiltering && (
                  <button
                    type="button"
                    className={classnames(
                      'focus-visible:ring-accent/50 inline-flex h-9 items-center gap-1.5 rounded-lg px-3',
                      'text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2',
                      isActive
                        ? 'text-accent-bright hover:bg-accent-lightDark'
                        : 'text-accent hover:bg-accent-light'
                    )}
                    onClick={clearFilters}
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    {t('ClearFilters')}
                  </button>
                )}
              </div>
            </div>
            {activeFilterChips.length > 0 && (
              <div
                className="mt-2.5 flex flex-row flex-wrap items-center gap-1.5"
                data-cy="active-filter-chips"
              >
                {activeFilterChips.map(chip => (
                  <span
                    key={chip.name}
                    className={classnames(
                      'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full py-1 pl-2.5 pr-1',
                      'text-[12px] font-medium ring-1 ring-inset',
                      isActive
                        ? 'bg-accent-lightDark text-content-primaryDark ring-accent/30'
                        : 'bg-accent-light text-content-primary ring-accent/25'
                    )}
                  >
                    <span className="truncate">{chip.label}</span>
                    <button
                      type="button"
                      aria-label={`Clear ${chip.label}`}
                      onClick={() => clearOneFilter(chip.name)}
                      className={classnames(
                        'focus-visible:ring-accent/60 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        'transition-colors duration-150 focus:outline-none focus-visible:ring-2',
                        isActive
                          ? 'text-content-secondaryDark hover:bg-white/15 hover:text-content-primaryDark'
                          : 'text-content-muted hover:bg-black/10 hover:text-content-primary'
                      )}
                    >
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
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
          // Continues the title panel above it, closing with the single
          // hairline that separates the whole control surface from the rows.
          className={classnames(
            'border-b pb-3.5',
            isActive
              ? 'bg-surface-overlayDark border-border-subtleDark'
              : 'border-border-subtle bg-surface-canvas'
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
