/**
 * utils.js — Funciones utilitarias del juego "naves".
 *
 * Sin dependencias de estado del juego: puede cargarse después de config.js
 * y antes de cualquier otro script del juego.
 *
 * Contiene:
 *   - Polyfill requestAnimFrame
 *   - createImage       : crea HTMLImageElement con manejo de errores
 *   - sanitizeName      : sanitiza el nombre del jugador (previene XSS)
 *   - arrayRemove       : elimina elemento de array por índice (muta el array)
 *   - arrayContains     : comprueba si un array contiene un elemento
 *   - fillZero          : formatea números con cero a la izquierda
 *   - getRandomNumber   : entero aleatorio en [0, range)
 *   - addListener       : agrega event listener con compatibilidad IE
 */

// nos marca los pulsos del juego
window.requestAnimFrame = (function () {
    return  window.requestAnimationFrame        ||
        window.webkitRequestAnimationFrame  ||
        window.mozRequestAnimationFrame     ||
        window.oRequestAnimationFrame       ||
        window.msRequestAnimationFrame      ||
        function ( /* function */ callback, /* DOMElement */ element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

/**
 * Crea un objeto Image con su src asignado y un handler de error que registra
 * un warning en consola. Usar siempre en lugar de `new Image()` directamente.
 * @param {string} src - Ruta relativa o absoluta de la imagen.
 * @returns {HTMLImageElement} El elemento imagen con src y onerror configurados.
 */
function createImage(src) {
    var img = new Image();
    img.onerror = function() {
        console.warn('[naves] No se pudo cargar la imagen: ' + src);
    };
    img.src = src;
    return img;
}

/**
 * Sanitiza el nombre del jugador eliminando caracteres HTML peligrosos,
 * recortando espacios y limitando la longitud a 12 caracteres.
 * @param {string} name - El nombre crudo ingresado por el usuario.
 * @returns {string} El nombre sanitizado, o 'Jugador' si queda vacío.
 */
function sanitizeName(name) {
    return (name || '').replace(/[<>&"']/g, '').trim().slice(0, 12) || 'Jugador';
}

/**
 * Elimina un elemento de un array por su índice, mutando el array en lugar
 * de crear uno nuevo. Usado para los buffers de disparos.
 * @param {Array} array - El array a mutar.
 * @param {number} from - El índice del elemento a eliminar (admite negativos).
 * @returns {number} La nueva longitud del array.
 */
function arrayRemove(array, from) {
    var rest = array.slice((from) + 1 || array.length);
    array.length = from < 0 ? array.length + from : from;
    return array.push.apply(array, rest);
}

/**
 * Verifica si un array contiene un elemento dado.
 * Alternativa a Array.prototype para no contaminar prototipos nativos.
 * @param {Array} array - El array a inspeccionar.
 * @param {*} element - El elemento a buscar.
 * @returns {boolean} true si el elemento está en el array, false en caso contrario.
 */
function arrayContains(array, element) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] === element) {
            return true;
        }
    }
    return false;
}

/**
 * Agrega un cero a la izquierda si el número es menor a 10.
 * Usado para formatear fechas como claves de localStorage.
 * @param {number} number - El número a formatear.
 * @returns {string|number} El número con cero inicial si aplica.
 */
function fillZero(number) {
    if (number < 10) {
        return '0' + number;
    }
    return number;
}

/**
 * Genera un entero aleatorio entre 0 (inclusive) y range (exclusive).
 * @param {number} range - El límite superior exclusivo.
 * @returns {number} Entero aleatorio en [0, range).
 */
function getRandomNumber(range) {
    return Math.floor(Math.random() * range);
}

/**
 * Agrega un event listener con compatibilidad IE (attachEvent) y estándar (addEventListener).
 * @param {EventTarget} element - El elemento al que se le agrega el listener.
 * @param {string} type - Tipo de evento (e.g. 'click', 'keydown').
 * @param {Function} expression - El callback del evento.
 * @param {boolean} [bubbling=false] - Si el evento usa fase de burbuja.
 */
function addListener(element, type, expression, bubbling) {
    bubbling = bubbling || false;
    if (window.addEventListener) { // Standard
        element.addEventListener(type, expression, bubbling);
    } else if (window.attachEvent) { // IE
        element.attachEvent('on' + type, expression);
    }
}
