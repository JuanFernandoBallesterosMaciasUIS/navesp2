/**
 * scores.js — Gestión de puntuaciones del juego "naves".
 *
 * Depende de:
 *   - config.js  : CONFIG.TOP_SCORES_TO_SHOW, CONFIG.SCORE_LIFE_BONUS
 *   - utils.js   : fillZero, arrayContains
 *   - game.js    : estado global (player, playerName, totalBestScoresToShow)
 *
 * Expone funciones globales usadas por entities.js (saveFinalScore) y
 * por game.js (showBestScores, getTotalScore).
 */

/**
 * Calcula la puntuación final: puntos acumulados + (vidas restantes × CONFIG.SCORE_LIFE_BONUS).
 * @returns {number} La puntuación total de la partida.
 */
function getTotalScore() {
    return player.score + player.life * CONFIG.SCORE_LIFE_BONUS;
}

/**
 * Guarda la puntuación final del jugador en localStorage usando la fecha/hora como clave,
 * actualiza la tabla de mejores puntuaciones y elimina los registros que no estén en el top.
 */
function saveFinalScore() {
    var scoreRecord = { name: playerName || 'Jugador', score: getTotalScore() };
    localStorage.setItem(getFinalScoreDate(), JSON.stringify(scoreRecord));
    showBestScores();
    removeNoBestScores();
}

/**
 * Genera una cadena con la fecha y hora actual formateada como clave única de localStorage.
 * Formato: "DD/MM/AAAA HH:MM:SS"
 * @returns {string} La fecha/hora formateada.
 */
function getFinalScoreDate() {
    var date = new Date();
    return fillZero(date.getDate()) + '/' +
        fillZero(date.getMonth() + 1) + '/' +
        date.getFullYear() + ' ' +
        fillZero(date.getHours()) + ':' +
        fillZero(date.getMinutes()) + ':' +
        fillZero(date.getSeconds());
}

/**
 * Obtiene las claves del localStorage correspondientes al top CONFIG.TOP_SCORES_TO_SHOW,
 * ordenadas de mayor a menor puntuación.
 * @returns {string[]} Array de claves (fechas) de las mejores puntuaciones.
 */
function getBestScoreKeys() {
    var allScores = getAllScores();
    allScores.sort(function (a, b) { return b.score - a.score; });
    allScores = allScores.slice(0, totalBestScoresToShow);
    return allScores.map(function (item) { return item.key; });
}

/**
 * Lee todos los registros de puntuaciones desde localStorage.
 * Soporta tanto el formato JSON {name, score} como el formato legado (número plano).
 * @returns {{key: string, score: number, name: string}[]} Array con todos los registros.
 */
function getAllScores() {
    var all = [];
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var value = localStorage.getItem(key);
        try {
            var record = JSON.parse(value);
            if (record && !isNaN(record.score)) {
                all.push({ key: key, score: parseInt(record.score, 10), name: record.name || 'Jugador' });
                continue;
            }
        } catch (e) {
            // Ignorar registros no JSON
        }
        if (!isNaN(parseInt(value, 10))) {
            all.push({ key: key, score: parseInt(value, 10), name: 'Jugador' });
        }
    }
    return all;
}

/**
 * Rellena una tabla de puntuaciones a partir de sus claves ordenadas.
 * @param {HTMLElement} tbody - El elemento tbody a rellenar.
 * @param {string[]} bestScores - Claves ordenadas del localStorage.
 */
function renderScoresTable(tbody, bestScores) {
    if (!tbody) { return; }
    tbody.innerHTML = '';
    for (var i = 0; i < bestScores.length; i++) {
        var record;
        try {
            record = JSON.parse(localStorage.getItem(bestScores[i]));
        } catch (e) {
            record = null;
        }
        if (!record) {
            var fallbackScore = parseInt(localStorage.getItem(bestScores[i]), 10);
            record = { name: 'Jugador', score: isNaN(fallbackScore) ? 0 : fallbackScore };
        }
        var row = document.createElement('tr');
        if (i === 0) { row.className = 'podium-1'; }
        else if (i === 1) { row.className = 'podium-2'; }
        else if (i === 2) { row.className = 'podium-3'; }
        var medal = '';
        if (i === 0) { medal = '🥇 '; }
        else if (i === 1) { medal = '🥈 '; }
        else if (i === 2) {
            medal = '🥉 ';
        }
        row.appendChild(createCell(record.name));
        row.children[0].textContent = medal + row.children[0].textContent;
        row.appendChild(createCell(record.score));
        tbody.appendChild(row);
    }
}

/**
 * Renderiza las tablas de mejores puntuaciones (#puntuaciones y #puntuacionesGameOver).
 * Limpia y reconstruye las filas con medallas para los 3 primeros puestos.
 */
function showBestScores() {
    var bestScores = getBestScoreKeys();
    renderScoresTable(document.querySelector('#puntuaciones tbody'), bestScores);
    renderScoresTable(document.querySelector('#puntuacionesGameOver tbody'), bestScores);
    renderScoresTable(document.querySelector('#puntuacionesGame tbody'), bestScores);
}

/**
 * Crea una celda de tabla (<td>) con contenido de texto seguro.
 * @param {string|number} content - El contenido de la celda.
 * @returns {HTMLTableCellElement} El elemento <td> creado.
 */
function createCell(content) {
    var cell = document.createElement('td');
    cell.textContent = content;
    return cell;
}

/**
 * Elimina del localStorage todos los registros que no estén en el top CONFIG.TOP_SCORES_TO_SHOW.
 * Evita que el almacenamiento crezca indefinidamente.
 */
function removeNoBestScores() {
    var scoresToRemove = [];
    var bestScoreKeys = getBestScoreKeys();
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!arrayContains(bestScoreKeys, key)) {
            scoresToRemove.push(key);
        }
    }
    for (var j = 0; j < scoresToRemove.length; j++) {
        localStorage.removeItem(scoresToRemove[j]);
    }
}
