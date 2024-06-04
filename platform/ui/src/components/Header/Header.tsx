import React, { ReactNode, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import NavBar from '../NavBar';
import Svg from '../Svg';
import Icon from '../Icon';
import IconButton from '../IconButton';
import Dropdown from '../Dropdown';

import { ToggleSwitch } from '@ohif/ui';

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
  ...props
}): ReactNode {
  const { t } = useTranslation('Header');

  // TODO: this should be passed in as a prop instead and the react-router-dom
  // dependency should be dropped
  const onClickReturn = () => {
    if (isReturnEnabled && onClickReturnButton) {
      onClickReturnButton();
    }
  };

  const originUrl = window.location.href;
  const path = originUrl.replace(`/generate-report/${modalityValue}`, '/');

  return (
    <NavBar
      className="justify-between border-b-4 border-black"
      isSticky={isSticky}
      isActive={isActive}
      screen={screen}
    >
      <div
        //className="flex flex-1 justify-between"
        className={
          isActive ? 'navbarAlignCls flex flex-1 justify-between' : 'flex flex-1 justify-between'
        }
      >
        <div className="flex items-center">
          {/* // TODO: Should preserve filter/sort
              // Either injected service? Or context (like react router's `useLocation`?) */}
          <div
            className={classNames(
              'mr-3 inline-flex items-center',
              isReturnEnabled && 'cursor-pointer'
            )}
            onClick={onClickReturn}
            data-cy="return-to-work-list"
          >
            {isReturnEnabled && (
              <a href="/workList">
                <Icon
                  name="chevron-left"
                  className="text-primary-active w-8"
                />
              </a>
            )}
            <div className="ml-4">
              {/* {WhiteLabeling?.createLogoComponentFn?.(React, props) || } */}
              {isActive ? (
                <img
                  width="250"
                  height="140"
                  // src="./ohif-logo.svg"
                  src={screen === 'GenerateReport' ? path + './ohif-logo.svg' : '/ohif-logo.svg'}
                  id="imgsource"
                />
              ) : (
                <img
                  width="250"
                  height="140"
                  id="imgsource_dark"
                  // src="./ohif-whitebg-logo.svg"
                  src={
                    screen === 'GenerateReport'
                      ? path + './ohif-whitebg-logo.svg'
                      : '/ohif-whitebg-logo.svg'
                  }
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center">{children}</div>
        {/* <div ><ToggleSwitch handleChange={handleChange} IsActive={isActive}  /></div> */}

        <div className="flex items-center">
          {/* <span className="text-common-light mr-3 text-lg">{t('INVESTIGATIONAL USE ONLY 111')}</span> */}
          <span className="text-common-light mr-3 text-lg">
            {t('')}
            {screen === 'WorkList' ||
              screen === 'ReportTemplateList' ||
              screen === 'GenerateReport' ? (
              <div>
                <ToggleSwitch
                  handleChange={handleChange}
                  IsActive={isActive}
                  screen={screen}
                />
              </div>
            ) : (
              ''
            )}
          </span>

          {screen === 'WorkList' ? (
            <Dropdown
              id="options"
              showDropdownIcon={false}
              list={menuOptions}
              alignment="right"
              isActive={isActive}
            >
              <IconButton
                id={'options-settings-icon'}
                variant="text"
                color="inherit"
                size="initial"
                className={isActive ? 'text-primary-active-dark' : 'text-primary-active'}
              >
                <Icon name="settings" />
              </IconButton>
              <IconButton
                id={'options-chevron-down-icon'}
                variant="text"
                color="inherit"
                size="initial"
                className={isActive ? 'text-primary-active-dark' : 'text-primary-active'}
              >
                <Icon name="chevron-down" />
              </IconButton>
            </Dropdown>
          ) : (
            ''
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