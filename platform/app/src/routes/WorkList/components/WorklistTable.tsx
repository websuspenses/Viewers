import React from 'react';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

import { DateRangeFilter, ModalityFilter, TextFilter } from './WorklistFilters';

export type SortDirection = 'ascending' | 'descending' | 'none';

export type WorklistRow = {
  key: string;
  isEmergency?: boolean;
  cells: Record<ColumnKey, React.ReactNode>;
};

type ColumnKey =
  | 'patientName'
  | 'mrn'
  | 'studyDate'
  | 'modalities'
  | 'instances'
  | 'status'
  | 'actions';

type Column = {
  key: ColumnKey;
  /** i18n key in the StudyList namespace. */
  label: string;
  width: string;
  sortable?: boolean;
  numeric?: boolean;
  align?: 'right';
};

const COLUMNS: Column[] = [
  { key: 'patientName', label: 'PatientName', width: '23%', sortable: true },
  { key: 'mrn', label: 'MRN', width: '10%', sortable: true },
  { key: 'studyDate', label: 'StudyDate', width: '13%', sortable: true },
  { key: 'modalities', label: 'Modality', width: '10%', sortable: true },
  { key: 'instances', label: 'Instances', width: '7%', numeric: true },
  { key: 'status', label: 'Status', width: '15%' },
  { key: 'actions', label: 'Actions', width: '22%', align: 'right' },
];

const SKELETON_ROWS = 8;

type Props = {
  rows: WorklistRow[];
  isDark: boolean;
  isLoading: boolean;
  isQuerying: boolean;
  filterValues: Record<string, any>;
  modalityOptions: { value: string; label: string }[];
  onFilterChange: (name: string, value: any) => void;
  sortBy?: string;
  sortDirection?: SortDirection;
  isSortingEnabled: boolean;
  onSort: (name: string) => void;
  emptyState: React.ReactNode;
};

function SortIcon({ direction }: { direction: SortDirection }) {
  // Matches the worklist's historical mapping: its "descending" sorts A→Z.
  if (direction === 'descending') {
    return <ArrowUpwardIcon aria-hidden="true" />;
  }
  if (direction === 'ascending') {
    return <ArrowDownwardIcon aria-hidden="true" />;
  }
  return <UnfoldMoreIcon aria-hidden="true" />;
}

export default function WorklistTable({
  rows,
  isDark,
  isLoading,
  isQuerying,
  filterValues,
  modalityOptions,
  onFilterChange,
  sortBy,
  sortDirection = 'none',
  isSortingEnabled,
  onSort,
  emptyState,
}: Props) {
  const { t } = useTranslation('StudyList');

  const renderFilter = (column: Column) => {
    switch (column.key) {
      case 'patientName':
        return (
          <TextFilter
            label="Patient name"
            placeholder="Search name"
            value={filterValues.patientName}
            onChange={value => onFilterChange('patientName', value)}
          />
        );
      case 'mrn':
        return (
          <TextFilter
            label="MRN"
            placeholder="Search MRN"
            value={filterValues.mrn}
            onChange={value => onFilterChange('mrn', value)}
          />
        );
      case 'studyDate':
        return (
          <DateRangeFilter
            value={filterValues.studyDate}
            isDark={isDark}
            onChange={value => onFilterChange('studyDate', value)}
          />
        );
      case 'modalities':
        return (
          <ModalityFilter
            value={filterValues.modalities}
            options={modalityOptions}
            isDark={isDark}
            onChange={value => onFilterChange('modalities', value)}
          />
        );
      default:
        return null;
    }
  };

  const showSkeleton = isLoading && !rows.length;

  return (
    <div className="wl-table-wrap">
      {isQuerying && !showSkeleton && (
        <div
          className="wl-progress"
          role="progressbar"
          aria-label="Loading studies"
        />
      )}
      <table
        className="wl-table"
        aria-busy={isLoading || isQuerying}
      >
        <colgroup>
          {COLUMNS.map(column => (
            <col
              key={column.key}
              style={{ width: column.width }}
            />
          ))}
        </colgroup>
        <thead>
          <tr className="wl-head-labels">
            {COLUMNS.map(column => {
              const sortable = column.sortable && isSortingEnabled;
              const direction: SortDirection = sortBy === column.key ? sortDirection : 'none';
              const label = t(column.label);

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sortable && direction !== 'none' ? direction : undefined}
                  className={classnames(column.numeric && 'wl-num')}
                  style={column.align === 'right' ? { textAlign: 'right' } : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="wl-sort"
                      data-sort={direction}
                      title={`Sort by ${label}`}
                      onClick={() => onSort(column.key)}
                    >
                      {label}
                      <SortIcon direction={direction} />
                    </button>
                  ) : (
                    <span className="wl-label">{label}</span>
                  )}
                </th>
              );
            })}
          </tr>
          <tr className="wl-head-filters">
            {COLUMNS.map(column => (
              <th key={column.key}>{renderFilter(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showSkeleton &&
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr
                key={`skeleton-${index}`}
                aria-hidden="true"
              >
                {COLUMNS.map((column, columnIndex) => (
                  <td key={column.key}>
                    <span
                      className="wl-skeleton"
                      style={{
                        width: `${[70, 60, 55, 40, 30, 50, 80][columnIndex] - (index % 3) * 8}%`,
                        marginLeft: column.align === 'right' || column.numeric ? 'auto' : undefined,
                      }}
                    />
                    {columnIndex === 0 && (
                      <span
                        className="wl-skeleton"
                        style={{ width: '45%', marginTop: 8, height: 8 }}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}

          {!showSkeleton && !rows.length && (
            <tr>
              <td colSpan={COLUMNS.length}>
                <div className="wl-empty">
                  <div className="wl-empty-icon">
                    <InboxOutlinedIcon />
                  </div>
                  {emptyState}
                </div>
              </td>
            </tr>
          )}

          {!showSkeleton &&
            rows.map(row => (
              <tr
                key={row.key}
                className={classnames(row.isEmergency && 'wl-row--emergency')}
              >
                {COLUMNS.map(column => (
                  <td
                    key={column.key}
                    className={classnames(column.numeric && 'wl-num wl-tabular')}
                  >
                    {row.cells[column.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
