# Buenas Prácticas del Proyecto "naves"

> Este documento define las reglas que deben seguirse en **cualquier tarea de desarrollo**
> sobre este proyecto, ya sea realizada por una persona o por un agente de IA.
> Léelo antes de tocar cualquier archivo.

---

## 1. Pila Tecnológica y Restricciones

| Tecnología | Versión / Notas |
|---|---|
| JavaScript | ES5 vainilla — sin frameworks, sin TypeScript, sin npm |
| HTML | HTML5 |
| CSS | CSS3 |
| Herramientas de compilación | **Ninguna** — abrir `naves.html` directamente en el navegador es suficiente |

**Prohibido agregar:**
- Frameworks (React, Vue, Angular, jQuery, etc.)
- Transpiladores (Babel, TypeScript, etc.)
- Bundlers (Webpack, Vite, Parcel, etc.)
- Gestores de paquetes (npm, yarn) como dependencia de ejecución

---

## 2. Estructura del Proyecto

```
navesp2/
├── naves.html                    ← marcado de la página, carga de recursos
├── css/
│   ├── reset.css                 ← reset de estilos (cargar ANTES de main.css)
│   └── main.css                  ← estilos visuales del juego y la UI
├── js/
│   ├── config.js                 ← constantes de configuración (sin dependencias)
│   ├── utils.js                  ← polyfill + funciones utilitarias puras
│   ├── entities.js               ← constructores: Player, Shot, Enemy, Evil, FinalBoss
│   ├── scores.js                 ← gestión de puntuaciones (localStorage)
│   └── game.js                   ← estado global + game loop + renderizado + UI
├── images/                       ← sprites y fondos (PNG/GIF)
├── BUENAS_PRACTICAS.md           ← este documento
└── README.md                     ← instrucciones de ejecución y controles
```

**Orden de carga obligatorio en `naves.html`:**
```
config.js → utils.js → entities.js → scores.js → game.js
```
Romper este orden produce errores de referencia porque los archivos posteriores
usan funciones y variables declaradas en los anteriores.

**Responsabilidad única de cada archivo:**

| Archivo | Responsabilidad |
|---|---|
| `config.js` | Solo el objeto `CONFIG` con constantes. Sin dependencias. |
| `utils.js` | Polyfill `requestAnimFrame` + funciones puras sin estado del juego |
| `entities.js` | Constructores de entidades (Player, Shot, Enemy, Evil, FinalBoss) |
| `scores.js` | Lectura/escritura de puntuaciones en localStorage y renderizado de tabla |
| `game.js` | Variables de estado global, game loop, renderizado, colisiones, UI |
| `naves.html` | Solo marcado y carga de scripts/estilos; sin lógica JS inline |
| `reset.css` | Solo reset de estilos del navegador |
| `main.css` | Solo estilos visuales; sin lógica de negocio |

**Cómo se comparte el estado entre archivos (sin bundler):**
`game.js` declara todas las variables de estado como globales a nivel de módulo
(`var canvas`, `var evil`, `var player`…). Los archivos anteriores las referencian
en tiempo de ejecución (no de carga), por lo que funcionan correctamente una vez
que todos los scripts han sido evaluados por el navegador al arrancar la página.

---

## 3. Convenciones de Código JavaScript

### 3.1 Nomenclatura

| Elemento | Convención | Ejemplo |
|---|---|---|
| Variables y funciones | `camelCase` en inglés | `playerSpeed`, `createImage` |
| Constantes de configuración | `UPPER_SNAKE_CASE` dentro de `CONFIG` | `CONFIG.PLAYER_LIVES` |
| Clases / Constructores | `PascalCase` | `Player`, `Enemy`, `Shot` |

- **No crear nuevas variables con nombres en español.** Las variables existentes en español se conservan para no romper el historial git.
- Si se renombra una variable existente, actualizar **todos** los sitios de uso en el mismo commit.

### 3.2 Declaraciones de variables

- Siempre declarar variables con `var` (o `function`) — nunca omitir la declaración.
- Las variables de estado del juego viven en `game.js` a nivel de módulo (fuera del IIFE) para
  ser accesibles por `entities.js` y `scores.js`.
