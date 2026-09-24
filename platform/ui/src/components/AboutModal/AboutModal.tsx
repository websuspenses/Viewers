import React from 'react';
import PropTypes from 'prop-types';
import detect from 'browser-detect';
import { useTranslation } from 'react-i18next';

import Icon from '../Icon';

/** External link rendered as a pill (styles: Modal/ciai-dialog.css). */
const Link = ({ href, children }) => (
  <a
    className="ciai-link"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
  >
    {children}
    <Icon name="external-link" />
  </a>
);

const AboutModal = ({ buildNumber, versionNumber, commitHash, isActive }) => {
  const { os, version, name } = detect();
  const browser = `${name[0].toUpperCase()}${name.substr(1)} ${version}`;
  const { t } = useTranslation('AboutModal');

  const rows = [
    [t('Repository URL'), <a key="repo" href="#" target="_blank" rel="noopener noreferrer">#</a>],
    [t('Data citation'), <a key="cite" href="#" target="_blank" rel="noopener noreferrer">#</a>],
    [t('Version number'), versionNumber || '—'],
    ...(buildNumber ? [[t('Build number'), buildNumber]] : []),
    ...(commitHash ? [[t('Commit hash'), commitHash]] : []),
    [t('Browser'), browser],
    [t('OS'), os],
  ];

  return (
    <div>
      <section className="ciai-section">
        <p className="ciai-section-title">{t('Important links')}</p>
        <div className="ciai-links">
          <Link href="https://cyberintellectus.com/products-telehealth/">Visit the forum</Link>
          <Link href="#">{t('Report an issue')}</Link>
          <Link href="#">{t('More details')}</Link>
        </div>
      </section>

      <section className="ciai-section">
        <p className="ciai-section-title">{t('Version information')}</p>
        <dl className="ciai-dl">
          {rows.map(([title, value]) => (
            <React.Fragment key={String(title)}>
              <dt>{title}</dt>
              <dd>{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      </section>
    </div>
  );
};

AboutModal.propTypes = {
  buildNumber: PropTypes.string,
  versionNumber: PropTypes.string,
  isActive: PropTypes.bool,
};

export default AboutModal;
