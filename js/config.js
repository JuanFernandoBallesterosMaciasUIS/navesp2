/**
 * config.js — Constantes de configuración del juego "naves".
 *
 * Modificar este archivo para ajustar parámetros del juego sin tocar la lógica.
 * No tiene dependencias: puede cargarse primero entre todos los scripts.
 */

var CONFIG = {
    // Jugador
    PLAYER_SPEED: 5,
    PLAYER_LIVES: 3,
    PLAYER_SHOT_DELAY: 250,       // ms mínimos entre disparos del jugador
    PLAYER_MARGIN_BOTTOM: 10,     // px de margen desde el borde inferior
    PLAYER_DEFAULT_HEIGHT: 66,    // px altura por defecto mientras carga la imagen
    PLAYER_BOUNDARY_PADDING: 5,   // px de margen en los bordes laterales
    // Disparos
    SHOT_SPEED: 5,
    // Enemigos regulares
    EVIL_BASE_SPEED: 1,
    EVIL_BASE_SHOTS: 5,
    EVIL_BASE_LIFE: 2,  // Reducida de 3 para múltiples enemigos simultáneos
    EVIL_TOTAL: 7,
    EVIL_MIN_HORIZONTAL_OFFSET: 100,
    EVIL_MAX_HORIZONTAL_OFFSET: 400,
    EVIL_ANIMATION_INTERVAL: 5,   // frames entre cambio de sprite de animación
    EVIL_ANIMATION_FRAMES: 8,     // total de frames en la animación
    EVIL_OFFSCREEN_MARGIN: 15,    // px fuera de pantalla antes de considerar al enemigo "salido"
    // Jefe final
    BOSS_LIFE: 12,
    BOSS_SHOTS: 100,
    BOSS_POINTS: 20,
    // Estrellita - Enemigo especial
    STAR_LIFE: 3,  // Reducida de 4 para múltiples enemigos simultáneos
    STAR_SHOTS: 100,
    STAR_POINTS: 15,
    // Cangrejo - Enemigo con movimiento libre
    CRAB_LIFE: 2,  // Reducida de 3 para múltiples enemigos simultáneos
    CRAB_SHOTS: 100,
    CRAB_POINTS: 10,
    CRAB_ANIMATION_FRAMES: 6,  // Número de frames de animación
    // Puntuaciones
    TOP_SCORES_TO_SHOW: 5,
    SCORE_LIFE_BONUS: 5,          // puntos extra por vida restante al ganar
    MIN_PANEL_WIDTH: 200,         // px mínimos reservados para cada panel lateral
    // Tiempos (ms)
    RESPAWN_DELAY: 500,           // ms antes de reanimar al jugador tras morir
    NEW_EVIL_MAX_DELAY: 3000,     // ms máximos de espera antes de crear nuevo enemigo
    EVIL_FIRST_SHOT_BASE: 1000,   // ms base antes del primer disparo del enemigo
    EVIL_FIRST_SHOT_EXTRA: 2500,  // ms aleatorios extra para el primer disparo
    EVIL_SHOT_INTERVAL: 3000,     // ms máximos entre disparos sucesivos del enemigo
    CONGRATS_DELAY: 2000,         // ms de animación antes de mostrar overlay de victoria
    CONGRATS_OVERLAY_DELAY: 2000, // ms de espera dentro del overlay de victoria
    // Configuración de niveles
    LEVELS: {
        1: {
            name: 'NIVEL 1',
            speedMultiplier: 1,
            totalEnemies: 3,
            baseLife: 3,
            baseShots: 40
        },
        2: {
            name: 'NIVEL 2',
            speedMultiplier: 1.2,
            totalEnemies: 7,
            baseLife: 4,
            baseShots: 50
        },
        3: {
            name: 'NIVEL 3',
            speedMultiplier: 1.5,
            totalEnemies: 9,
            baseLife: 5,
            baseShots: 50
        },
        4: {
            name: 'JEFE FINAL',
            speedMultiplier: 1.5,
            totalEnemies: 1,
            baseLife: 6,
            baseShots: 50,
            isBossLevel: true
        }
    },
    LEVEL_TRANSITION_DELAY: 3000,  // ms antes de mostrar el siguiente nivel
    // Poderes
    POWER_SPAWN_CHANCE: 0.4,      // probabilidad de que aparezca un poder (0-1)
    POWER_DURATION: 10000,          // duración en ms de los poderes temporales
    POWER_MAX_LIVES: 3             // máximo de vidas que puede tener el jugador
};
