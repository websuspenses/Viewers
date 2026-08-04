/**
 * Builds the Header settings-menu items shared across every page that renders
 * the app shell's <Header> (Worklist, Template Library, Study Review Specialists).
 * Keeping this in one place means the menu looks and behaves the same everywhere
 * instead of each page re-implementing its own subset.
 *
 * @param {object} params
 * @param {(key: string) => string} params.t - translation function (Header namespace)
 * @param {boolean} params.isActive - dark mode state
 * @param {() => void} params.handleChangeSwitch - toggles dark/light mode
 * @param {(path: string) => void} params.navigate - react-router navigate
 * @param {object} params.appConfig - OHIF app config (for the oidc/logout check)
 * @param {string} [params.currentPath] - current route path, used to omit the
 *   "you are here" link from its own page
 * @param {() => void} [params.onProfileClick] - opens the Profile/subscription
 *   modal; omitted entirely if the caller has no way to open it (e.g. no cached
 *   profile data yet)
 * @returns {Array<{ title: string, icon: string, onClick: () => void }>}
 */
export default function getHeaderMenuOptions({
  t,
  isActive,
  handleChangeSwitch,
  navigate,
  appConfig,
  currentPath,
  onProfileClick,
}) {
  const menuOptions = [];

  if (onProfileClick) {
    menuOptions.push({
      title: t('Header:Profile'),
      icon: 'info',
      onClick: onProfileClick,
    });
  }

  if (currentPath !== '/report-templates') {
    menuOptions.push({
      title: t('Header:Predefined Templates'),
      icon: 'templates',
      onClick: () => navigate('/report-templates'),
    });
  }

  if (currentPath !== '/doctor-referrals') {
    menuOptions.push({
      title: t('Header:Doctors Referrals'),
      icon: 'doctorReferrals',
      onClick: () => navigate('/doctor-referrals'),
    });
  }

  menuOptions.push({
    title: t('Header:Dark/Light Mode'),
    icon: isActive ? 'darkModeIcon' : 'lightModeIcon',
    onClick: handleChangeSwitch,
  });

  if (appConfig?.oidc) {
    menuOptions.push({
      icon: 'power-off',
      title: t('Header:Logout'),
      onClick: () => {
        navigate(`/logout?redirect_uri=${encodeURIComponent(window.location.href)}`);
      },
    });
  }

  return menuOptions;
}
