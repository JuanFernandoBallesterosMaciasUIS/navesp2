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
    EVIL_BASE_LIFE: 3,
    EVIL_TOTAL: 7,
    EVIL_MIN_HORIZONTAL_OFFSET: 100,
    EVIL_MAX_HORIZONTAL_OFFSET: 400,
    EVIL_ANIMATION_INTERVAL: 5,   // frames entre cambio de sprite de animación
    EVIL_ANIMATION_FRAMES: 8,     // total de frames en la animación
    EVIL_OFFSCREEN_MARGIN: 15,    // px fuera de pantalla antes de considerar al enemigo "salido"
    // Jefe final
    BOSS_LIFE: 12,
    BOSS_SHOTS: 30,
    BOSS_POINTS: 20,
    // Puntuaciones
    TOP_SCORES_TO_SHOW: 5,
    SCORE_LIFE_BONUS: 5,          // puntos extra por vida restante al ganar
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
            speedMultiplier: 0.7,
            totalEnemies: 6,
            baseLife: 3,
            baseShots: 4
        },
        2: {
            name: 'NIVEL 2',
            speedMultiplier: 1,
            totalEnemies: 9,
            baseLife: 4,
            baseShots: 5
        },
        3: {
            name: 'NIVEL 3',
            speedMultiplier: 1.1,
            totalEnemies: 12,
            baseLife: 5,
            baseShots: 6
        },
        4: {
            name: 'JEFE FINAL',
            speedMultiplier: 1.3,
            totalEnemies: 1,
            baseLife: 6,
            baseShots: 7,
            isBossLevel: true
        }
    },
    LEVEL_TRANSITION_DELAY: 3000  // ms antes de mostrar el siguiente nivel
};