- Las funciones utilitarias viven en `utils.js` como funciones globales nombradas.
- El único símbolo global intencionalmente público es `game` (el objeto `{ init: init }`).
- El polyfill `window.requestAnimFrame` es una excepción heredada — no agregar más propiedades a `window`.
- Terminar cada sentencia con punto y coma.

### 3.3 Comparaciones

- Usar siempre `===` y `!==` en lugar de `==` y `!=`.
- Excepción documentada: `== null` cuando se quiere comparar simultáneamente con `null` y `undefined` (debe tener un comentario que lo explique).

### 3.4 Prototipos nativos

- **NUNCA** modificar `Array.prototype`, `Object.prototype` ni ningún otro prototipo nativo.
- Usar funciones utilitarias en `utils.js` como alternativa:
  ```js
  // Correcto (en utils.js):
  function arrayContains(array, element) { ... }
  // Incorrecto:
  Array.prototype.containsElement = function() { ... };
  ```

### 3.5 Dónde declarar código nuevo

| Tipo de código | Dónde va |
|---|---|
| Constante configurable | `config.js` dentro de `CONFIG` |
| Función pura sin estado del juego | `utils.js` |
| Constructor de entidad del juego | `entities.js` |
| Función de puntuaciones / localStorage | `scores.js` |
| Función de game loop, renderizado, UI | `game.js` |
| Variable de estado compartida | `game.js` (nivel de módulo, fuera del IIFE) |

---

## 4. Constantes y Números Mágicos

- Todos los valores numéricos configurables del juego deben definirse en el objeto `CONFIG` en `config.js`.
- Formato: `CONFIG.NOMBRE_DESCRIPTIVO` en `UPPER_SNAKE_CASE`.
- **No escribir literales numéricos directamente** en la lógica del juego.
- Excepción permitida: `0`, `1`, `-1` cuando su significado es inequívoco en contexto (e.g., índices de array, condición de vacío).

**Ejemplo de CONFIG:**
```js
var CONFIG = {
    PLAYER_SPEED: 5,
    PLAYER_LIVES: 3,
    PLAYER_SHOT_DELAY: 250,  // ms entre disparos del jugador
    EVIL_TOTAL: 7,
    BOSS_LIFE: 12,
    TOP_SCORES_TO_SHOW: 5
    // ...
};
```

---

## 5. Manejo de Errores

### 5.1 Carga de imágenes

- Toda imagen debe crearse con la función `createImage(src)` disponible en el proyecto:
  ```js
  function createImage(src) {
      var img = new Image();
      img.onerror = function() {
          console.warn('[naves] No se pudo cargar la imagen: ' + src);
      };
      img.src = src;
      return img;
  }
  ```
- `createImage` registra un warning en consola si la imagen falla pero **no interrumpe el game loop**.
- No bloquear el loop del juego por un error de imagen.

### 5.2 LocalStorage

- Siempre envolver la lectura/escritura de `localStorage` en `try/catch`.
- Ante un error, usar un valor por defecto en lugar de lanzar una excepción.

### 5.3 Entradas del usuario

- Sanitizar el nombre del jugador con `sanitizeName()` antes de usarlo en cualquier parte:
  ```js
  function sanitizeName(name) {
      return (name || '').replace(/[<>&"']/g, '').trim().slice(0, 12) || 'Jugador';
  }
  ```
- El atributo `maxlength` en el HTML es una ayuda visual, **no una garantía de seguridad**.

---

## 6. Seguridad Básica (XSS)

- Usar `element.textContent` para insertar contenido dinámico; **nunca** `innerHTML` con datos del usuario.
- `sanitizeName()` debe usarse **siempre** que se procese input del usuario, incluso si luego se usa `textContent`.
- No confiar en validaciones del lado del cliente como la única barrera de seguridad.

**Correcto:**
```js
finalText.textContent = '¡Ganaste, ' + playerName + '!';
```

**Incorrecto:**
```js
finalText.innerHTML = '¡Ganaste, ' + playerName + '!';  // vulnerable a XSS
```

---

## 7. Rendimiento del Game Loop

