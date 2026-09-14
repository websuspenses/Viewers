import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';

import Icon from '../Icon';

// Column headers are labels, not content: they sit at 11px uppercase in the
// muted tone so the row values below them are what the eye reads first.
// Deliberately not `text-white` — legacy styles.css rewrites that class to
// brand teal, which made every column header look like a link.
const baseLabelClassName = 'flex flex-col flex-1 select-none';
const baseLabelClassNameForSwitch = 'flex flex-col flex-1 select-none';
const spanClassName =
  'flex flex-row items-center gap-1 rounded text-[11px] font-bold uppercase tracking-[0.07em] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
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
  const isSorted = isSortable && sortDirection !== 'none';

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
          // An active sort is the one piece of state in this row worth
          // accenting; everything else stays quiet.
          isSorted
            ? isActive
              ? 'text-accent-bright'
              : 'text-accent'
            : isActive
              ? 'text-content-mutedDark'
              : 'text-content-muted',
          isSortable
            ? isActive
              ? 'cursor-pointer hover:text-accent-bright'
              : 'cursor-pointer hover:text-accent'
            : 'cursor-default',
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
            className={classnames(
              'w-2 shrink-0 transition-colors duration-150',
              isSorted
                ? isActive
                  ? 'text-accent-bright'
                  : 'text-accent'
                : isActive
                  ? 'text-content-mutedDark/70'
                  : 'text-border-strong'
            )}
          />
        )}
      </span>
      {children ? <span className="mt-1.5 block">{children}</span> : null}
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
