import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import ReactSelect, { components } from 'react-select';

import Icon from '../Icon';

import './Select.css';

const MultiValue = props => {
  const values = props.selectProps.value;
  const lastValue = values[values.length - 1];
  let label = props.data.label;
  if (lastValue.label !== label) {
    label += ', ';
  }

  return <span>{label}</span>;
};

const Option = props => {
  return (
    <components.Option {...props}>
      <div className="flex items-center">
        <div className="h-2 w-2">
          {props.isSelected ? (
            <Icon name={'checkbox-active'} />
          ) : (
            <Icon name={'checkbox-default'} />
          )}
        </div>
        <label
          id={props.data.value}
          className="ml-3 mt-1"
        >
          <span>{props.value}</span>
        </label>
      </div>
    </components.Option>
  );
};

// react-select renders its own control/menu/option chrome via Emotion
// (CSS-in-JS), so plain `.customSelect__control`-style class rules can lose
// a specificity race against react-select's own generated styles. `styles`
// callbacks are the one override mechanism react-select guarantees wins.
// Opt-in only (via `isActive` being explicitly boolean, not the untouched
// default `undefined`) so every other `<Select>` call site in the app that
// hasn't been audited against this keeps its existing look untouched.
const getThemedStyles = isActive => ({
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: isActive ? 'rgb(28, 28, 20)' : '#ffffff',
    borderColor: state.isFocused ? '#6b7280' : isActive ? '#4b5563' : '#d8dce3',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 124, 108, 0.25)' : 'none',
    '&:hover': {
      borderColor: '#6b7280',
    },
  }),
  placeholder: base => ({
    ...base,
    color: isActive ? '#8890a0' : '#6b7280',
  }),
});

const Select = ({
  id,
  className,
  closeMenuOnSelect,
  hideSelectedOptions,
  isClearable,
  isDisabled,
  isMulti,
  isSearchable,
  onChange,
  options,
  placeholder,
  noIcons,
  menuPlacement,
  components,
  value,
  isActive = undefined,
}) => {
  const _noIconComponents = {
    DropdownIndicator: () => null,
    IndicatorSeparator: () => null,
  };
  let _components = isMulti ? { Option, MultiValue } : {};
  _components = noIcons
    ? { ..._components, ..._noIconComponents }
    : { ..._components, ...components };

  const selectedOptions = [];

  // Map array of values to an array of selected options
  if (value && Array.isArray(value)) {
    value.forEach(val => {
      const found = options.find(opt => opt.value === val);
      if (found) {
        selectedOptions.push(JSON.parse(JSON.stringify(found)));
      }
    });
  }

  return (
    <ReactSelect
      inputId={`input-${id}`}
      className={classnames(className, 'ohif-select customSelect__wrapper flex flex-1 flex-col')}
      data-cy={`input-${id}`}
      classNamePrefix="customSelect"
      isDisabled={isDisabled}
      isClearable={isClearable}
      isMulti={isMulti}
      isSearchable={isSearchable}
      menuPlacement={menuPlacement}
      closeMenuOnSelect={closeMenuOnSelect}
      hideSelectedOptions={hideSelectedOptions}
      components={_components}
      placeholder={placeholder}
      options={options}
      value={value && Array.isArray(value) ? selectedOptions : value}
      styles={typeof isActive === 'boolean' ? getThemedStyles(isActive) : undefined}
      onChange={(selectedOptions, { action }) => {
        const newSelection = !selectedOptions.length
          ? selectedOptions
          : selectedOptions.reduce((acc, curr) => acc.concat([curr.value]), []);
        onChange(newSelection, action);
      }}
    />
  );
};

Select.defaultProps = {
  className: '',
  closeMenuOnSelect: true,
  hideSelectedOptions: false,
  isClearable: true,
  components: {},
  isDisabled: false,
  isMulti: false,
  isSearchable: true,
  noIcons: false,
  menuPlacement: 'auto',
  value: [],
};

Select.propTypes = {
  className: PropTypes.string,
  closeMenuOnSelect: PropTypes.bool,
  hideSelectedOptions: PropTypes.bool,
  isClearable: PropTypes.bool,
  isDisabled: PropTypes.bool,
  isMulti: PropTypes.bool,
  isSearchable: PropTypes.bool,
  noIcons: PropTypes.bool,
  menuPlacement: PropTypes.oneOf(['auto', 'bottom', 'top']),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string,
      label: PropTypes.string,
    })
  ),
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.string), PropTypes.any]),
  /** Opt-in theming: pass the app's `isActive` dark-mode flag to get a
   * guaranteed-to-apply control style (see `getThemedStyles`). Omit to keep
   * this call site's existing look (ancestor-scoped CSS only). */
  isActive: PropTypes.bool,
};

export default Select;
