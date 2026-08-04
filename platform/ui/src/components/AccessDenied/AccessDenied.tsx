import React from 'react';
import PropTypes from 'prop-types';
import Icon from '../Icon';

/**
 * Shared "Access Denied" fallback, replacing the near-identical inline blocks
 * duplicated in ReportTemplatesList and DoctorReferralsList.
 */
const AccessDenied = ({ isActive, message }) => {
  return (
    <div
      className={
        isActive
          ? 'border-border-subtleDark bg-surface-raisedDark text-content-secondaryDark mx-auto my-12 flex max-w-md flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center'
          : 'border-border-subtle bg-surface-raised text-content-secondary mx-auto my-12 flex max-w-md flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center'
      }
    >
      <span
        className={
          isActive
            ? 'bg-statusBg-dangerDark text-statusText-dangerDark flex h-10 w-10 items-center justify-center rounded-full'
            : 'bg-statusBg-danger text-statusText-danger flex h-10 w-10 items-center justify-center rounded-full'
        }
      >
        <Icon
          name="lock"
          className="h-5 w-5"
        />
      </span>
      <p className={isActive ? 'text-content-primaryDark font-medium' : 'text-content-primary font-medium'}>
        Access Denied
      </p>
      <p className="text-sm">{message}</p>
    </div>
  );
};

AccessDenied.propTypes = {
  isActive: PropTypes.bool,
  message: PropTypes.string,
};

AccessDenied.defaultProps = {
  isActive: false,
  message: "You do not have permission to view this page. Contact your administrator if you believe this is a mistake.",
};

export default AccessDenied;
