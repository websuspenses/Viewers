import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

const stickyClasses = 'sticky top-0';
const notStickyClasses = 'relative';

const NavBar = ({ className, children, isSticky, isActive, screen, }) => {

  const loginHeaderCls = {
    paddingTop: '4px',
    paddingBottom: '0px',
    minHeight: '80px',
  };

  const workListCls = {
    paddingTop: '4px',
    paddingBottom: '0px',
    minHeight: '80px',
  };

  return (
    <div
      className={isActive ? classnames(
        'bg-secondary-dark z-20 flex flex-row items-center image-viewer border-b-4 border-black_login-darkMode px-AlignCls',
        isSticky && stickyClasses,
        !isSticky && notStickyClasses,
        className,
      ) : classnames(
        'bg-secondary-dark z-20 flex flex-row items-center image-viewer border-b-4 border-black px-1',
        isSticky && stickyClasses,
        !isSticky && notStickyClasses,
        className
      )}
      //style={{ paddingTop: '4px', paddingBottom: '4px', minHeight: '80px' }}
      style={isActive && screen === 'WorkList' ? workListCls : loginHeaderCls}
    >
      {children}
    </div>
  );
};

NavBar.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  isSticky: PropTypes.bool,
};

export default NavBar;
