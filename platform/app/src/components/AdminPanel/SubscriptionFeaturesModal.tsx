import * as React from 'react';
import Dialog from '@mui/material/Dialog';
import CloseIcon from '@mui/icons-material/Close';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import '../AdminPanel/style.css';

const getInitials = (name: string) => {
  if (!name) {
    return '?';
  }
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
};

const toSentence = (value: string) => {
  const text = String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Profile + subscription summary, themed like the rest of the app (ui Modal/ciai-dialog.css). */
export default function SubscriptionFeaturesModal(props) {
  const { open, handleClose, userRolesInfo, subscriptionFeaturesInfo, isActive } = props;

  const features: string[] = subscriptionFeaturesInfo
    ? subscriptionFeaturesInfo
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    : [];
  const roles = Object.values(userRolesInfo?.user_roles || {}) as string[];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="subscription-dialog-title"
      PaperProps={{
        className: `ciai-dialog ciai-dialog--lg${isActive ? ' ciai-dialog--dark' : ''}`,
      }}
    >
      <div className="ciai-dialog__head">
        <div
          className="ciai-dialog__icon"
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: 'linear-gradient(135deg, #0a8f7a 0%, #2db4d3 100%)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          {getInitials(userRolesInfo?.user_name)}
        </div>
        <div className="ciai-dialog__titles">
          <h2
            id="subscription-dialog-title"
            className="ciai-dialog__title"
          >
            {userRolesInfo?.user_name || 'User information'}
          </h2>
          <p className="ciai-dialog__subtitle">{userRolesInfo?.user_email}</p>
        </div>
        <button
          type="button"
          className="ciai-dialog__close"
          aria-label="Close"
          onClick={handleClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="ciai-dialog__body">
        <section className="ciai-section">
          <p className="ciai-section-title">User information &amp; subscription</p>
          <dl className="ciai-dl">
            <dt>Lab</dt>
            <dd>{userRolesInfo?.lab_name || '—'}</dd>
            <dt>Subscription</dt>
            <dd>
              {userRolesInfo?.lab_subscription || '—'}
              {userRolesInfo?.lab_subscription_desc && (
                <div
                  style={{ marginTop: 3, color: 'var(--dlg-muted)', fontWeight: 500, fontSize: 12.5 }}
                >
                  {userRolesInfo.lab_subscription_desc}
                </div>
              )}
            </dd>
          </dl>
          <p className="ciai-note">
            Some features are restricted based on your role and lab subscription type. Please reach
            out to your Lab Admin / TeleRadiology super admin for more information.
          </p>
        </section>

        <section className="ciai-section">
          <p className="ciai-section-title">Subscription features · {features.length}</p>
          {features.length ? (
            <div className="ciai-chips">
              {features.map(feature => (
                <span
                  key={feature}
                  className="ciai-chip ciai-chip--mint"
                >
                  <CheckRoundedIcon aria-hidden="true" />
                  {toSentence(feature)}
                </span>
              ))}
            </div>
          ) : (
            <p className="ciai-dialog__subtitle">No features listed.</p>
          )}
        </section>

        <section className="ciai-section">
          <p className="ciai-section-title">Roles · {roles.length}</p>
          {roles.length ? (
            <div className="ciai-chips">
              {roles.map(role => (
                <span
                  key={role}
                  className="ciai-chip ciai-chip--lavender"
                >
                  {toSentence(role)}
                </span>
              ))}
            </div>
          ) : (
            <p className="ciai-dialog__subtitle">No roles listed.</p>
          )}
        </section>
      </div>

      <div className="ciai-dialog__foot">
        <span className="ciai-spacer" />
        <button
          type="button"
          className="ciai-btn ciai-btn--primary"
          onClick={handleClose}
        >
          Close
        </button>
      </div>
    </Dialog>
  );
}
