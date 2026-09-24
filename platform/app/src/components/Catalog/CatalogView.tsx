import React, { useEffect, useMemo, useState } from 'react';
import classnames from 'classnames';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import SearchOffIcon from '@mui/icons-material/SearchOff';

import '../../routes/WorkList/components/worklist.css';
import './catalog.css';

export type CatalogView = 'grid' | 'list';

export type CatalogColumn<T> = {
  key: string;
  label: string;
  width?: string;
  align?: 'right';
  render: (item: T) => React.ReactNode;
};

type Props<T> = {
  title: string;
  /** Singular/plural noun for the count and range, e.g. ['template', 'templates']. */
  noun: [string, string];
  items: T[];
  getKey: (item: T) => string;
  /** Text the search box matches against. */
  getSearchText: (item: T) => string;
  searchPlaceholder: string;
  renderCard: (item: T) => React.ReactNode;
  columns: CatalogColumn<T>[];
  isDark: boolean;
  isLoading: boolean;
  /** Remembers the chosen view per page. */
  storageKey: string;
  primaryAction?: React.ReactNode;
  notice?: React.ReactNode;
  emptyTitle: string;
  emptyText: string;
};

const PAGE_SIZES: Record<CatalogView, number[]> = {
  grid: [12, 24, 48],
  list: [10, 25, 50],
};

