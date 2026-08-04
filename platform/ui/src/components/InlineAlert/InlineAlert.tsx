import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Icon from '../Icon';

const variantConfig = {
  info: {
    icon: 'notifications-info',
    light: 'border-statusText-info/20 bg-statusBg-info text-statusText-info',
    dark: 'border-statusText-infoDark/20 bg-statusBg-infoDark text-statusText-infoDark',
  },
  success: {
    icon: 'notifications-success',
    light: 'border-statusText-success/20 bg-statusBg-success text-statusText-success',
    dark: 'border-statusText-successDark/20 bg-statusBg-successDark text-statusText-successDark',
  },
  warning: {
    icon: 'notifications-warning',
    light: 'border-statusText-warning/20 bg-statusBg-warning text-statusText-warning',
    dark: 'border-statusText-warningDark/20 bg-statusBg-warningDark text-statusText-warningDark',
  },
  error: {
    icon: 'notifications-error',
    light: 'border-statusText-danger/20 bg-statusBg-danger text-statusText-danger',
    dark: 'border-statusText-dangerDark/20 bg-statusBg-dangerDark text-statusText-dangerDark',
  },
};

/**
 * Lightweight success/error/warning/info banner. Purely presentational — callers
 * own the timing/dismiss state (e.g. the existing 3s auto-dismiss on the Study
 * Review Specialists success/error banner).
 */
const InlineAlert = ({ type, message, isActive, onDismiss, className }) => {
  if (!message) {
    return null;
  }

  const config = variantConfig[type] || variantConfig.info;
  const theme = isActive ? 'dark' : 'light';

  return (
    <div
      role="status"
      className={classnames(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        config[theme],
        className
      )}
    >
      <Icon
        name={config.icon}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <span className="grow">{message}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <Icon
            name="close"
            className="h-3.5 w-3.5"
          />
        </button>
      )}
    </div>
  );
};

InlineAlert.propTypes = {
  type: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  message: PropTypes.node,
  isActive: PropTypes.bool,
  onDismiss: PropTypes.func,
  className: PropTypes.string,
};

InlineAlert.defaultProps = {
  type: 'info',
  isActive: false,
};

export default InlineAlert;
