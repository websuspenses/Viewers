import React from 'react';
import PropTypes from 'prop-types';
import DateRange from '../DateRange';
import InputLabelWrapper from '../InputLabelWrapper';

const InputDateRange = ({
  id,
  label,
  isSortable,
  sortDirection,
  onLabelClick,
  value,
  onChange,
  isActive,
}) => {
  const { startDate, endDate } = value;

  const onClickHandler = event => {
    event.preventDefault();
    onLabelClick(event);
  };

  return (
    <InputLabelWrapper
      label={label}
      isSortable={isSortable}
      sortDirection={sortDirection}
      onLabelClick={onClickHandler}
      isActive={isActive}
    >
      <div className='relative'>
        <DateRange
          id={id}
          startDate={startDate}
          endDate={endDate}
          onChange={onChange}
          isActive={isActive}
        />
      </div>
    </InputLabelWrapper>
  );
};

const noop = () => { };

InputDateRange.defaultProps = {
  value: {},
  onLabelClick: noop,
};

InputDateRange.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string.isRequired,
  isSortable: PropTypes.bool.isRequired,
  sortDirection: PropTypes.oneOf(['ascending', 'descending', 'none']).isRequired,
  onLabelClick: PropTypes.func.isRequired,
  value: PropTypes.shape({
    /** YYYYMMDD (19921022) */
    startDate: PropTypes.string,
    /** YYYYMMDD (19921022) */
    endDate: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
};

export default InputDateRange;
