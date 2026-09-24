import React from 'react';
import PropTypes from 'prop-types';
import ReactModal from 'react-modal';
import { useModal } from '../../contextProviders';

import Icon from '../Icon';
import Typography from '../Typography';

import './Modal.css';
import './ciai-dialog.css';

/** The saved theme, for modals whose content is not told `isActive` (e.g. the viewer). */
function readStoredDark() {
  try {
    return JSON.parse(localStorage.getItem('active_dark') || 'false') === true;
  } catch {
    return false;
  }
}

if (typeof document !== 'undefined') {
  ReactModal.setAppElement(document.getElementById('root'));
}

const Modal = ({
  closeButton,
  shouldCloseOnEsc,
  isOpen,
  title,
  onClose,
  children,
  shouldCloseOnOverlayClick,
}) => {
  const { hide } = useModal();
  const contentDark = children?.props?.isActive;
  const isDark = typeof contentDark === 'boolean' ? contentDark : readStoredDark();

  const handleClose = () => {
    hide();
  };

  const renderHeader = () => {
    return (
      title && (
        <header className="ciai-modal__head">
          <Typography
            variant="h6"
            className="flex grow !leading-[1.2]"
            data-cy="modal-header"
          >
            {title}
          </Typography>
          {closeButton && (
            <button
              type="button"
              className="ciai-modal__close"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          )}
        </header>
      )
    );
  };

  return (
    <ReactModal
      className={`ciai-modal${isDark ? ' ciai-modal--dark' : ''} relative max-h-full w-11/12 outline-none lg:w-10/12 xl:w-1/2`}
      overlayClassName="fixed top-0 left-0 right-0 bottom-0 z-50 bg-overlay flex items-start justify-center py-16"
      shouldCloseOnEsc={shouldCloseOnEsc}
      onRequestClose={handleClose}
      isOpen={isOpen}
      title={title}
      shouldCloseOnOverlayClick={shouldCloseOnOverlayClick}
    >
      {renderHeader()}
      <section
        className={`ciai-modal__body modal-content overflow-y-auto ${
          isDark ? 'ohif-scrollbar_dark_aboutModal' : 'ohif-scrollbar'
        }`}
      >
        {children}
      </section>
    </ReactModal>
  );
};

Modal.defaultProps = {
  shouldCloseOnEsc: true,
  shouldCloseOnOverlayClick: true,
};

Modal.propTypes = {
  closeButton: PropTypes.bool,
  shouldCloseOnEsc: PropTypes.bool,
  isOpen: PropTypes.bool,
  title: PropTypes.string,
  onClose: PropTypes.func,
  /** The modal's content */
  children: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]).isRequired,
  shouldCloseOnOverlayClick: PropTypes.bool,
};

export default Modal;