- El loop principal corre vía `requestAnimFrame` (~60 fps). No agregar operaciones costosas (acceso a DOM, red, I/O) dentro del loop.
- El doble buffer debe conservarse: dibujar siempre en `bufferctx`, luego volcar en `ctx` al final de cada frame.
- Evitar crear objetos con `new` dentro del loop cuando sea posible — reutilizar instancias existentes.
- Los arrays `playerShotsBuffer` y `evilShotsBuffer` se mutan en lugar de recrearse; conservar ese patrón.

---

## 8. Comentarios y Documentación

### 8.1 JSDoc

Toda función debe tener un bloque JSDoc. Formato mínimo:

```js
/**
 * Descripción breve de lo que hace la función.
 * @param {tipo} nombre - Descripción del parámetro.
 * @returns {tipo} Descripción del valor retornado. Omitir si no retorna nada relevante.
 */
function miFuncion(nombre) { ... }
```

### 8.2 Comentarios de sección

Los comentarios de sección existentes (`// DISPAROS`, `// ENEMIGOS`, etc.) deben conservarse para mantener la navegabilidad del archivo.

### 8.3 Idioma

- Los comentarios nuevos en español son aceptables dado el contexto académico.
- El código nuevo (variables, funciones) preferiblemente en inglés para consistencia futura.

---

## 9. HTML y CSS

- `reset.css` debe cargarse **antes** de `main.css` en el `<head>`.
- No usar estilos en línea (`style=""`) en el HTML; usar clases CSS.
- Los elementos `<a>` sin `href` deben convertirse a `<span>` con una clase CSS equivalente, o deben tener un `href` definido.
- No agregar dependencias externas (CDN, fuentes de Google, etc.) sin consenso explícito.

---

## 10. Control de Versiones (Git)

- Un commit por corrección / paso del plan — no mezclar arreglos no relacionados.
- Mensaje de commit en español, en imperativo: `"Eliminar extensión de Array.prototype"`.
- Verificar que el juego corra en el navegador **antes** de hacer commit.
- No incluir archivos de sistema (`.DS_Store`, `Thumbs.db`) en commits.

---

## 11. Checklist de Verificación Antes de Entregar Cambios

Ejecutar este checklist manualmente en el navegador tras cualquier modificación al código:

- [ ] `naves.html` abre sin errores en la consola del navegador
- [ ] Se puede ingresar nombre y comenzar partida
- [ ] El jugador se mueve con las teclas ←→↑↓ y dispara con la barra espaciadora
- [ ] Los enemigos aparecen, se mueven y disparan
- [ ] Las colisiones funcionan: disparo del jugador mata enemigo; disparo enemigo resta vida
- [ ] El jefe final aparece en la última oleada
- [ ] Al ganar o perder aparece el overlay correcto con el nombre del jugador
- [ ] Los puntajes se guardan en `localStorage` y se muestran en la tabla lateral
- [ ] Ingresar `<b>test</b>` como nombre: el overlay debe mostrar el texto plano, no HTML renderizado
- [ ] La consola no muestra errores (los `[naves] No se pudo cargar...` solo aparecen si se prueba intencionalmente un archivo faltante)

---

## 12. Lista Negra — Antipatrones Prohibidos

El siguiente código **nunca debe introducirse** en este proyecto:

| Prohibido | Alternativa |
|---|---|
| `Array.prototype.X = function() {}` | Función en `utils.js` |
| `window.miVariable = valor` | `var miVariable` en el archivo correspondiente |
| `element.innerHTML = datosDelUsuario` | `element.textContent = datosDelUsuario` |
| `if (x == y)` | `if (x === y)` |
| `if (x != y)` | `if (x !== y)` |
| `new Image()` sin `onerror` | `createImage(src)` |
| Literales numéricos en lógica de juego | `CONFIG.NOMBRE_DESCRIPTIVO` |
| Frameworks o bibliotecas externas | Vanilla JS puro |
| Bundlers o transpiladores | No aplica — abrir HTML directo |
| Reescribir el archivo entero de una sola vez | Cambios incrementales, un commit por paso |
| Renombrar variables masivamente sin migrar todos los usos | Renombrar con búsqueda exhaustiva y un solo commit |

---

*Última actualización: 2026-04-10 — refactorización a múltiples archivos JS*
