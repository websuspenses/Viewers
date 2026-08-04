import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import classnames from 'classnames';
import Select from '../Select';
import Typography from '../Typography';
import Button from '../Button';
import HotkeysPreferences from '../HotkeysPreferences';
import { ButtonEnums } from '../Button';

const UserPreferences = ({
  availableLanguages,
  defaultLanguage,
  currentLanguage,
  disabled,
  hotkeyDefinitions,
  hotkeyDefaults,
  onCancel,
  onSubmit,
  onReset,
  hotkeysModule,
  isActive,
}) => {
  const { t } = useTranslation('UserPreferencesModal');
  const [state, setState] = useState({
    isDisabled: disabled,
    hotkeyErrors: {},
    hotkeyDefinitions,
    language: currentLanguage,
  });

  const onSubmitHandler = () => {
    onSubmit(state);
  };

  const onResetHandler = () => {
    setState(state => ({
      ...state,
      language: defaultLanguage,
      hotkeyDefinitions: hotkeyDefaults,
      hotkeyErrors: {},
      isDisabled: disabled,
    }));
    onReset();
  };

  const onCancelHandler = () => {
    setState({ hotkeyDefinitions });
    onCancel();
  };

  const onLanguageChangeHandler = value => {
    setState(state => ({ ...state, language: value }));
  };

  const onHotkeysChangeHandler = (id, definition, errors) => {
    setState(state => ({
      ...state,
      isDisabled: Object.values(errors).every(e => e !== undefined),
      hotkeyErrors: errors,
      hotkeyDefinitions: {
        ...state.hotkeyDefinitions,
        [id]: definition,
      },
    }));
  };

  const Section = ({ title, children }) => (
    <div className="mb-8 last:mb-0">
      <div
        className={classnames(
          'mb-4 flex items-baseline justify-between border-b pb-2',
          isActive ? 'border-border-subtleDark' : 'border-border-subtle'
        )}
      >
        <Typography
          variant="inherit"
          color={isActive ? 'primaryLight_darkMode' : 'primaryLight'}
          className="flex text-[15px] font-semibold uppercase tracking-wide !leading-[1.2]"
        >
          {title}
        </Typography>
      </div>
      <div className={isActive ? 'text-white-aboutCls' : ''}>{children}</div>
    </div>
  );

  return (
    <>
      <Section title={t('General')}>
        <div className="flex flex-row items-center gap-4">
          <Typography
            variant="subtitle"
            className={classnames('w-24 shrink-0', isActive ? 'text-white-aboutCls' : '')}
          >
            {t('Language')}
          </Typography>
          <Select
            isClearable={false}
            onChange={onLanguageChangeHandler}
            options={availableLanguages}
            value={state.language}
            className="SelectCls w-56"
          />
        </div>
      </Section>
      <Section title={t('Hotkeys')}>
        <HotkeysPreferences
          disabled={disabled}
          hotkeyDefinitions={state.hotkeyDefinitions}
          onChange={onHotkeysChangeHandler}
          errors={state.hotkeyErrors}
          hotkeysModule={hotkeysModule}
        />
      </Section>
      <div
        className={classnames(
          'mt-6 flex flex-row items-center justify-between border-t pt-4',
          isActive ? 'border-border-subtleDark' : 'border-border-subtle'
        )}
      >
        <Button
          type={ButtonEnums.type.secondary}
          onClick={onResetHandler}
          disabled={disabled}
          className={isActive ? "bg-customblue-50_prefernceModal" : ""}
        >
          {t('Reset to Defaults')}
        </Button>
        <div className="flex flex-row gap-2">
          <Button
            type={ButtonEnums.type.secondary}
            onClick={onCancelHandler}
            className={isActive ? "bg-customblue-50_prefernceModal" : ""}
          >
            {t('Cancel')}
          </Button>
          <Button
            disabled={state.isDisabled}
            onClick={onSubmitHandler}
          >
            {t('Save')}
          </Button>
        </div>
      </div>
    </>
  );
};

const noop = () => { };

UserPreferences.propTypes = {
  disabled: PropTypes.bool,
  hotkeyDefaults: PropTypes.object.isRequired,
  hotkeyDefinitions: PropTypes.object.isRequired,
  languageOptions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.any.isRequired,
    })
  ),
  onCancel: PropTypes.func,
  onSubmit: PropTypes.func,
  onReset: PropTypes.func,
  hotkeysModule: PropTypes.shape({
    initialize: PropTypes.func.isRequired,
    pause: PropTypes.func.isRequired,
    unpause: PropTypes.func.isRequired,
    startRecording: PropTypes.func.isRequired,
    record: PropTypes.func.isRequired,
  }).isRequired,
  isActive: PropTypes.bool,
};

UserPreferences.defaultProps = {
  languageOptions: [
    { value: 'ONE', label: 'ONE' },
    { value: 'TWO', label: 'TWO' },
  ],
  onCancel: noop,
  onSubmit: noop,
  onReset: noop,
  disabled: false,
};

export default UserPreferences;