function readView(storageKey: string): CatalogView {
  try {
    return localStorage.getItem(storageKey) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

/**
 * Shared shell for the app's catalogue pages (Template Library, Study Review
 * Specialists): title + count, search, a remembered list/grid switch, the
 * page's primary action, client-side pagination, and loading / empty / no-match
 * states — all on the worklist's design tokens so the pages match it in both
 * themes.
 */
export default function CatalogView<T>({
  title,
  noun,
  items,
  getKey,
  getSearchText,
  searchPlaceholder,
  renderCard,
  columns,
  isDark,
  isLoading,
  storageKey,
  primaryAction,
  notice,
  emptyTitle,
  emptyText,
}: Props<T>) {
  const [view, setView] = useState<CatalogView>(() => readView(storageKey));
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[view][0]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? items.filter(item => getSearchText(item).toLowerCase().includes(term)) : items;
  }, [items, query, getSearchText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  // A new search or page size starts from the first page.
  useEffect(() => setPage(1), [query, pageSize]);

  const changeView = (next: CatalogView) => {
    setView(next);
    setPageSize(PAGE_SIZES[next][0]);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // The choice simply is not remembered.
    }
  };

  const countLabel = `${items.length} ${items.length === 1 ? noun[0] : noun[1]}`;

  const renderBody = () => {
    if (isLoading) {
      return view === 'grid' ? (
        <div className="cat-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="cat-card cat-card--skeleton"
              aria-hidden="true"
            >
              <span
                className="wl-skeleton"
                style={{ width: 40, height: 40, borderRadius: 10 }}
              />
              <span
                className="wl-skeleton"
                style={{ width: '70%', marginTop: 14 }}
              />
              <span
                className="wl-skeleton"
                style={{ width: '45%', marginTop: 8, height: 8 }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="cat-list-skeleton">
          {Array.from({ length: 6 }, (_, index) => (
            <span
              key={index}
              className="wl-skeleton"
              style={{ width: `${90 - (index % 3) * 12}%` }}
            />
          ))}
        </div>
      );
    }

    if (!items.length || !filtered.length) {
      const isNoMatch = items.length > 0;
      return (
        <div className="wl-empty">
          <div className="wl-empty-icon">{isNoMatch ? <SearchOffIcon /> : <InboxOutlinedIcon />}</div>
          <h2>{isNoMatch ? `No ${noun[1]} match “${query}”` : emptyTitle}</h2>
          <p>{isNoMatch ? 'Try a different name or clear the search.' : emptyText}</p>
          {isNoMatch && (
            <button
              type="button"
              className="wl-btn"
              onClick={() => setQuery('')}
            >
              Clear search
            </button>
          )}
        </div>
      );
    }

    if (view === 'grid') {
      return (
        <ul className="cat-grid">
          {visible.map(item => (
            <li key={getKey(item)}>{renderCard(item)}</li>
          ))}
        </ul>
      );
    }

    return (
      <div className="cat-table-wrap">
        <table className="cat-table">
          <colgroup>
            {columns.map(column => (
              <col
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.align === 'right' ? { textAlign: 'right' } : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(item => (
              <tr key={getKey(item)}>
                {columns.map(column => (
                  <td
                    key={column.key}
                    style={column.align === 'right' ? { textAlign: 'right' } : undefined}
                  >
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <main className={classnames('wl', 'cat', isDark && 'wl--dark')}>
      <section
        className="wl-card cat-card-shell"
        aria-labelledby="catalog-title"
      >
        <div className="wl-toolbar">
          <h1
            id="catalog-title"
            className="wl-title"
          >
            {title}
          </h1>
          {!isLoading && <span className="wl-count">{countLabel}</span>}
          <span className="wl-spacer" />
          <div className="wl-field cat-search">
            <SearchIcon aria-hidden="true" />
            <input
              type="text"
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.key === 'Escape' && setQuery('')}
            />
            {query && (
              <button
                type="button"
                className="wl-field-clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <CloseIcon />
              </button>
            )}
          </div>
          <div
            className="cat-seg"
            role="group"
            aria-label="Layout"
          >
            <Tooltip
              title="Grid view"
              arrow
              disableInteractive
            >
              <button
                type="button"
                aria-pressed={view === 'grid'}
                aria-label="Grid view"
                onClick={() => changeView('grid')}
              >
                <GridViewOutlinedIcon />
              </button>
            </Tooltip>
            <Tooltip
              title="List view"
              arrow
              disableInteractive
            >
              <button
                type="button"
                aria-pressed={view === 'list'}
                aria-label="List view"
                onClick={() => changeView('list')}
              >
                <ViewListOutlinedIcon />
              </button>
            </Tooltip>
          </div>
          {primaryAction}
        </div>

        {notice && <div className="wl-banner">{notice}</div>}

        <div className={classnames('cat-body', `cat-body--${view}`)}>{renderBody()}</div>

        {!isLoading && filtered.length > 0 && (
          <div className="wl-footer">
            <label className="wl-per-page">
              Per page
              <select
                value={pageSize}
                onChange={event => setPageSize(Number(event.target.value))}
              >
                {PAGE_SIZES[view].map(size => (
                  <option
                    key={size}
                    value={size}
                  >
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span className="wl-tabular">
              Showing {start + 1}–{start + visible.length} of {filtered.length}
            </span>
            <div className="wl-pager">
              <button
                type="button"
                className="wl-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeftIcon aria-hidden="true" />
                Previous
              </button>
              <span
                className="wl-page"
                aria-current="page"
              >
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                className="wl-btn"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
                <ChevronRightIcon aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Pieces the pages compose their cards and rows from
// ---------------------------------------------------------------------------

const TONES = ['sky', 'mint', 'lavender', 'peach', 'rose', 'slate'];

/** Stable pastel tone for a name, so the same item keeps its colour. */
export function toneFor(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}

export function CatalogAvatar({
  label,
  tone,
  size = 'md',
}: {
  label: string;
  tone: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={classnames('cat-avatar', `cat-tone-${tone}`, size === 'sm' && 'cat-avatar--sm')}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

export function CatalogActionButton({
  icon,
  label,
  onClick,
  danger = false,
  iconOnly = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  iconOnly?: boolean;
}) {
  const button = (
    <button
      type="button"
      className={classnames('cat-action', danger && 'cat-action--danger', iconOnly && 'cat-action--icon')}
      aria-label={iconOnly ? label : undefined}
      onClick={onClick}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );

  return iconOnly ? (
    <Tooltip
      title={label}
      arrow
      disableInteractive
    >
      {button}
    </Tooltip>
  ) : (
    button
  );
}
