import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

/**
 * Each variant pairs a tinted background with a same-hue hairline ring so the
 * badge reads as one object at a glance. The dot is a step brighter than the
 * text: it is the part that survives peripheral scanning down a long worklist,
 * and it keeps the status distinguishable without relying on hue alone.
 */
const variantClasses = {
  info: {
    light: 'bg-statusBg-info text-statusText-info ring-statusRing-info',
    dark: 'bg-statusBg-infoDark text-statusText-infoDark ring-statusRing-infoDark',
    dot: 'bg-statusDot-info',
  },
  success: {
    light: 'bg-statusBg-success text-statusText-success ring-statusRing-success',
    dark: 'bg-statusBg-successDark text-statusText-successDark ring-statusRing-successDark',
    dot: 'bg-statusDot-success',
  },
  warning: {
    light: 'bg-statusBg-warning text-statusText-warning ring-statusRing-warning',
    dark: 'bg-statusBg-warningDark text-statusText-warningDark ring-statusRing-warningDark',
    dot: 'bg-statusDot-warning',
  },
  danger: {
    light: 'bg-statusBg-danger text-statusText-danger ring-statusRing-danger',
    dark: 'bg-statusBg-dangerDark text-statusText-dangerDark ring-statusRing-dangerDark',
    dot: 'bg-statusDot-danger',
  },
  emergency: {
    light: 'bg-statusBg-emergency text-statusText-emergency ring-statusRing-emergency',
    dark: 'bg-statusBg-emergencyDark text-statusText-emergencyDark ring-statusRing-emergencyDark',
    dot: 'bg-statusDot-emergency',
  },
  neutral: {
    light: 'bg-statusBg-neutral text-statusText-neutral ring-statusRing-neutral',
    dark: 'bg-statusBg-neutralDark text-statusText-neutralDark ring-statusRing-neutralDark',
    dot: 'bg-statusDot-neutral',
  },
};

/**
 * Small pill used for study status, subscription-feature chips, and role chips.
 * Reads theme from the app-wide `isActive` boolean (same mechanism every other
 * @ohif/ui worklist component uses) rather than Tailwind `dark:` variants.
 */
const StatusBadge = ({ label, variant, isActive, dot, className, ...rest }) => {
  const theme = isActive ? 'dark' : 'light';
  const tokens = variantClasses[variant] || variantClasses.neutral;

  return (
    <span
      {...rest}
      className={classnames(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1',
        'text-[11.5px] font-semibold leading-none ring-1 ring-inset',
        tokens[theme],
        className
      )}
    >
      {dot && <span className={classnames('h-1.5 w-1.5 shrink-0 rounded-full', tokens.dot)} />}
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
  className: '',
};

export default StatusBadge;
