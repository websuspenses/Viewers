import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import Icon from '../Icon';
import Typography from '../Typography';

// TODO: Add loading spinner to OHIF + use it here.
const EmptyStudies = ({ className, isActive }) => {

  return (
    <div className={classnames('inline-flex flex-col items-center', className)}>
      <Icon
        name="magnifier"
        className="mb-4"
      />
      <Typography
        className={isActive ? "noStudentAvailCls" : "text-primary-light"}
        variant="h5"
      >
        {'No studies available'}
      </Typography>
    </div>
  );
};

EmptyStudies.defaultProps = {
  className: '',
};

EmptyStudies.propTypes = {
  className: PropTypes.string,
  isActive: PropTypes.bool,
};

export default EmptyStudies;
