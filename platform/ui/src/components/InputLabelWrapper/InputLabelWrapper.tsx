import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';

import Icon from '../Icon';

const baseLabelClassName = 'flex flex-col flex-1 text-white text-sm font-semibold tracking-wide pl-1 select-none';
const baseLabelClassNameForSwitch = 'flex flex-col flex-1 text-white-On text-sm font-semibold tracking-wide pl-1 select-none';
const spanClassName =
  'flex flex-row items-center rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
const sortIconMap = {
  descending: 'sorting-active-up',
  ascending: 'sorting-active-down',
  none: 'sorting',
};



const InputLabelWrapper = ({
  label,
  isSortable,
  sortDirection,
  onLabelClick,
  className,
  labelTextClassName,
  children,
  isActive,
  ...props
}) => {
  const { t } = useTranslation('StudyList');


  const onClickHandler = e => {
    if (!isSortable) {
      return;
    }

    onLabelClick(e);
  };

  return (
    <label className={isActive && label ? classnames(baseLabelClassNameForSwitch, className) : classnames(baseLabelClassName, className)}>
      <span
        role="button"
        className={classnames(
          spanClassName,
          isSortable ? 'cursor-pointer hover:text-accent' : 'cursor-default',
          labelTextClassName
        )}
        onClick={onClickHandler}
        onKeyDown={onClickHandler}
        tabIndex="0"
      >
        {t(label)}
        {isSortable && (
          <Icon
            name={sortIconMap[sortDirection]}
            className={isActive ? classnames(
              'mx-2 w-2 transition-colors duration-150',
              sortDirection !== 'none' || isActive ? 'headericonCls' : 'text-primary-light'
            ) : classnames(
              'mx-2 w-2 transition-colors duration-150',
              sortDirection !== 'none' ? 'text-primary-light' : 'text-primary-main'
            )}
          />
        )}
      </span>
      <span>{children}</span>
    </label>
  );
};

InputLabelWrapper.defaultProps = {
  className: '',
  labelTextClassName: '',
};

InputLabelWrapper.propTypes = {
  label: PropTypes.string.isRequired,
  isSortable: PropTypes.bool.isRequired,
  sortDirection: PropTypes.oneOf(['ascending', 'descending', 'none']).isRequired,
  onLabelClick: PropTypes.func.isRequired,
  className: PropTypes.string,
  labelTextClassName: PropTypes.string,
  children: PropTypes.node,
  isActive: PropTypes.bool,
};

export default InputLabelWrapper;
