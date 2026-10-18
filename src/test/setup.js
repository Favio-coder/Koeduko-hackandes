import '@testing-library/jest-dom/vitest'
/* jsdom no implementa `matchMedia`, que SweetAlert2 usa para elegir el icono
   y las animaciones. */
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })
}
