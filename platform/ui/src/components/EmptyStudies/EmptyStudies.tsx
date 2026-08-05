import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useTranslation } from 'react-i18next';

import Icon from '../Icon';
import Typography from '../Typography';
import LegacyButton from '../LegacyButton';

const EmptyStudies = ({ className, isActive, isFiltering, onClearFilters, onUploadClick }) => {
  const { t } = useTranslation('StudyList');

  return (
    <div className={classnames('inline-flex flex-col items-center text-center', className)}>
      <Icon
        name="magnifier"
        className="mb-4 h-10 w-10 opacity-60"
      />
      <Typography
        className={isActive ? "noStudentAvailCls" : "text-primary-light"}
        variant="h5"
      >
        {t('No studies available')}
      </Typography>
      <Typography
        variant="body"
        className={classnames(
          'mt-2 max-w-sm text-sm',
          isActive ? 'text-content-secondaryDark' : 'text-content-secondary'
        )}
      >
        {isFiltering
          ? t('No studies match your current filters. Try adjusting or clearing them.')
          : t('Studies you upload or receive will show up here.')}
      </Typography>
      {(isFiltering || onUploadClick) && (
        <div className="mt-5 flex items-center gap-3">
          {isFiltering && onClearFilters && (
            <LegacyButton
              rounded="full"
              variant="outlined"
              color={isActive ? 'primaryActive_dark_color' : 'primaryActive'}
              border={isActive ? 'primaryActive_dark_border' : 'primaryActive'}
              startIcon={<Icon name="cancel" />}
              onClick={onClearFilters}
            >
              {t('ClearFilters')}
            </LegacyButton>
          )}
          {!isFiltering && onUploadClick && (
            <LegacyButton
              rounded="full"
              variant="contained"
              color="primary"
              startIcon={<Icon name="icon-upload" />}
              onClick={onUploadClick}
            >
              Upload
            </LegacyButton>
          )}
        </div>
      )}
    </div>
  );
};

EmptyStudies.defaultProps = {
  className: '',
  isFiltering: false,
};

EmptyStudies.propTypes = {
  className: PropTypes.string,
  isActive: PropTypes.bool,
  isFiltering: PropTypes.bool,
  onClearFilters: PropTypes.func,
  onUploadClick: PropTypes.func,
};

export default EmptyStudies;
