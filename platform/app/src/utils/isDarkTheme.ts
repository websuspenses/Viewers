/**
 * The app's current theme, for components not handed `isActive`: pages mark
 * dark mode on <body> (`bg-black-on`) and persist it as `active_dark`.
 */
export default function isDarkTheme(): boolean {
  if (typeof document !== 'undefined' && document.body.classList.contains('bg-black-on')) {
    return true;
  }
  try {
    return JSON.parse(localStorage.getItem('active_dark') || 'false') === true;
  } catch {
    return false;
  }
}
