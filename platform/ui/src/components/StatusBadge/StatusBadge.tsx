import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

const variantClasses = {
  info: {
    light: 'bg-statusBg-info text-statusText-info',
    dark: 'bg-statusBg-infoDark text-statusText-infoDark',
  },
  success: {
    light: 'bg-statusBg-success text-statusText-success',
    dark: 'bg-statusBg-successDark text-statusText-successDark',
  },
  warning: {
    light: 'bg-statusBg-warning text-statusText-warning',
    dark: 'bg-statusBg-warningDark text-statusText-warningDark',
  },
  danger: {
    light: 'bg-statusBg-danger text-statusText-danger',
    dark: 'bg-statusBg-dangerDark text-statusText-dangerDark',
  },
  emergency: {
    light: 'bg-statusBg-emergency text-statusText-emergency',
    dark: 'bg-statusBg-emergencyDark text-statusText-emergencyDark',
  },
  neutral: {
    light: 'bg-surface-sunken text-content-secondary',
    dark: 'bg-surface-sunkenDark text-content-secondaryDark',
  },
};

/**
 * Small pill used for study status, subscription-feature chips, and role chips.
 * Reads theme from the app-wide `isActive` boolean (same mechanism every other
 * @ohif/ui worklist component uses) rather than Tailwind `dark:` variants.
 */
const StatusBadge = ({ label, variant, isActive, dot, className, ...rest }) => {
  const theme = isActive ? 'dark' : 'light';
  const colorClasses = (variantClasses[variant] || variantClasses.neutral)[theme];

  return (
    <span
      {...rest}
      className={classnames(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium leading-none',
        colorClasses,
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      <span className="truncate">{label}</span>
    </span>
  );
};

StatusBadge.propTypes = {
  label: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['info', 'success', 'warning', 'danger', 'emergency', 'neutral']),
  isActive: PropTypes.bool,
  dot: PropTypes.bool,
  className: PropTypes.string,
};

StatusBadge.defaultProps = {
  variant: 'neutral',
  isActive: false,
  dot: false,
};

export default StatusBadge;
