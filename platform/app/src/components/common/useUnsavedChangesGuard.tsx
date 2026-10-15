import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import Dialog from '@mui/material/Dialog';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import '../../routes/WorkList/components/worklist.css';
import './unsavedChanges.css';

const GUARD_STATE = '__unsavedChangesGuard';

/**
 * Asks before leaving a page with unsaved changes — from the page's own buttons
 * (call `leave(action)`), the browser's Back button, and closing/reloading the tab.
 *
 * The app renders <Routes> without a data router, so react-router's blocker is
 * not available. Back is caught with a guard history entry instead: one extra
 * entry for this page is pushed on mount; Back lands on the real entry, and the
 * popstate handler either re-arms the guard and asks, or (nothing unsaved)
 * continues back.
 *
 * Leave in-app with `navigate(path, { replace: true })` inside `leave()`, so the
 * guard entry is replaced rather than left behind in history.
 */
export function useUnsavedChangesGuard(dirty: boolean, onDiscard?: () => void) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const discardRef = useRef(onDiscard);
  discardRef.current = onDiscard;
  const leavingRef = useRef(false);
  const [pending, setPending] = useState<null | (() => void)>(null);

  useEffect(() => {
    // Inside an iframe (the viewer embeds the report page) the history is shared
    // with the parent page, so Back is left alone there; the in-page buttons
    // and the close-tab warning still ask.
    const embedded = window.self !== window.top;
    // Once per page visit (React's dev double-mount must not add a second entry).
    if (!embedded && !window.history.state?.[GUARD_STATE]) {
      window.history.pushState({ ...(window.history.state || {}), [GUARD_STATE]: true }, '');
    }
    const onPopState = () => {
      if (embedded) {
        return;
      }
      if (leavingRef.current) {
        return;
      }
      if (!dirtyRef.current) {
        // Nothing unsaved: Back only removed the guard entry, so go back once more.
        leavingRef.current = true;
        window.history.back();
        return;
      }
      window.history.pushState({ ...(window.history.state || {}), [GUARD_STATE]: true }, '');
      setPending(() => () => {
        leavingRef.current = true;
        window.history.go(-2);
      });
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current && !leavingRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  /** Runs `action` at once when nothing is unsaved; otherwise asks first. */
  const leave = useCallback((action: () => void) => {
    if (!dirtyRef.current) {
      leavingRef.current = true;
      action();
      return;
    }
    setPending(() => () => {
      leavingRef.current = true;
      action();
    });
  }, []);

  /** Leave without asking (e.g. right after a successful submit). */
  const leaveNow = useCallback((action: () => void) => {
    leavingRef.current = true;
    action();
  }, []);

  const dialogProps = {
    open: pending !== null,
    onStay: () => setPending(null),
    onLeave: () => {
      const action = pending;
      setPending(null);
      discardRef.current?.();
      action?.();
    },
  };

  return { leave, leaveNow, dialogProps };
}

type DialogProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  /** Dark theme (worklist dark mode, or the always-dark AI report editor). */
  dark?: boolean;
  title?: string;
  message?: string;
};

/** "Leave without saving?" confirmation, in the worklist's design. */
export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
  dark = false,
  title = 'Leave without saving?',
  message = 'You have unsaved changes on this page. If you leave now, they will be lost.',
}: DialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onStay}
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-message"
      PaperProps={{ className: classnames('wl-pop', 'ucd', dark && 'wl--dark') }}
    >
      <div className="ucd-body">
        <span className="ucd-icon" aria-hidden="true">
          <WarningAmberIcon />
        </span>
        <div>
          <h2 id="unsaved-changes-title" className="ucd-title">{title}</h2>
          <p id="unsaved-changes-message" className="ucd-message">{message}</p>
        </div>
      </div>
      <div className="ucd-actions">
        <button
          type="button"
          className="wl-btn"
          onClick={onStay}
          autoFocus
        >
          Stay on page
        </button>
        <button
          type="button"
          className="wl-btn ucd-leave"
          onClick={onLeave}
        >
          Leave without saving
        </button>
      </div>
    </Dialog>
  );
}
