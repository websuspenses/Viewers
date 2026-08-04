import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import Icon from '../Icon';

/**
 * Bespoke settings/account menu used by the shared Header. Deliberately not the
 * generic `Dropdown` primitive (which is also used by the viewer toolbar) so this
 * can carry a richer visual treatment — sections, dividers, a destructive-styled
 * last item — without touching that shared component's blast radius.
 */
const SettingsMenu = ({ id, menuOptions, isActive }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = event => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target) &&
        panelRef.current &&
        !panelRef.current.contains(event.target)
      ) {
        close();
      }
    };
    const handleKey = event => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        x: rect.right + window.scrollX,
        y: rect.bottom + window.scrollY + 8,
      });
    }
  }, [open]);

  const portalTarget = typeof document !== 'undefined' && document.getElementById('react-portal');

  const isDestructive = title => /logout|sign\s?out/i.test(title || '');

  return (
    <div
      className="relative"
      ref={triggerRef}
    >
      <button
        type="button"
        id={id}
        data-cy={id}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={classnames(
          'flex h-9 items-center gap-1 rounded-full pl-2.5 pr-2 transition duration-150',
          'hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          isActive ? 'text-primary-active-dark' : 'text-primary-active'
        )}
      >
        <Icon
          name="settings"
          className="h-5 w-5"
        />
        <Icon
          name="chevron-down"
          className={classnames('h-3.5 w-3.5 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open &&
        portalTarget &&
        ReactDOM.createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              position: 'absolute',
              top: coords.y,
              left: coords.x,
              transform: 'translateX(-100%)',
              zIndex: 9999,
            }}
            className={classnames(
              'w-64 overflow-hidden rounded-xl border py-2 shadow-lg',
              isActive
                ? 'border-border-subtleDark bg-surface-overlayDark'
                : 'border-border-subtle bg-surface-overlay'
            )}
          >
            {menuOptions.map((option, index) => {
              const destructive = isDestructive(option.title);
              const previous = menuOptions[index - 1];
              const showDivider = destructive && previous && !isDestructive(previous.title);

              return (
                <React.Fragment key={option.id ?? index}>
                  {showDivider && (
                    <div
                      className={classnames(
                        'my-1.5 border-t',
                        isActive ? 'border-border-subtleDark' : 'border-border-subtle'
                      )}
                    />
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    data-cy={option.id}
                    onClick={() => {
                      close();
                      option.onClick();
                    }}
                    className={classnames(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100',
                      destructive
                        ? isActive
                          ? 'text-statusText-dangerDark hover:bg-statusBg-dangerDark'
                          : 'text-statusText-danger hover:bg-statusBg-danger'
                        : isActive
                          ? 'text-content-primaryDark hover:bg-white/5'
                          : 'text-content-primary hover:bg-black/5'
                    )}
                  >
                    {option.icon && (
                      <Icon
                        name={option.icon}
                        className="h-4 w-4 shrink-0 opacity-70"
                      />
                    )}
                    <span className="truncate">{option.title}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>,
          portalTarget
        )}
    </div>
  );
};

SettingsMenu.propTypes = {
  id: PropTypes.string,
  isActive: PropTypes.bool,
  menuOptions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      icon: PropTypes.string,
      onClick: PropTypes.func.isRequired,
    })
  ).isRequired,
};

SettingsMenu.defaultProps = {
  id: 'settings-menu',
  isActive: false,
};

export default SettingsMenu;
