import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FirstPageIcon from '@mui/icons-material/FirstPage';

import { describeDateRange } from './WorklistFilters';

// ---------------------------------------------------------------------------
// Copyable cell text
// ---------------------------------------------------------------------------

/** Cell text with a copy button that appears on row hover — MRNs and names get pasted into other systems. */
export function CopyableText({
  text,
  className,
  children,
}: {
  text: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  if (!text) {
    return <span className="wl-empty-value">—</span>;
  }

  return (
    <span className="wl-copy">
      <span
        className={`wl-truncate ${className || ''}`}
        title={text}
      >
        {children || text}
      </span>
      <Tooltip
        title={copied ? 'Copied' : 'Copy'}
        placement="top"
        arrow
        disableInteractive
      >
        <button
          type="button"
          aria-label={`Copy ${text}`}
          onClick={async event => {
            event.stopPropagation();
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            } catch {
              // Clipboard can be unavailable (insecure origin); the text is still selectable.
            }
          }}
        >
          <ContentCopyIcon />
        </button>
      </Tooltip>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

type ActiveFilter = { name: string; label: string; value: string };

export function getActiveFilters(
  filterValues: Record<string, any>,
  defaultFilterValues: Record<string, any>
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  if (filterValues.patientName && filterValues.patientName !== defaultFilterValues.patientName) {
    filters.push({ name: 'patientName', label: 'Patient', value: filterValues.patientName });
  }
  if (filterValues.mrn && filterValues.mrn !== defaultFilterValues.mrn) {
    filters.push({ name: 'mrn', label: 'MRN', value: filterValues.mrn });
  }
  const dateLabel = describeDateRange(filterValues.studyDate);
  if (dateLabel) {
    filters.push({ name: 'studyDate', label: 'Date', value: dateLabel });
  }
  if (Array.isArray(filterValues.modalities) && filterValues.modalities.length) {
    filters.push({
      name: 'modalities',
      label: 'Modality',
      value: filterValues.modalities.join(', '),
    });
  }
  return filters;
}

export function WorklistToolbar({
  numOfStudies,
  activeFilters,
  onClearFilter,
  onClearAll,
  onUploadClick,
  dataSourceControl,
}: {
  numOfStudies: number;
  activeFilters: ActiveFilter[];
  onClearFilter: (name: string) => void;
  onClearAll: () => void;
  onUploadClick?: () => void;
  dataSourceControl?: React.ReactNode;
}) {
  const { t } = useTranslation('StudyList');

  return (
    <>
      <div className="wl-toolbar">
        <h1 className="wl-title">{t('StudyList')}</h1>
        <span
          className="wl-count"
          data-cy="num-studies"
        >
          {numOfStudies > 100 ? '100+' : numOfStudies} {t('Studies')}
        </span>
        {dataSourceControl}
        <span className="wl-spacer" />
        {!!activeFilters.length && (
          <button
            type="button"
            className="wl-btn wl-btn--ghost"
            onClick={onClearAll}
          >
            <CloseIcon aria-hidden="true" />
            {t('ClearFilters')}
          </button>
        )}
        {onUploadClick && (
          <button
            type="button"
            className="wl-btn wl-btn--primary"
            onClick={onUploadClick}
          >
            <UploadFileOutlinedIcon aria-hidden="true" />
            Upload
          </button>
        )}
      </div>
      {!!activeFilters.length && (
        <div
          className="wl-chips"
          data-cy="active-filter-chips"
        >
          {activeFilters.map(filter => (
            <span
              key={filter.name}
              className="wl-chip"
            >
              <span>
                <b>{filter.label}:</b> {filter.value}
              </span>
              <button
                type="button"
                aria-label={`Clear ${filter.label} filter`}
                onClick={() => onClearFilter(filter.name)}
              >
                <CloseIcon style={{ fontSize: 14 }} />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

const PAGE_SIZES = [10, 25, 50, 100];

export function WorklistPagination({
  currentPage,
  perPage,
  numOfStudies,
  onChangePage,
  onChangePerPage,
}: {
  currentPage: number;
  perPage: number;
  numOfStudies: number;
  onChangePage: (page: number) => void;
  onChangePerPage: (perPage: number) => void;
}) {
  const { t } = useTranslation('StudyList');
  const isFirstPage = currentPage <= 1;
  // The API reports no total, so a short page is the only signal that this is the last one.
  const isLastPage = numOfStudies === 0 || numOfStudies < perPage;
  const rangeStart = numOfStudies === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const rangeEnd = (currentPage - 1) * perPage + numOfStudies;

  return (
    <div className="wl-footer">
      <label className="wl-per-page">
        {t('Results per page')}
        <select
          value={perPage}
          onChange={event => onChangePerPage(Number(event.target.value))}
        >
          {PAGE_SIZES.map(size => (
            <option
              key={size}
              value={size}
            >
              {size}
            </option>
          ))}
        </select>
      </label>
      {numOfStudies > 0 && (
        <span className="wl-tabular">
          Showing {rangeStart}–{rangeEnd}
        </span>
      )}
      <div className="wl-pager">
        <button
          type="button"
          className="wl-btn"
          aria-label={t('First page')}
          disabled={isFirstPage}
          onClick={() => onChangePage(1)}
        >
          <FirstPageIcon aria-hidden="true" />
        </button>
        <button
          type="button"
          className="wl-btn"
          disabled={isFirstPage}
          onClick={() => onChangePage(Math.max(1, currentPage - 1))}
        >
          <ChevronLeftIcon aria-hidden="true" />
          {t('Previous')}
        </button>
        <span
          className="wl-page"
          aria-current="page"
        >
          {t('Page')} {currentPage}
        </span>
        <button
          type="button"
          className="wl-btn"
          disabled={isLastPage}
          onClick={() => onChangePage(currentPage + 1)}
        >
          {t('Next')}
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
