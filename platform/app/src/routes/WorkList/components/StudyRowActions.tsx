import React from 'react';
import classnames from 'classnames';
import Tooltip from '@mui/material/Tooltip';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import NotificationImportantOutlinedIcon from '@mui/icons-material/NotificationImportantOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const NO_ACCESS = 'You do not have access';

function ActionButton({
  label,
  allowed,
  onClick,
  icon,
  alert = false,
  expanded,
  dataCy,
}: {
  label: string;
  allowed: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  icon: React.ReactNode;
  alert?: boolean;
  expanded?: boolean;
  dataCy?: string;
}) {
  return (
    <Tooltip
      title={allowed ? label : `${label} — ${NO_ACCESS.toLowerCase()}`}
      placement="top"
      arrow
      disableInteractive
    >
      {/* A disabled button fires no events, so the tooltip hangs off a wrapper. */}
      <span>
        <button
          type="button"
          className={classnames('wl-icon-btn', alert && 'wl-icon-btn--alert')}
          aria-label={label}
          aria-haspopup={expanded === undefined ? undefined : 'menu'}
          aria-expanded={expanded}
          disabled={!allowed}
          data-cy={dataCy}
          onClick={onClick}
        >
          {icon}
        </button>
      </span>
    </Tooltip>
  );
}

type Props = {
  canReport: boolean;
  canSaveToServer: boolean;
  /** Save to server only applies to studies that are not in the cloud yet. */
  showSaveToServer: boolean;
  canRefer: boolean;
  canMarkEmergency: boolean;
  isEmergency: boolean;
  reportMenuOpen: boolean;
  viewerMenuOpen: boolean;
  onReport: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onSaveToServer: () => void;
  onRefer: () => void;
  onToggleEmergency: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onView: () => void;
  onOpenViewerMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Menus anchored to the buttons above; rendered by the worklist. */
  children?: React.ReactNode;
};

/**
 * Secondary actions are quiet icons with tooltips; opening the study is the one
 * primary action, so it is the only filled control in the row. Its caret holds
 * the other viewers (segmentation, TMTV, …) and the AI report.
 */
export default function StudyRowActions({
  canReport,
  canSaveToServer,
  showSaveToServer,
  canRefer,
  canMarkEmergency,
  isEmergency,
  reportMenuOpen,
  viewerMenuOpen,
  onReport,
  onSaveToServer,
  onRefer,
  onToggleEmergency,
  onView,
  onOpenViewerMenu,
  children,
}: Props) {
  return (
    <div className="wl-actions">
      <ActionButton
        label="Generate report"
        allowed={canReport}
        onClick={onReport}
        expanded={reportMenuOpen}
        icon={<DescriptionOutlinedIcon />}
        dataCy="basic-buttonNew"
      />
      {showSaveToServer && (
        <ActionButton
          label="Save to server"
          allowed={canSaveToServer}
          onClick={onSaveToServer}
          icon={<CloudUploadOutlinedIcon />}
        />
      )}
      <ActionButton
        label="Refer study"
        allowed={canRefer}
        onClick={onRefer}
        icon={<ForwardToInboxOutlinedIcon />}
      />
      <ActionButton
        label={isEmergency ? 'Remove emergency' : 'Mark as emergency'}
        allowed={canMarkEmergency}
        onClick={onToggleEmergency}
        alert={isEmergency}
        icon={isEmergency ? <NotificationImportantIcon /> : <NotificationImportantOutlinedIcon />}
      />
      <span
        className="wl-divider"
        aria-hidden="true"
      />
      <div className="wl-split">
        <button
          type="button"
          onClick={onView}
        >
          <VisibilityOutlinedIcon aria-hidden="true" />
          View
        </button>
        <Tooltip
          title="More viewers & AI report"
          placement="top"
          arrow
          disableInteractive
        >
          <button
            type="button"
            aria-label="More viewers and AI report"
            aria-haspopup="menu"
            aria-expanded={viewerMenuOpen}
            onClick={onOpenViewerMenu}
          >
            <KeyboardArrowDownIcon aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}
