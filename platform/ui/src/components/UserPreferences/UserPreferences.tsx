import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Select from '../Select';
import HotkeysPreferences from '../HotkeysPreferences';

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

  // Styles: Modal/ciai-dialog.css (the modal shell carries the theme).
  const Section = ({ title, children }) => (
    <section className="ciai-section">
      <p className="ciai-section-title">{title}</p>
      {children}
    </section>
  );

  return (
    <>
      <Section title={t('General')}>
        <div className="ciai-pref-row">
          <span>{t('Language')}</span>
          <Select
            isClearable={false}
            onChange={onLanguageChangeHandler}
            options={availableLanguages}
            value={state.language}
            className="SelectCls w-56"
            isActive={!!isActive}
          />
        </div>
      </Section>
      <Section title={t('Hotkeys')}>
        <div className="ciai-hotkeys">
          <HotkeysPreferences
            disabled={disabled}
            hotkeyDefinitions={state.hotkeyDefinitions}
            onChange={onHotkeysChangeHandler}
            errors={state.hotkeyErrors}
            hotkeysModule={hotkeysModule}
          />
        </div>
      </Section>
      <div className="ciai-modal__foot">
        <button
          type="button"
          className="ciai-btn ciai-btn--ghost"
          onClick={onResetHandler}
          disabled={disabled}
        >
          {t('Reset to Defaults')}
        </button>
        <span className="ciai-spacer" />
        <button
          type="button"
          className="ciai-btn"
          onClick={onCancelHandler}
        >
          {t('Cancel')}
        </button>
        <button
          type="button"
          className="ciai-btn ciai-btn--primary"
          disabled={state.isDisabled}
          onClick={onSubmitHandler}
        >
          {t('Save')}
        </button>
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
