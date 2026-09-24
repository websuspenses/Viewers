import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import './NavBar.css';

const stickyClasses = 'sticky top-0';
const notStickyClasses = 'relative';

const NavBar = ({ className, children, isSticky, isActive, screen }) => {
  const loginHeaderCls = {
    paddingTop: '0px',
    paddingBottom: '0px',
    minHeight: '64px',
  };

  const workListCls = {
    paddingTop: '0px',
    paddingBottom: '0px',
    minHeight: '64px',
  };

  return (
    <div
      className={
        isActive
          ? classnames(
            'ciai-header ciai-header--dark image-viewer border-black_login-darkMode px-AlignCls z-20 flex flex-row items-center border-b',
            isSticky && stickyClasses,
            !isSticky && notStickyClasses,
            className
          )
          : classnames(
            'ciai-header image-viewer z-20 flex flex-row items-center border-b px-3',
            isSticky && stickyClasses,
            !isSticky && notStickyClasses,
            className
          )
      }
      //style={{ paddingTop: '4px', paddingBottom: '4px', minHeight: '80px' }}
      style={
        (isActive && screen === 'WorkList') || (isActive && screen === 'ReportTemplateList')
          ? workListCls
          : loginHeaderCls
      }
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
