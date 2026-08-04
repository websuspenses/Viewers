import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';

import Typography from '../Typography';
import Select from '../Select';
import Icon from '../Icon';
import StatusBadge from '../StatusBadge';

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
    const toPage = page < 1 ? 1 : page;
    onChangePage(toPage);
  };

  const ranges = [
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
  ];
  const [selectedRange, setSelectedRange] = useState(ranges.find(r => Number(r.value) === perPage));
  const onSelectedRange = selectedRange => {
    setSelectedRange(selectedRange);
    onChangePerPage(selectedRange.value);
  };

  const NavButton = ({ onClick, disabled, ariaLabel, children }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={classnames(
        'flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        disabled
          ? 'cursor-not-allowed opacity-35'
          : isActive
            ? 'text-content-primaryDark hover:bg-white/10'
            : 'text-content-primary hover:bg-black/5'
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={isActive ? 'bg-black-on border-border-subtleDark rounded-b-xl border-t py-4' : 'bg-black border-border-subtle rounded-b-xl border-t py-4'}>
      <div className="container relative m-auto px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center">
            <Select
              id="rows-per-page"
              className="border-primary-main relative mr-3 w-24"
              options={ranges}
              value={selectedRange}
              isMulti={false}
              isClearable={false}
              isSearchable={false}
              closeMenuOnSelect={false}
              hideSelectedOptions={true}
              onChange={onSelectedRange}
            />
            <Typography className={isActive ? 'resultsPerPage_dark' : 'text-base opacity-60'}>
              {t('ResultsPerPage')}
            </Typography>
          </div>
          <div className="">
            <div className="flex items-center gap-3">
              <StatusBadge
                label={`${t('Page')} ${currentPage}`}
                variant="neutral"
                isActive={isActive}
              />
              <div className="flex items-center gap-1">
                <NavButton
                  onClick={() => navigateToPage(1)}
                  disabled={currentPage === 1}
                  ariaLabel={t('First page')}
                >
                  <Icon
                    name="arrow-left-small"
                    className="h-3.5 w-3.5"
                  />
                  <Icon
                    name="arrow-left-small"
                    className="-ml-2.5 h-3.5 w-3.5"
                  />
                </NavButton>
                <NavButton
                  onClick={() => navigateToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  ariaLabel={t('Previous')}
                >
                  <Icon
                    name="arrow-left-small"
                    className="h-3.5 w-3.5"
                  />
                  {t('Previous')}
                </NavButton>
                <NavButton
                  onClick={() => navigateToPage(currentPage + 1)}
                  disabled={numOfStudies === 0 || numOfStudies < perPage}
                  ariaLabel={t('Next')}
                >
                  {t('Next')}
                  <Icon
                    name="arrow-right-small"
                    className="h-3.5 w-3.5"
                  />
                </NavButton>
              </div>
            </div>
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
};

export default StudyListPagination;
