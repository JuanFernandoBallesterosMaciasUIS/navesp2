/**
 * achievements.js — Sistema de logros del juego "naves".
 *
 * Depende de (deben cargarse antes):
 *   - config.js : CONFIG
 *
 * Expone funciones globales usadas por game.js:
 *   - loadAchievements()       : cargar desde localStorage al iniciar
 *   - resetSessionStats()      : reiniciar contadores de sesión al iniciar partida
 *   - onEnemyKilled()          : llamar cada vez que muere un enemigo
 *   - onPlayerDamaged()        : llamar cuando el jugador pierde una vida
 *   - onLevelChanged(n, lives) : llamar al cambiar de nivel
 *   - onVictory(lives)         : llamar cuando el jugador gana
 *   - renderAchievementsMenu() : renderizar la pantalla de logros
 */

/******************************* DEFINICIÓN DE LOGROS *******************************/

var ACHIEVEMENTS_DEF = [
    {
        id:   'first_kill',
        icon:  '🎯',
        title: 'Primera Sangre',
        desc:  'Elimina tu primer enemigo'
    },
    {
        id:   'kill_10',
        icon:  '💥',
        title: 'Artillero',
        desc:  'Elimina 10 enemigos en una misma partida'
    },
    {
        id:   'no_damage_l1',
        icon:  '🛡️',
        title: 'Sin un Rasguño',
        desc:  'Supera el Nivel 1 sin perder ninguna vida'
    },
    {
        id:   'reach_l2',
        icon:  '⚡',
        title: 'Escalando',
        desc:  'Llega al Nivel 2'
    },
    {
        id:   'reach_l3',
        icon:  '🔥',
        title: 'En Llamas',
        desc:  'Llega al Nivel 3'
    },
    {
        id:   'reach_boss',
        icon:  '👑',
        title: 'Cara a Cara',
        desc:  'Llega al Jefe Final'
    },
    {
        id:   'beat_boss',
        icon:  '🏆',
        title: 'Rey del Universo',
        desc:  'Vence al Jefe Final y salva la galaxia'
    },
    {
        id:   'score_50',
        icon:  '💰',
        title: 'Buen Botín',
        desc:  'Alcanza 50 puntos en una partida'
    },
    {
        id:   'perfect',
        icon:  '⭐',
        title: 'Impecable',
        desc:  'Gana el juego sin perder ninguna vida'
    },
    {
        id:   'resilient',
        icon:  '💪',
        title: 'Resiliente',
        desc:  'Sigue luchando con solo 1 vida restante'
    }
];

/******************************* ESTADO *******************************/

var unlockedAchievements = {};
var sessionKills         = 0;   // enemigos eliminados en la partida actual
var sessionDamaged       = false; // si el jugador recibió daño en el nivel 1

/******************************* PERSISTENCIA *******************************/

function loadAchievements() {
    try {
        var saved = localStorage.getItem('naves_achievements');
        if (saved) {
            unlockedAchievements = JSON.parse(saved);
        } else {
            unlockedAchievements = {};
        }
    } catch (e) {
        unlockedAchievements = {};
    }
}

function saveAchievements() {
    try {
        localStorage.setItem('naves_achievements', JSON.stringify(unlockedAchievements));
    } catch (e) { /* localStorage no disponible */ }
}

/******************************* DESBLOQUEO *******************************/

function unlockAchievement(id) {
    if (unlockedAchievements[id]) { return; } // ya obtenido
    unlockedAchievements[id] = true;
    saveAchievements();
    var achiev = null;
    for (var i = 0; i < ACHIEVEMENTS_DEF.length; i++) {
        if (ACHIEVEMENTS_DEF[i].id === id) {
            achiev = ACHIEVEMENTS_DEF[i];
            break;
        }
    }
    if (achiev) {
        showAchievementToast(achiev);
    }
}

/******************************* TOAST EN PANTALLA *******************************/

var toastTimer = null;

function showAchievementToast(achiev) {
    var toast = document.getElementById('achievementToast');
    if (!toast) { return; }
    document.getElementById('achievToastIcon').textContent  = achiev.icon;
    document.getElementById('achievToastTitle').textContent = achiev.title;
    document.getElementById('achievToastDesc').textContent  = achiev.desc;

    // Limpiar timer anterior si estaba activo
    if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
    }

    toast.classList.remove('hidden', 'achiev-toast-out');
    toast.classList.add('achiev-toast-in');

    toastTimer = setTimeout(function () {
        toast.classList.remove('achiev-toast-in');
        toast.classList.add('achiev-toast-out');
        toastTimer = setTimeout(function () {
            toast.classList.add('hidden');
            toast.classList.remove('achiev-toast-out');
            toastTimer = null;
        }, 500);
    }, 3200);
}

/******************************* COMPROBACIONES *******************************/

function resetSessionStats() {
    sessionKills   = 0;
    sessionDamaged = false;
}

function onEnemyKilled() {
    sessionKills++;
    unlockAchievement('first_kill');
    if (sessionKills >= 10) {
        unlockAchievement('kill_10');
    }
    // Comprobar puntos (player es global de game.js)
    if (typeof player !== 'undefined' && player && player.score >= 50) {
        unlockAchievement('score_50');
    }
}

function onPlayerDamaged() {
    sessionDamaged = true;
    // Resiliente: sigue jugando con 1 vida
    if (typeof player !== 'undefined' && player && player.life === 1) {
        unlockAchievement('resilient');
    }
}

function onLevelChanged(newLevel, livesAtChange) {
    if (newLevel === 2) {
        unlockAchievement('reach_l2');
        if (!sessionDamaged) {
            unlockAchievement('no_damage_l1');
        }
        // Reiniciar el flag de daño para el nuevo nivel
        sessionDamaged = false;
    }
    if (newLevel === 3) {
        unlockAchievement('reach_l3');
        sessionDamaged = false;
    }
    if (newLevel === 4) {
        unlockAchievement('reach_boss');
        sessionDamaged = false;
    }
}

function onVictory(livesRemaining) {
    unlockAchievement('beat_boss');
    if (livesRemaining === CONFIG.PLAYER_LIVES) {
        unlockAchievement('perfect');
    }
}

/******************************* RENDER EN MENÚ *******************************/

function renderAchievementsMenu() {
    var container = document.getElementById('achievementsListContainer');
    if (!container) { return; }
    container.innerHTML = '';
    var unlocked = 0;
    for (var i = 0; i < ACHIEVEMENTS_DEF.length; i++) {
        var a    = ACHIEVEMENTS_DEF[i];
        var done = !!unlockedAchievements[a.id];
        if (done) { unlocked++; }
        var div  = document.createElement('div');
        div.className = 'achiev-item' + (done ? ' achiev-unlocked' : ' achiev-locked');
        div.innerHTML =
            '<span class="achiev-item-icon">' + (done ? a.icon : '🔒') + '</span>' +
            '<div class="achiev-item-text">' +
                '<span class="achiev-item-title">' + (done ? a.title : '???') + '</span>' +
                '<span class="achiev-item-desc">'  + (done ? a.desc  : 'Sigue jugando para descubrirlo') + '</span>' +
            '</div>';
        container.appendChild(div);
    }
    // Contador
    var counter = document.getElementById('achievementsCounter');
    if (counter) {
        counter.textContent = unlocked + ' / ' + ACHIEVEMENTS_DEF.length + ' logros desbloqueados';
    }
}
