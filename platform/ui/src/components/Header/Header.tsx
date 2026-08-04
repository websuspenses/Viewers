import React, { ReactNode, useEffect } from 'react';
import PropTypes from 'prop-types';
//import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import NavBar from '../NavBar';
import Svg from '../Svg';
import Icon from '../Icon';
import SettingsMenu from './SettingsMenu';

import { ToggleSwitch } from '@ohif/ui';
const windowWidth = window.innerWidth;
function Header({
  children,
  menuOptions,
  isReturnEnabled,
  onClickReturnButton,
  isSticky,
  WhiteLabeling,
  isActive,
  handleChange,
  screen,
  modalityValue,
  handleRedirectPage,
  iframeBlockFlag,
  ...props
}): ReactNode {
  const { t } = useTranslation('Header');

  // TODO: this should be passed in as a prop instead and the react-router-dom
  // dependency should be dropped

  const windowWidth = window.innerWidth;
  let isMobile = false;
  if (windowWidth < 768) {
    isMobile = true;
  }

  const onClickReturn = () => {
    if (!isMobile && isReturnEnabled && onClickReturnButton) {
      onClickReturnButton();
    }
  };

  const originUrl = window.location.href;
  const path = originUrl.replace(`/generate-report/${modalityValue}`, '/');

  // const handleRedirectPage = () => {
  //   alert(2222)
  // }
  // console.log('handleRedirectPage', handleRedirectPage)
  return (
    <NavBar
      className="justify-between"
      isSticky={isSticky}
      isActive={isActive}
      screen={screen}
    >
      <div
        //className="flex flex-1 justify-between"
        className={
          isActive
            ? 'navbarAlignCls header-flex flex flex-1 items-center justify-between gap-3'
            : 'header-flex flex flex-1 items-center justify-between gap-3'
        }
      >
        <div className="mobile-logo flex items-center">
          {/* // TODO: Should preserve filter/sort
              // Either injected service? Or context (like react router's `useLocation`?) */}
          <div
            className={classNames('mr-3 inline-flex cursor-pointer items-center')}
            onClick={onClickReturn}
            data-cy="return-to-work-list"
          >
            {/* (
              <a href="/workList">
                <Icon
                  name="chevron-left"
                  className="text-primary-active w-8"
                />
              </a>
            ) */}

            {!isMobile ? (
              // <Link title="Work List" to={`/workList`}>
              <a
                data-id={handleRedirectPage}
                href="javascript:void(0)"
                aria-label={t('Return to Worklist')}
                // onClick={(e) => {
                //   e.preventDefault();
                //   navigate(-1);
                // }}
                className="hover:bg-white/10 focus-visible:ring-accent -ml-1 flex h-9 w-9 items-center justify-center rounded-full transition duration-150 focus:outline-none focus-visible:ring-2"
                onClick={handleRedirectPage}
              >
                <Icon
                  name="chevron-left"
                  className="text-primary-active w-6"
                />
              </a>
            ) : (
              // </Link>

              ''
            )}
            <div className="ml-3">
              {/* {WhiteLabeling?.createLogoComponentFn?.(React, props) || } */}
              {isActive ? (
                <img
                  width="180"
                  height="101"
                  // src="./ohif-logo.svg"
                  src="/ohif-logo.svg"
                  id="imgsource"
                  className="max-h-10 w-auto object-contain"
                />
              ) : (
                <img
                  width="180"
                  height="101"
                  id="imgsource_dark"
                  // src="./ohif-whitebg-logo.svg"
                  src="/ohif-whitebg-logo.svg"
                  className="max-h-10 w-auto object-contain"
                />
              )}
            </div>
          </div>
        </div>
        <div className="mobile-tools flex items-center">{children}</div>
        <div className="flex items-center gap-2">
          {/* <span className="text-common-light mr-3 text-lg">{t('INVESTIGATIONAL USE ONLY 111')}</span> */}
          <span className="text-common-light flex items-center">
            {t('')}
            {screen === 'WorkList' ||
            screen === 'ReportTemplateList' ||
            screen === 'GenerateReport' ? (
              <div className="flex items-center gap-3">
                <ToggleSwitch
                  handleChange={handleChange}
                  IsActive={isActive}
                  screen={screen}
                />
                <div className="secondary-logo">
                  <img src="/bhashyam-infotech-logo.png" />
                </div>
              </div>
            ) : (
              ''
            )}
          </span>

          {menuOptions?.length > 0 && (
            <SettingsMenu
              id="options-settings-icon"
              menuOptions={menuOptions}
              isActive={isActive}
            />
          )}
        </div>
      </div>
    </NavBar>
  );
}

Header.propTypes = {
  menuOptions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      icon: PropTypes.string,
      onClick: PropTypes.func.isRequired,
    })
  ),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  isReturnEnabled: PropTypes.bool,
  isSticky: PropTypes.bool,
  onClickReturnButton: PropTypes.func,
  WhiteLabeling: PropTypes.object,
};

Header.defaultProps = {
  isReturnEnabled: true,
  isSticky: false,
};

export default Header;
