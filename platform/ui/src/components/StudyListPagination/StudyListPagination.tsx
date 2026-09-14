import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';

import Select from '../Select';

const RANGES = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
];

const ChevronIcon = ({ direction = 'left', double = false }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={direction === 'right' ? 'rotate-180' : undefined}
  >
    <path d="M14 6l-6 6 6 6" />
    {double && <path d="M19 6l-6 6 6 6" />}
  </svg>
);

/**
 * Worklist pagination.
 *
 * The page indicator is the anchor and sits between the two direction
 * controls, so moving through pages is a single left/right decision rather
 * than a hunt through a row of same-looking buttons.
 */
const StudyListPagination = ({
  onChangePage,
  currentPage,
  perPage,
  onChangePerPage,
  numOfStudies,
  isActive,
}) => {
  const { t } = useTranslation('StudyList');

  const navigateToPage = page => {
    onChangePage(page < 1 ? 1 : page);
  };

  const [selectedRange, setSelectedRange] = useState(
    RANGES.find(range => Number(range.value) === perPage)
  );

  const onSelectedRange = range => {
    setSelectedRange(range);
    onChangePerPage(range.value);
  };

  const isFirstPage = currentPage === 1;
  // The API reports no total, so a short page is the only signal that this is
  // the last one.
  const isLastPage = numOfStudies === 0 || numOfStudies < perPage;
  const rangeStart = numOfStudies === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const rangeEnd = (currentPage - 1) * perPage + numOfStudies;

  const NavButton = ({ onClick, disabled, ariaLabel, children }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={classnames(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold',
        'transition-colors duration-150 focus:outline-none focus-visible:ring-2',
        'focus-visible:ring-accent/50',
        disabled
          ? 'cursor-not-allowed opacity-40'
          : isActive
            ? 'border-border-defaultDark text-content-secondaryDark hover:border-accent hover:text-accent-bright'
            : 'border-border-default bg-surface-raised text-content-secondary hover:border-accent hover:text-accent'
      )}
    >
      {children}
    </button>
  );

  return (
    <div
      className={classnames(
        'rounded-b-xl border-t py-3',
        isActive ? 'bg-black-on border-border-subtleDark' : 'bg-black border-border-subtle'
      )}
    >
      <div className="container relative m-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <label
              htmlFor="rows-per-page"
              className={classnames(
                'text-[13px]',
                isActive ? 'text-content-mutedDark' : 'text-content-muted'
              )}
            >
              {t('Results per page')}
            </label>
            <Select
              id="rows-per-page"
              className="relative w-[84px]"
              options={RANGES}
              value={selectedRange}
              isMulti={false}
              isClearable={false}
              isSearchable={false}
              closeMenuOnSelect={true}
              hideSelectedOptions={false}
              isActive={isActive}
              onChange={onSelectedRange}
            />
            {numOfStudies > 0 && (
              <span
                className={classnames(
                  'hidden text-[13px] tabular-nums sm:inline',
                  isActive ? 'text-content-mutedDark' : 'text-content-muted'
                )}
              >
                {rangeStart}&ndash;{rangeEnd}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <NavButton
              onClick={() => navigateToPage(1)}
              disabled={isFirstPage}
              ariaLabel={t('First page')}
            >
              <ChevronIcon
                direction="left"
                double
              />
            </NavButton>
            <NavButton
              onClick={() => navigateToPage(currentPage - 1)}
              disabled={isFirstPage}
              ariaLabel={t('Previous')}
            >
              <ChevronIcon direction="left" />
              <span className="hidden sm:inline">{t('Previous')}</span>
            </NavButton>

            <span
              className={classnames(
                'inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold tabular-nums',
                isActive
                  ? 'bg-accent-lightDark text-accent-bright'
                  : 'bg-accent-light text-accent'
              )}
            >
              {t('Page')} {currentPage}
            </span>

            <NavButton
              onClick={() => navigateToPage(currentPage + 1)}
              disabled={isLastPage}
              ariaLabel={t('Next')}
            >
              <span className="hidden sm:inline">{t('Next')}</span>
              <ChevronIcon direction="right" />
            </NavButton>
          </div>
        </div>
      </div>
    </div>
  );
};

StudyListPagination.propTypes = {
  onChangePage: PropTypes.func.isRequired,
  currentPage: PropTypes.number.isRequired,
  perPage: PropTypes.number.isRequired,
  onChangePerPage: PropTypes.func.isRequired,
  numOfStudies: PropTypes.number,
  isActive: PropTypes.bool,
};

export default StudyListPagination;
