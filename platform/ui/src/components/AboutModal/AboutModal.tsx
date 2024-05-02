import React from 'react';
import PropTypes from 'prop-types';
import detect from 'browser-detect';
import { useTranslation } from 'react-i18next';

import Typography from '../Typography';
import Icon from '../Icon';

const Link = ({ href, children, showIcon = false, isActive }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Typography
        variant="subtitle"
        component="p"
        className={isActive ? "flex items-center text-white-aboutCls" : "flex items-center"}
      >
        {children}
        {!!showIcon && (
          <Icon
            name="external-link"
            className={isActive ? "ml-2 w-5 text-white-aboutCls" : "ml-2 w-5 text-white"}
          />
        )}
      </Typography>
    </a>
  );
};

const Row = ({ title, value, link, isActive }) => {
  return (
    <div className="mb-4 flex">
      <Typography
        variant="subtitle"
        component="p"
        className={isActive ? "w-48 text-white-aboutCls" : "w-48 text-white"}
      >
        {title}
      </Typography>

      {link ? (
        <Link href={link} isActive={isActive}>{value}</Link>

      ) : (
        <Typography
          variant="subtitle"
          component="p"
          className={isActive ? "w-48 text-white-aboutCls" : "w-48 text-white"}
        >
          {value}
        </Typography>
      )}
    </div>
  );
};

const AboutModal = ({ buildNumber, versionNumber, commitHash, isActive }) => {
  const { os, version, name } = detect();
  const browser = `${name[0].toUpperCase()}${name.substr(1)} ${version}`;
  const { t } = useTranslation('AboutModal');

  const renderRowTitle = title => (
    <div className="mb-3 border-b-2 border-black pb-3">
      <Typography
        variant="inherit"
        color={isActive ? 'primaryLight_darkMode' : 'primaryLight'}
        className="text-[16px] font-semibold !leading-[1.2]"
      >
        {title}
      </Typography>
    </div>
  );
  return (
    <div>
      {renderRowTitle(t('Important links'))}
      <div className="mb-8 flex">
        <Link
          href="#"
          showIcon={true}
          isActive={isActive}
        >
          {'Visit the forum'}
        </Link>
        <span className="ml-4">
          <Link
            href="#"
            showIcon={true}
            isActive={isActive}

          >
            {t('Report an issue')}
          </Link>
        </span>
        <span className="ml-4">
          <Link
            href="#"
            showIcon={true}
            isActive={isActive}
          >
            {t('More details')}
          </Link>
        </span>
      </div>

      {renderRowTitle(t('Version information'))}
      <div className="flex flex-col">
        <Row
          title={t('Repository URL')}
          value="#"
          link="#"
          isActive={isActive}
        />
        <Row
          title={t('Data citation')}
          value="#"
          link="#"
          isActive={isActive}
        />
        {/* */}
        <Row
          title={t('Version number')}
          value={versionNumber}
          isActive={isActive}

        />
        {buildNumber && (
          <Row
            title={t('Build number')}
            value={buildNumber}
            isActive={isActive}

          />
        )}
        {commitHash && (
          <Row
            title={t('Commit hash')}
            value={commitHash}
            isActive={isActive}

          />
        )}
        <Row
          title={t('Browser')}
          value={browser}
          isActive={isActive}

        />
        <Row
          title={t('OS')}
          value={os}
          isActive={isActive}

        />
      </div>
    </div>
  );
};

AboutModal.propTypes = {
  buildNumber: PropTypes.string,
  versionNumber: PropTypes.string,
  isActive: PropTypes.bool,
};

export default AboutModal;
