import React, { useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import moment from 'moment';
import Popover from '@mui/material/Popover';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';

type Option = { value: string; label: string };

/** Popovers render in a portal, outside the `.wl` root, so they carry the theme themselves. */
function popoverPaperProps(isDark: boolean, width: number) {
  return {
    className: classnames('wl-pop', isDark && 'wl--dark'),
    style: { width },
  };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function TextFilter({
  value,
  placeholder,
  label,
  onChange,
}: {
  value?: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="wl-field">
      <SearchIcon aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape' && value) {
            onChange('');
          }
        }}
      />
      {value && (
        <button
          type="button"
          className="wl-field-clear"
          aria-label={`Clear ${label}`}
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modality
// ---------------------------------------------------------------------------

/** What a radiology worklist actually filters on; the full DICOM list follows. */
const COMMON_MODALITIES = ['CT', 'MR', 'CR', 'DX', 'US', 'MG', 'PT', 'NM', 'XA', 'RF'];

function summarize(values: string[]) {
  if (!values.length) {
    return '';
  }
  if (values.length <= 2) {
    return values.join(', ');
  }
  return `${values.slice(0, 2).join(', ')} +${values.length - 2}`;
}

export function ModalityFilter({
  value = [],
  options,
  onChange,
  isDark,
}: {
  value?: string[];
  options: Option[];
  onChange: (value: string[]) => void;
  isDark: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const open = Boolean(anchor);
  const selected = new Set(value);

  const { common, rest } = useMemo(() => {
    const term = query.trim().toUpperCase();
    const matches = options.filter(
      option => !term || option.value.includes(term) || option.label.toUpperCase().includes(term)
    );
    return {
      common: term ? [] : matches.filter(option => COMMON_MODALITIES.includes(option.value)),
      rest: term ? matches : matches.filter(option => !COMMON_MODALITIES.includes(option.value)),
    };
  }, [options, query]);

  const toggle = (modality: string) => {
    const next = selected.has(modality)
      ? value.filter(item => item !== modality)
      : [...value, modality];
    onChange(next);
  };

  const renderOption = (option: Option) => {
    const checked = selected.has(option.value);
    return (
      <li key={option.value}>
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={checked}
          className="wl-option"
          onClick={() => toggle(option.value)}
        >
          {checked ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
          {option.label}
        </button>
      </li>
    );
  };

  return (
    <>
      <button
        type="button"
        className={classnames('wl-select-btn', value.length && 'wl-select-btn--set')}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={value.length ? `Modality: ${value.join(', ')}` : 'Modality: all'}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <FilterListOutlinedIcon aria-hidden="true" />
        <span className="wl-select-value">{summarize(value) || 'All'}</span>
        <KeyboardArrowDownIcon aria-hidden="true" />
      </button>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null);
          setQuery('');
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={popoverPaperProps(isDark, 248)}
      >
        <div className="wl-pop-section">
          <div className="wl-field">
            <SearchIcon aria-hidden="true" />
            <input
              autoFocus
              type="text"
              value={query}
              placeholder="Search modalities"
              aria-label="Search modalities"
              onChange={event => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="wl-pop-section">
          {!!common.length && (
            <>
              <p className="wl-pop-title">Common</p>
              <ul
                className="wl-options"
                role="menu"
              >
                {common.map(renderOption)}
              </ul>
              <p
                className="wl-pop-title"
                style={{ marginTop: 10 }}
              >
                All modalities
              </p>
            </>
          )}
          <ul
            className="wl-options"
            role="menu"
          >
            {rest.map(renderOption)}
          </ul>
          {!common.length && !rest.length && (
            <p className="wl-pop-title">No modality matches “{query}”</p>
          )}
        </div>
        <div className="wl-pop-footer">
          <span style={{ color: 'var(--wl-muted)', fontSize: 12 }}>
            {value.length ? `${value.length} selected` : 'Showing all'}
          </span>
          <button
            type="button"
            className="wl-btn wl-btn--ghost"
            disabled={!value.length}
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------------------
// Date range
// ---------------------------------------------------------------------------

type DateRangeValue = { startDate?: string | null; endDate?: string | null };

const DICOM = 'YYYYMMDD';
const ISO = 'YYYY-MM-DD';

const toIso = (value?: string | null) =>
  value && moment(value, DICOM, true).isValid() ? moment(value, DICOM).format(ISO) : '';
const toDicom = (value: string) =>
  value && moment(value, ISO, true).isValid() ? moment(value, ISO).format(DICOM) : null;

function getPresets() {
  const today = moment();
  return [
    { key: 'today', label: 'Today', start: today.clone(), end: today.clone() },
    { key: 'yesterday', label: 'Yesterday', start: today.clone().subtract(1, 'day'), end: today.clone().subtract(1, 'day') },
    { key: '7d', label: 'Last 7 days', start: today.clone().subtract(6, 'day'), end: today.clone() },
    { key: '30d', label: 'Last 30 days', start: today.clone().subtract(29, 'day'), end: today.clone() },
    { key: 'month', label: 'This month', start: today.clone().startOf('month'), end: today.clone() },
  ].map(preset => ({
    ...preset,
    startDate: preset.start.format(DICOM),
    endDate: preset.end.format(DICOM),
  }));
}

export function describeDateRange(value?: DateRangeValue) {
  const start = value?.startDate ? moment(value.startDate, DICOM) : null;
  const end = value?.endDate ? moment(value.endDate, DICOM) : null;
  const preset = getPresets().find(
    item => item.startDate === value?.startDate && item.endDate === value?.endDate
  );
  if (preset) {
    return preset.label;
  }
  const format = (date: moment.Moment) =>
    date.format(date.year() === moment().year() ? 'MMM D' : 'MMM D, YYYY');
  if (start && end) {
    return start.isSame(end, 'day') ? format(start) : `${format(start)} – ${format(end)}`;
  }
  if (start) {
    return `From ${format(start)}`;
  }
  if (end) {
    return `Until ${format(end)}`;
  }
  return '';
}

export function DateRangeFilter({
  value,
  onChange,
  isDark,
}: {
  value?: DateRangeValue;
  onChange: (value: { startDate: string | null; endDate: string | null }) => void;
  isDark: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const presets = getPresets();
  const label = describeDateRange(value);
  const isSet = Boolean(value?.startDate || value?.endDate);
  const todayIso = moment().format(ISO);

  const apply = (startDate: string | null, endDate: string | null) => {
    // Keep the range ordered even when the user types the dates the wrong way round.
    if (startDate && endDate && startDate > endDate) {
      onChange({ startDate: endDate, endDate: startDate });
      return;
    }
    onChange({ startDate, endDate });
  };

  return (
    <>
      <button
        type="button"
        className={classnames('wl-select-btn', isSet && 'wl-select-btn--set')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={isSet ? `Study date: ${label}` : 'Study date: any'}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <CalendarTodayOutlinedIcon aria-hidden="true" />
        <span className="wl-select-value">{label || 'Any date'}</span>
        <KeyboardArrowDownIcon aria-hidden="true" />
      </button>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={popoverPaperProps(isDark, 312)}
      >
        <div
          className="wl-pop-section"
          role="dialog"
          aria-label="Study date range"
        >
          <p className="wl-pop-title">Quick ranges</p>
          <div className="wl-quick">
            {presets.map(preset => (
              <button
                key={preset.key}
                type="button"
                aria-pressed={
                  value?.startDate === preset.startDate && value?.endDate === preset.endDate
                }
                onClick={() => {
                  apply(preset.startDate, preset.endDate);
                  setAnchor(null);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="wl-pop-section">
          <p className="wl-pop-title">Custom range</p>
          <div className="wl-date-grid">
            <label>
              From
              <input
                type="date"
                value={toIso(value?.startDate)}
                max={toIso(value?.endDate) || todayIso}
                onChange={event => apply(toDicom(event.target.value), value?.endDate || null)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={toIso(value?.endDate)}
                min={toIso(value?.startDate) || undefined}
                max={todayIso}
                onChange={event => apply(value?.startDate || null, toDicom(event.target.value))}
              />
            </label>
          </div>
        </div>
        <div className="wl-pop-footer">
          <button
            type="button"
            className="wl-btn wl-btn--ghost"
            disabled={!isSet}
            onClick={() => apply(null, null)}
          >
            Clear
          </button>
          <button
            type="button"
            className="wl-btn wl-btn--primary"
            onClick={() => setAnchor(null)}
          >
            Done
          </button>
        </div>
      </Popover>
    </>
  );
}
