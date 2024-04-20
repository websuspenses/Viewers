
import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { ReactComponent as Sun } from "./Sun.svg";
import { ReactComponent as Moon } from "./Moon.svg";
import './toggleSwitch.css';

const stickyClasses = 'sticky top-0';
const notStickyClasses = 'relative';

const ToggleSwitch = ({ className, children, isSticky, IsActive, handleChange, screen, ...props }) => {

  return (
    <div className={classnames('workListSwitchCls',
      isSticky && stickyClasses,
      !isSticky && notStickyClasses,
      className
    )}>
      <label className='dark_mode'>
        <input type='checkbox' className='dark_mode_input'
          name="switch"
          id='darkmode-toggle'
          checked={IsActive}
          value={IsActive}
          onChange={handleChange}
        />
        <label className='dark_mode_label' htmlFor='darkmode-toggle'>
          <Sun />
          <Moon />
        </label>
      </label>
      {children}
    </div>
  );
};

ToggleSwitch.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  isSticky: PropTypes.bool,
  isActive: PropTypes.bool,
  handleChange: PropTypes.func.isRequired,
  pageStatus: PropTypes.string,
};

export default ToggleSwitch;
