import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

/**
 * Inline banner for a long-running action started from the worklist, such as
 * saving a study to the server.
 *
 * It sits above the table rather than covering it: the operation runs for
 * minutes, and blanking the list the user is reading to show a spinner costs
 * them the context they were working in. The indeterminate bar is honest about
 * the fact that the backend reports no percentage.
 *
 * The same component reports the failure, so a job that ends badly resolves in
 * the place the user was already watching instead of in a modal alert.
 */
const ProgressBanner = ({
  title,
  description,
  statusLabel,
  variant,
  isActive,
  onDismiss,
  className,
}) => {
  const isError = variant === 'error';

  const tone = isError
    ? {
        shell: isActive
          ? 'border-statusRing-dangerDark bg-statusBg-dangerDark'
          : 'border-statusRing-danger bg-statusBg-danger',
        icon: isActive ? 'text-statusText-dangerDark' : 'text-statusText-danger',
        chip: isActive
          ? 'bg-white/10 text-statusText-dangerDark'
          : 'bg-surface-raised text-statusText-danger',
      }
    : {
        shell: isActive ? 'border-accent/30 bg-accent-lightDark' : 'border-accent/25 bg-accent-light',
        icon: isActive ? 'text-accent-bright' : 'text-accent',
        chip: isActive ? 'bg-white/10 text-accent-bright' : 'bg-surface-raised text-accent',
      };

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      className={classnames(
        'mb-3 overflow-hidden rounded-xl border shadow-sm',
        tone.shell,
        className
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={classnames(
            'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            isError ? 'bg-black/5' : 'bg-accent/10',
            tone.icon
          )}
        >
          {isError ? (
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
              />
              <path d="M12 7v6M12 16.5v.01" />
            </svg>
          ) : (
            <svg
              className="animate-spin"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={classnames(
              'text-sm font-semibold',
              isActive ? 'text-content-primaryDark' : 'text-content-primary'
            )}
          >
            {title}
          </p>
          {description && (
            <p
              className={classnames(
                'mt-0.5 text-[12.5px] leading-relaxed',
                isActive ? 'text-content-secondaryDark' : 'text-content-secondary'
              )}
            >
              {description}
            </p>
          )}
        </div>

        {statusLabel && (
          <span
            className={classnames(
              'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
              tone.chip
            )}
          >
            {statusLabel}
          </span>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className={classnames(
              'focus-visible:ring-accent/50 -mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              'transition-colors focus:outline-none focus-visible:ring-2',
              isActive
                ? 'text-content-mutedDark hover:bg-white/10'
                : 'text-content-muted hover:bg-black/5'
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {!isError && (
        // Indeterminate: a sliver sweeping the track, since there is no percentage to report.
        <div className="bg-accent/15 h-1 w-full overflow-hidden">
          <div
            className={classnames(
              'animate-indeterminate h-full w-1/4 rounded-full',
              isActive ? 'bg-accent-bright' : 'bg-accent'
            )}
          />
        </div>
      )}
    </div>
  );
};

ProgressBanner.propTypes = {
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  statusLabel: PropTypes.node,
  variant: PropTypes.oneOf(['progress', 'error']),
  isActive: PropTypes.bool,
  onDismiss: PropTypes.func,
  className: PropTypes.string,
};

ProgressBanner.defaultProps = {
  description: null,
  statusLabel: null,
  variant: 'progress',
  isActive: false,
  onDismiss: undefined,
  className: '',
};

export default ProgressBanner;
