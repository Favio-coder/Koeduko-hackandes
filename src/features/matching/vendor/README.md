# Blossom

`blossom.js` proviene de `edmonds-blossom@1.0.0`, de Matt Krick, licencia MIT.
Fuente: https://github.com/mattkrick/EdmondsBlossom

Se conserva el algoritmo y su licencia. Se adaptó la exportación CommonJS a ESM y se declararon las variables locales `b`, `path` y `v` que el original dejaba globales; ESM exige modo estricto. No se añadieron dependencias al proyecto. La validación contrasta el resultado con enumeración exhaustiva en problemas pequeños.
