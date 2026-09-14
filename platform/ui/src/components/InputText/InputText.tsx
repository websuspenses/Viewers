import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import Input from '../Input';
import InputLabelWrapper from '../InputLabelWrapper';

/**
 * Filter text field with a leading search affordance.
 *
 * The icon is a real positioned element rather than a `background-image` on the
 * input: as a background it had to be kept clear with `padding-left`, and any
 * other rule touching the input's padding (the base `px-3`, a browser default)
 * silently slid the text back underneath the glyph.
 */
const InputText = ({
  id,
  label,
  isSortable,
  sortDirection,
  onLabelClick,
  value,
  onChange,
  isActive,
  placeholder,
}) => {
  return (
    <InputLabelWrapper
      label={label}
      isSortable={isSortable}
      sortDirection={sortDirection}
      onLabelClick={onLabelClick}
      isActive={isActive}
    >
      <div className="relative flex w-full items-center">
        <svg
          className={classnames(
            'pointer-events-none absolute left-3 h-3.5 w-3.5 shrink-0',
            isActive ? 'text-content-mutedDark' : 'text-content-muted'
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle
            cx="11"
            cy="11"
            r="8"
          />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <Input
          id={id}
          className="worklist-search-input"
          type="text"
          containerClassName="w-full"
          value={value}
          placeholder={placeholder}
          onChange={event => {
            onChange(event.target.value);
          }}
          isActive={isActive}
        />
      </div>
    </InputLabelWrapper>
  );
};

InputText.defaultProps = {
  value: '',
  isSortable: false,
  onLabelClick: () => {},
  sortDirection: 'none',
  placeholder: '',
};

InputText.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string.isRequired,
  isSortable: PropTypes.bool,
  sortDirection: PropTypes.oneOf(['ascending', 'descending', 'none']),
  onLabelClick: PropTypes.func,
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  placeholder: PropTypes.string,
};

export default InputText;
