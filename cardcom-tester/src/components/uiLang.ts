export type UiLang = 'en' | 'he'

// Same key the walkthrough used before the toggle moved to the app header,
// so an earlier choice carries over.
const KEY = 'guided-lang'

export function loadUiLang(): UiLang {
  // A ?lang= in the URL outranks the stored choice: an embedding app (the
  // GateOpen guide sheet) passes its own current language on every open,
  // so the walkthrough follows the app instead of a stale earlier toggle.
  // Not persisted -- a direct visit later still gets the visitor's own
  // last manual choice.
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang')
    if (fromUrl === 'he' || fromUrl === 'en') return fromUrl
  } catch {
    // no URL access (very old browser) -- fall through to storage
  }
  try {
    return window.localStorage.getItem(KEY) === 'he' ? 'he' : 'en'
  } catch {
    return 'en'
  }
}

export function saveUiLang(lang: UiLang) {
  try {
    window.localStorage.setItem(KEY, lang)
  } catch {
    // Private windows can reject storage -- the toggle still works.
  }
}
