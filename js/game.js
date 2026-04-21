/**
 * game.js — Núcleo del juego "naves": estado, game loop, renderizado,
 * detección de colisiones y gestión de niveles.
 *
 * Depende de (deben cargarse antes, en este orden):
 *   1. config.js   : CONFIG
 *   2. utils.js    : requestAnimFrame, createImage, sanitizeName, addListener, getRandomNumber
 *   3. entities.js : Player, Shot, PlayerShot, EvilShot, Enemy, Evil, FinalBoss
 *   4. scores.js   : saveFinalScore, showBestScores, getTotalScore
 *
 * Expone como global:
 *   - game.init()  : punto de entrada llamado desde body onload="game.init()"
 *
 * Expone como globales (necesarias por entities.js):
 *   - canvas, player, evil, y demás variables de estado
 *   - verifyToCreateNewEvil(), createNewEvil(), showOverlay()
 */

/******************************* ESTADO GLOBAL *******************************/
// Variables de estado accesibles por entities.js y scores.js.
// Se inicializan con valores de CONFIG y se reinician en resetGameState().

var canvas, ctx, buffer, bufferctx;
var player, evil, playerShot;
var bgMain, bgBoss;

var evilSpeed     = CONFIG.EVIL_BASE_SPEED;
var totalEvils    = CONFIG.EVIL_TOTAL;
var playerLife    = CONFIG.PLAYER_LIVES;
var shotSpeed     = CONFIG.SHOT_SPEED;
var playerSpeed   = CONFIG.PLAYER_SPEED;
var evilCounter   = 0;
var youLose       = false;
var congratulations = false;
var currentLevel  = 1;  // Variable para el nivel actual

var minHorizontalOffset = CONFIG.EVIL_MIN_HORIZONTAL_OFFSET;
var maxHorizontalOffset = CONFIG.EVIL_MAX_HORIZONTAL_OFFSET;
var evilShots         = CONFIG.EVIL_BASE_SHOTS;
var evilLife          = CONFIG.EVIL_BASE_LIFE;
var finalBossShots    = CONFIG.BOSS_SHOTS;
var finalBossLife     = CONFIG.BOSS_LIFE;
var totalBestScoresToShow = CONFIG.TOP_SCORES_TO_SHOW;

var playerShotsBuffer = [];
var evilShotsBuffer   = [];
var powersBuffer      = [];    // Buffer para los poderes que caen
var evilShotImage, playerShotImage, playerKilledImage, powerVidaImage, powerDisparoImage, powerEscudoImage;

var evilImages  = { animation: [], killed: null };
var bossImages  = { animation: [], killed: null };

var backgroundAudio = null;  // Variable para el sonido de fondo
var backgroundAudioPaused = false;  // Variable para rastrear si el sonido está pausado
var currentTrack = 'Sonidos/Melodia_1.mp3';  // Melodía activa

var keyPressed = {};
var keyMap = {
    left:  37,
    right: 39,
    fire:  32,    // tecla espacio
    pause: 27     // tecla ESC
};

var nextPlayerShot  = 0;
var playerShotDelay = CONFIG.PLAYER_SHOT_DELAY;
var now             = 0;
var playerName      = '';

// Control de efectos de poderes
var doubleFireActive = false;
var doubleFireTimeout = null;
var shieldActive = false;
var shieldTimeout = null;
var lifeEffectActive = false;
var lifeEffectTimeout = null;
var originalPlayerSpeed = CONFIG.PLAYER_SPEED;

var overlay, startContent, endContent, pauseContent, mainMenuContent, tutorialContent, optionsContent, gameOverContent, victoryContent;
var especificacionesContent, mainMenuScoresPanel;
var gameLeftPanel, gameScoresPanel, mainMenuLeftPanel;
var logrosContent, logrosButton, backFromLogrosButton;
var nameInput, startButton, restartButton, resumeButton, exitButton, finalText;
var playButton, backButton, tutorialButton, optionsButton, quitButton, especificacionesButton;
var backFromTutorialButton, backFromOptionsButton, backFromEspecificacionesButton;
var gameOverRestartButton, gameOverMenuButton, victoryRestartButton, victoryMenuButton;
var pauseButton, restartLevelBtn, soundToggleBtn;  // Botones de control
var finalAnimationTick = 0;
var gameStarted = false;
var gamePaused = false;
var levelTransitionActive = false;  // Variable para controlar la transición de nivel
var transitionStartTime = 0;  // Tiempo de inicio de la transición
var transitionProgress = 0;   // Progreso de la transición (0 a 1)

// Variables para el efecto de penalización por enemigo escapado
var playerSlowed = false;
var slowedEndTime = 0;
var SLOWDOWN_DURATION = 3000;  // Duración del efecto en milisegundos
var SLOWDOWN_MULTIPLIER = 0.4;  // Velocidad reduce al 40%

/**
 * Aplica la penalización por enemigo escapado: lentitud, pantalla roja y sonido de alerta.
 * Reduce la velocidad del jugador al 40% durante 3 segundos.
 */
function applySlowdownPenalty() {
    if (!playerSlowed) {
        playerSlowed = true;
        slowedEndTime = Date.now() + SLOWDOWN_DURATION;
        playSound('Sonidos/Alerta.mp3', 0.9);
    }
}

/**
 * Verifica si el efecto de lentitud ha terminado y restaura la velocidad.
 */
function updateSlowdownEffect() {
    if (playerSlowed && Date.now() >= slowedEndTime) {
        playerSlowed = false;
    }
}

/**
 * Dibuja un overlay rojo semi-transparente cuando el jugador está ralentizado.
 */
function drawSlowdownOverlay() {
    if (playerSlowed) {
        bufferctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Texto de advertencia
        bufferctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        bufferctx.font = 'bold 20px Arial';
        bufferctx.textAlign = 'center';
        bufferctx.fillText('¡LENTO!', canvas.width / 2, 60);
        bufferctx.textAlign = 'left';
    }
}

/******************************* CARGA DE IMÁGENES *******************************/

/**
 * Precarga todas las imágenes del juego antes de que empiece la partida.
 * Almacena las imágenes en las variables de estado globales.
 */
function preloadImages() {
    for (var i = 1; i <= 8; i++) {
        evilImages.animation[i - 1] = createImage('images/malo' + i + '.png');
        bossImages.animation[i - 1] = createImage('images/jefe' + i + '.png');
    }
    evilImages.killed  = createImage('images/malo_muerto.png');
    bossImages.killed  = createImage('images/jefe_muerto.png');
    bgMain             = createImage('images/fondovertical.png');
    bgBoss             = createImage('images/fondovertical_jefe.png');
    playerShotImage    = createImage('images/disparo_bueno.png');
    evilShotImage      = createImage('images/disparo_malo.png');
    playerKilledImage  = createImage('images/bueno_muerto.png');
    powerVidaImage     = createImage('images/podervida.png');
    powerDisparoImage  = createImage('images/poderdisparo.png');
    powerEscudoImage   = createImage('images/poderescudo.png');
}

/******************************* ESCALA DEL CANVAS ****************************/

/**
 * Escala el canvas para que ocupe el máximo espacio posible manteniendo
 * la proporción original (canvas.width × canvas.height), sin distorsión.
 * Usa CSS transform para no afectar las coordenadas internas del juego.
 */
function scaleCanvas() {
    if (!canvas) { return; }
    // En pantallas pequeñas reservamos menos espacio para los paneles laterales
    // para que el juego/menú puedan ocupar casi todo el ancho.
    var isSmallScreen = window.innerWidth <= 720;
    var minPanel = isSmallScreen ? 0 : CONFIG.MIN_PANEL_WIDTH;
    var availableWidth = window.innerWidth - 2 * minPanel;
    var scaleX = availableWidth / canvas.width;
    var scaleY = window.innerHeight / canvas.height;
    var scale  = Math.min(scaleX, scaleY);
    canvas.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    var panelWidth = Math.floor((window.innerWidth - canvas.width * scale) / 2);
    if (panelWidth < 0) { panelWidth = 0; }
    var panels = [gameLeftPanel, gameScoresPanel, mainMenuLeftPanel, mainMenuScoresPanel];
    for (var i = 0; i < panels.length; i++) {
        if (!panels[i]) { continue; }
        if (isSmallScreen) {
            // Ocultar paneles en pantallas pequeñas para evitar superposiciones
            panels[i].style.display = 'none';
            panels[i].style.width = '0px';
        } else {
            panels[i].style.display = '';
            panels[i].style.width = panelWidth + 'px';
        }
    }
    // Ajusta el overlay para que su contenido se centre en el hueco entre paneles
    // (no en el centro de toda la pantalla), evitando superposiciones.
    if (overlay) {
        var overlayPad = isSmallScreen ? 10 : panelWidth;
        overlay.style.paddingLeft = overlayPad + 'px';
        overlay.style.paddingRight = overlayPad + 'px';
        overlay.style.boxSizing = 'border-box';
    }
}

/******************************* AUDIO DE FONDO ********************************/

/**
 * Crea e inicializa el sonido de fondo.
 * Carga el archivo de audio y lo configura para reproducirse en loop.
 */
function initBackgroundAudio() {
    if (!backgroundAudio) {
        backgroundAudio = new Audio();
        backgroundAudio.loop = true;
        backgroundAudio.volume = 0.5;
    }
    if (backgroundAudio.src.indexOf(currentTrack) === -1) {
        backgroundAudio.src = currentTrack;
    }
    backgroundAudio.play();
    backgroundAudioPaused = false;
}

/**
 * Cambia la melodía de fondo al archivo indicado.
 */
function changeTrack(src) {
    currentTrack = src;
    if (!backgroundAudio) {
        backgroundAudio = new Audio();
        backgroundAudio.loop = true;
        backgroundAudio.volume = 0.5;
        backgroundAudio.src = currentTrack;
        backgroundAudio.play();
        backgroundAudioPaused = false;
    } else {
        var wasPaused = backgroundAudioPaused;
        backgroundAudio.pause();
        backgroundAudio.src = currentTrack;
        backgroundAudio.loop = true;
        backgroundAudio.volume = 0.5;
        if (!wasPaused) {
            backgroundAudio.play();
            backgroundAudioPaused = false;
        }
    }
    // Actualizar botones activos
    var btns = document.querySelectorAll('.melody-btn');
    for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute('data-src') === src) {
            btns[i].classList.add('melody-btn-active');
        } else {
            btns[i].classList.remove('melody-btn-active');
        }
    }
}

/**
 * Alterna entre pausar y continuar el sonido de fondo.
 */
function toggleBackgroundAudio() {
    if (backgroundAudio) {
        if (backgroundAudioPaused) {
            backgroundAudio.play();
            backgroundAudioPaused = false;
            soundToggleBtn.style.opacity = '1';
        } else {
            backgroundAudio.pause();
            backgroundAudioPaused = true;
            soundToggleBtn.style.opacity = '0.5';
        }
    }
}

/**
 * Detiene el sonido de fondo completamente (para cuando termina el juego).
 */
function stopBackgroundAudio() {
    if (backgroundAudio) {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
        backgroundAudioPaused = false;
        soundToggleBtn.style.opacity = '1';
    }
}

/**
 * Obtiene la ruta de la música de fondo según el nivel.
 * @param {number} levelNumber - Número del nivel (1, 2, 3, 4).
 * @returns {string} Ruta del archivo de música.
 */
function getMusicTrackForLevel(levelNumber) {
    switch(levelNumber) {
        case 1: return 'Sonidos/Melodia_1.mp3';
        case 2: return 'Sonidos/Melodia_2.mp3';
        case 3: return 'Sonidos/Melodia_3.mp3';
        case 4: return 'Sonidos/Melodia_1.mp3';  // O puedes usar otra música para el jefe
        default: return 'Sonidos/Melodia_1.mp3';
    }
}

/**
 * Reproduce un sonido de efecto.
 * @param {string} src - Ruta del archivo de sonido.
 * @param {number} volume - Volumen (0-1).
 */
function playSound(src, volume) {
    var sound = new Audio();
    sound.src = src;
    sound.volume = volume || 0.7;
    sound.play().catch(function(err) {
        // Silenciar errores de reproducción si el navegador no lo permite
    });
}

/******************************* INICIALIZACIÓN *******************************/

/**
 * Punto de entrada público del juego. Inicializa el canvas, el doble buffer,
 * los elementos del DOM, los event listeners y arranca el game loop.
 * Debe llamarse una sola vez al cargar la página: game.init().
 */
function init() {
    preloadImages();
    showBestScores();

    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    window.addEventListener('resize', scaleCanvas);

    buffer = document.createElement('canvas');
    buffer.width  = canvas.width;
    buffer.height = canvas.height;
    bufferctx = buffer.getContext('2d');

    overlay       = document.getElementById('overlay');
    startContent  = document.getElementById('startContent');
    endContent    = document.getElementById('endContent');
    pauseContent  = document.getElementById('pauseContent');
    mainMenuContent = document.getElementById('mainMenuContent');
    tutorialContent = document.getElementById('tutorialContent');
    optionsContent  = document.getElementById('optionsContent');
    especificacionesContent = document.getElementById('especificacionesContent');
    logrosContent       = document.getElementById('logrosContent');
    mainMenuScoresPanel = document.getElementById('mainMenuScoresPanel');
    gameLeftPanel   = document.getElementById('gameLeftPanel');
    gameScoresPanel = document.getElementById('gameScoresPanel');
    mainMenuLeftPanel = document.getElementById('mainMenuLeftPanel');
    gameOverContent = document.getElementById('gameOverContent');

    scaleCanvas();
    victoryContent = document.getElementById('victoryContent');
    nameInput     = document.getElementById('playerName');
    startButton   = document.getElementById('startButton');
    restartButton = document.getElementById('restartButton');
    resumeButton  = document.getElementById('resumeButton');
    exitButton    = document.getElementById('exitButton');
    finalText     = document.getElementById('finalText');
    playButton    = document.getElementById('playButton');
    backButton    = document.getElementById('backButton');
    tutorialButton = document.getElementById('tutorialButton');
    optionsButton = document.getElementById('optionsButton');
    quitButton    = document.getElementById('quitButton');
    backFromTutorialButton = document.getElementById('backFromTutorialButton');
    backFromOptionsButton = document.getElementById('backFromOptionsButton');
    especificacionesButton = document.getElementById('especificacionesButton');
    backFromEspecificacionesButton = document.getElementById('backFromEspecificacionesButton');
    logrosButton         = document.getElementById('logrosButton');
    backFromLogrosButton = document.getElementById('backFromLogrosButton');
    gameOverRestartButton = document.getElementById('gameOverRestartButton');
    gameOverMenuButton = document.getElementById('gameOverMenuButton');
    victoryRestartButton = document.getElementById('victoryRestartButton');
    victoryMenuButton = document.getElementById('victoryMenuButton');
    pauseButton = document.getElementById('pauseButton');
    restartLevelBtn = document.getElementById('restartLevelBtn');
    soundToggleBtn = document.getElementById('soundToggleBtn');

    addListener(document, 'keydown', keyDown);
    addListener(document, 'keyup', keyUp);
    addListener(startButton, 'click', startGame);
    addListener(restartButton, 'click', function() {
        showOverlay('mainMenu');
    });
    addListener(resumeButton, 'click', togglePause);
    addListener(exitButton, 'click', function() {
        gamePaused = false;
        showOverlay('mainMenu');
    });
    addListener(playButton, 'click', function() {
        showOverlay('nameInput');
    });
    addListener(backButton, 'click', function() {
        showOverlay('mainMenu');
    });
    addListener(tutorialButton, 'click', function() {
        showOverlay('tutorial');
    });
    addListener(optionsButton, 'click', function() {
        showOverlay('options');
    });
    addListener(especificacionesButton, 'click', function() {
        showOverlay('especificaciones');
    });
    addListener(quitButton, 'click', function() {
        alert('¡Gracias por jugar!');
    });
    addListener(backFromTutorialButton, 'click', function() {
        showOverlay('nameInput');
    });
    addListener(backFromOptionsButton, 'click', function() {
        showOverlay('mainMenu');
    });
    addListener(backFromEspecificacionesButton, 'click', function() {
        showOverlay('options');
    });
    addListener(logrosButton, 'click', function() {
        showOverlay('logros');
    });
    addListener(backFromLogrosButton, 'click', function() {
        showOverlay('mainMenu');
    });
    addListener(gameOverRestartButton, 'click', function() {
        resetGameState();
        startGame();
    });
    addListener(gameOverMenuButton, 'click', function() {
        resetGameState();
        showOverlay('mainMenu');
    });
    addListener(victoryRestartButton, 'click', function() {
        resetGameState();
        startGame();
    });
    addListener(victoryMenuButton, 'click', function() {
        resetGameState();
        showOverlay('mainMenu');
    });
    addListener(pauseButton, 'click', togglePause);
    addListener(restartLevelBtn, 'click', restartLevel);
    addListener(soundToggleBtn, 'click', toggleBackgroundAudio);
    addListener(nameInput, 'keydown', function (e) {
        var key = (window.event ? e.keyCode : e.which);
        if (key === 13) {
            e.preventDefault();
            startGame();
        }
    });

    loadAchievements();
    showOverlay('mainMenu');

    var lastTime = 0;
    function anim(timestamp) {
        if (!lastTime) lastTime = timestamp;
        var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;
        loop(dt);
        requestAnimFrame(anim);
    }
    anim(0);
}

/**
 * Muestra el overlay con el contenido especificado.
 * @param {'mainMenu'|'nameInput'|'tutorial'|'options'|'end'|'pause'|'levelTransition'} type - El tipo de overlay a mostrar.
 */
function showOverlay(type) {
    overlay.classList.remove('hidden');
    
    // Ocultar todos primero
    mainMenuContent.classList.add('hidden');
    if (mainMenuScoresPanel) { mainMenuScoresPanel.classList.add('hidden'); }
    startContent.classList.add('hidden');
    endContent.classList.add('hidden');
    pauseContent.classList.add('hidden');
    tutorialContent.classList.add('hidden');
    optionsContent.classList.add('hidden');
    especificacionesContent.classList.add('hidden');
    if (logrosContent) { logrosContent.classList.add('hidden'); }
    gameOverContent.classList.add('hidden');
    victoryContent.classList.add('hidden');
    
    if (type === 'mainMenu') {
        mainMenuContent.classList.remove('hidden');
        if (mainMenuScoresPanel) { mainMenuScoresPanel.classList.remove('hidden'); }
        gameStarted = false;
        gamePaused = false;
        stopBackgroundAudio();  // Detiene el sonido de fondo
        updatePauseButtonLabel();
        
        // Ocultar botones de control
        document.querySelector('.header-controls').classList.add('hidden');
    } else if (type === 'nameInput') {
        startContent.classList.remove('hidden');
        if (mainMenuScoresPanel) { mainMenuScoresPanel.classList.remove('hidden'); }
        nameInput.value = playerName || '';
        nameInput.focus();
    } else if (type === 'tutorial') {
        tutorialContent.classList.remove('hidden');
    } else if (type === 'options') {
        optionsContent.classList.remove('hidden');
    } else if (type === 'especificaciones') {
        especificacionesContent.classList.remove('hidden');
    } else if (type === 'logros') {
        if (logrosContent) {
            logrosContent.classList.remove('hidden');
            renderAchievementsMenu();
        }
    } else if (type === 'end') {
        endContent.classList.remove('hidden');
    } else if (type === 'pause') {
        pauseContent.classList.remove('hidden');
        resumeButton.focus();
    } else if (type === 'levelTransition') {
        // Mostrar transición de nivel (usa finalText)
        overlay.classList.add('hidden');
        // La transición se muestra directamente en canvas
    } else if (type === 'gameOver') {
        gameOverContent.classList.remove('hidden');
        document.getElementById('gameOverScore').textContent = player.score;
    } else if (type === 'victory') {
        victoryContent.classList.remove('hidden');
        document.getElementById('victoryPlayerName').textContent = playerName;
        document.getElementById('victoryScore').textContent = player.score;
        
        // Mostrar corazones
        var hearts = '';
        for (var i = 0; i < player.life; i++) {
            hearts += '❤️ ';
        }
        document.getElementById('victoryHearts').textContent = hearts || '(ninguna)';
        
        // Bonus y total
        var bonus = player.life * CONFIG.SCORE_LIFE_BONUS;
        document.getElementById('victoryBonus').textContent = '+' + bonus;
        document.getElementById('victoryTotal').textContent = getTotalScore();
    }
}

/** Oculta el overlay de la UI. */
function hideOverlay() {
    overlay.classList.add('hidden');
}

/** Alterna entre pausado y reanudado. Si está pausado, lo reanuda; si está en juego, lo pausa. */
function updatePauseButtonLabel() {
    if (pauseButton) {
        pauseButton.innerHTML = gamePaused ? '<span class="control-icon">▶</span>' : '<span class="control-icon">❚❚</span>';
        var label = gamePaused ? 'Reanudar juego' : 'Pausar juego';
        pauseButton.title = label;
        pauseButton.setAttribute('aria-label', label);
    }
}

function togglePause() {
    if (gameStarted && !youLose && !congratulations) {
        gamePaused = !gamePaused;
        updatePauseButtonLabel();
        if (gamePaused) {
            showOverlay('pause');
        } else {
            hideOverlay();
        }
    }
}

function restartLevel() {
    if (!gameStarted || youLose || congratulations) {
        return;
    }

    gamePaused = false;
    hideOverlay();
    playerShotsBuffer = [];
    evilShotsBuffer = [];
    now = 0;
    nextPlayerShot = 0;
    finalAnimationTick = 0;
    currentLevel = 1;  // Reiniciar al nivel 1
    var currentLife = CONFIG.PLAYER_LIVES;
    var currentScore = 0;
    applyLevelConfiguration(currentLevel);
    // Cambiar a la música del nivel 1
    changeTrack(getMusicTrackForLevel(currentLevel));
    evilCounter = 1;
    player = new Player(currentLife, currentScore);
    createNewEvil();
    updatePauseButtonLabel();
    showLifeAndScore();
}

/**
 * Inicia o reinicia una partida. Lee el nombre del jugador del input,
 * lo sanitiza, reinicia el estado global del juego y oculta el overlay.
 */
function startGame() {
    playerName = sanitizeName(nameInput.value);
    resetSessionStats();
    resetGameState();
    hideOverlay();
    gameStarted = true;
    // Cambiar a la música del nivel 1
    changeTrack(getMusicTrackForLevel(currentLevel));
    
    // Mostrar botones de control cuando inicia el juego
    document.querySelector('.header-controls').classList.remove('hidden');
}

/**
 * Reinicia todas las variables de estado del juego a sus valores iniciales.
 * Crea un nuevo jugador y el primer enemigo.
 */
function resetGameState() {
    currentLevel  = 1;
    playerLife    = CONFIG.PLAYER_LIVES;
    evilCounter   = 1;
    youLose       = false;
    congratulations = false;
    playerShotsBuffer = [];
    evilShotsBuffer   = [];
    powersBuffer      = [];    // Limpiar poderes
    now            = 0;
    nextPlayerShot = 0;
    finalAnimationTick = 0;
    // Resetear efectos de poderes
    doubleFireActive = false;
    shieldActive = false;
    lifeEffectActive = false;
    if (doubleFireTimeout) clearTimeout(doubleFireTimeout);
    if (shieldTimeout) clearTimeout(shieldTimeout);
    if (lifeEffectTimeout) clearTimeout(lifeEffectTimeout);
    applyLevelConfiguration(currentLevel);
    originalPlayerSpeed = playerSpeed;  // Actualizar velocidad original según el nivel
    player = new Player(playerLife, 0);
    createNewEvil();
    showLifeAndScore();
}

/**
 * Aplica la configuración del nivel especificado.
 * Actualiza velocidad, número de enemigos, vida y disparos base.
 * @param {number} levelNumber - Número del nivel (1, 2, 3, 4).
 */
function applyLevelConfiguration(levelNumber) {
    if (CONFIG.LEVELS[levelNumber]) {
        var levelConfig = CONFIG.LEVELS[levelNumber];
        evilSpeed = CONFIG.EVIL_BASE_SPEED * levelConfig.speedMultiplier;
        totalEvils = levelConfig.totalEnemies;
        evilLife = levelConfig.baseLife;
        evilShots = levelConfig.baseShots;
        
        // Configurar estadísticas del jefe final para el nivel 4
        if (levelNumber === 4) {
            finalBossLife = CONFIG.BOSS_LIFE + 8;  // Jefe más fuerte en nivel 4
            finalBossShots = CONFIG.BOSS_SHOTS + 15;
        }
    }
}

/******************************* GESTIÓN DE ENEMIGOS *******************************/

/**
 * Decide qué ocurre tras matar a un enemigo:
 * - Si quedan enemigos, programa la creación del siguiente con un retardo aleatorio.
 * - Si no quedan, verifica si hay más niveles o inicia la secuencia de victoria.
 */
function verifyToCreateNewEvil() {
    if (totalEvils > 0) {
        setTimeout(spawnNextEvil, getRandomNumber(CONFIG.NEW_EVIL_MAX_DELAY));
    } else {
        // Verificar si hay siguiente nivel
        if (currentLevel < 4) {
            setTimeout(startNextLevel, CONFIG.LEVEL_TRANSITION_DELAY);
        } else {
            // Fin del juego (último nivel completado)
            setTimeout(startVictorySequence, CONFIG.CONGRATS_DELAY);
        }
    }
}

/** Crea el siguiente enemigo e incrementa el contador de oleadas. */
function spawnNextEvil() {
    createNewEvil();
    evilCounter++;
}

/**
 * Inicia el siguiente nivel: incrementa currentLevel, aplica su configuración,
 * reinicia contadores y crea el primer enemigo del nuevo nivel.
 */
function startNextLevel() {
    var livesBeforeTransition = player ? player.life : 0;
    currentLevel++;
    evilCounter = 1;
    playerShotsBuffer = [];
    evilShotsBuffer = [];
    powersBuffer = [];   // Limpiar poderes al cambiar de nivel
    // Resetear efectos de poderes
    doubleFireActive = false;
    shieldActive = false;
    lifeEffectActive = false;
    if (doubleFireTimeout) clearTimeout(doubleFireTimeout);
    if (shieldTimeout) clearTimeout(shieldTimeout);
    if (lifeEffectTimeout) clearTimeout(lifeEffectTimeout);
    applyLevelConfiguration(currentLevel);
    player.speed = playerSpeed;  // Restaurar velocidad original del nuevo nivel
    originalPlayerSpeed = playerSpeed;  // Actualizar velocidad original para el nuevo nivel
    // Cambiar la música al siguiente nivel
    changeTrack(getMusicTrackForLevel(currentLevel));
    onLevelChanged(currentLevel, livesBeforeTransition);
    // Mostrar notificación del nivel
    showLevelTransition();
    createNewEvil();
}

/**
 * Muestra una notificación visual de cambio de nivel.
 */
function showLevelTransition() {
    levelTransitionActive = true;
    transitionStartTime = now;
    transitionProgress = 0;
    setTimeout(function() {
        levelTransitionActive = false;
    }, CONFIG.LEVEL_TRANSITION_DELAY);
}

/** Guarda la puntuación, activa la animación de victoria y programa el overlay final. */
function startVictorySequence() {
    onVictory(player ? player.life : 0);
    saveFinalScore();
    congratulations = true;
    finalText.textContent = '¡ENHORABUENA, ' + playerName + '! Has ganado.';
    setTimeout(showVictoryOverlay, CONFIG.CONGRATS_OVERLAY_DELAY);
}

/** Muestra el overlay de victoria. */
function showVictoryOverlay() {
    stopBackgroundAudio();  // Detiene el sonido de fondo
    showOverlay('victory');
    congratulations = false;
}

/**
 * Crea el siguiente enemigo y lo asigna a la variable `evil`.
 * Crea un FinalBoss en el nivel 4; en caso contrario, crea un Evil
 * con vidas y disparos incrementados según evilCounter.
 */
function createNewEvil() {
    if (currentLevel === 4) {
        // Nivel 4: JEFE FINAL
        evil = new FinalBoss();
    } else {
        // Niveles 1-3: Enemigos regulares
        evil = new Evil(evilLife + evilCounter - 1, evilShots + evilCounter - 1);
    }
}

/******************************* COLISIONES *******************************/

/**
 * Detecta colisión AABB entre el cuerpo del enemigo activo y el jugador.
 * @returns {boolean} true si el enemigo está tocando al jugador.
 */
function isEvilHittingPlayer() {
    return (((evil.posY + evil.image.height) > player.posY && (player.posY + player.height) >= evil.posY) &&
        ((player.posX >= evil.posX && player.posX <= (evil.posX + evil.image.width)) ||
            (player.posX + player.width >= evil.posX && (player.posX + player.width) <= (evil.posX + evil.image.width))));
}

/**
 * Verifica si un disparo del jugador impactó al enemigo activo.
 * Si hay impacto: reduce la vida del enemigo (o lo mata) y elimina el disparo.
 * Si mata al enemigo, hay probabilidad de crear un poder aleatorio.
 * @param {PlayerShot} shot - El disparo a evaluar.
 * @returns {boolean} false si hubo impacto; true si el disparo puede continuar.
 */
function checkCollisions(shot) {
    if (shot.isHittingEvil()) {
        if (evil.life > 1) {
            playSound('Sonidos/Boom.mp3', 1);
            evil.life--;
        } else {
            if (evil instanceof FinalBoss) {
                playSound('Sonidos/Boom_nave_Final.mp3', 1);
            } else {
                playSound('Sonidos/Boom.mp3', 1);
            }
            evil.kill();
            player.score += evil.pointsToKill;
            // Crear poder aleatorio al matar un enemigo
            createRandomPower(evil.posX + evil.image.width / 2, evil.posY);
            onEnemyKilled();
        }
        shot.deleteShot(parseInt(shot.identifier));
        return false;
    }
    return true;
}

/**
 * Crea un poder aleatorio con 40% de probabilidad.
 * @param {number} x - Posición horizontal.
 * @param {number} y - Posición vertical.
 */
function createRandomPower(x, y) {
    // 40% de probabilidad de crear un poder
    if (Math.random() < CONFIG.POWER_SPAWN_CHANCE) {
        var types = ['vida', 'dobleDisparo', 'escudo'];
        var randomType = types[Math.floor(Math.random() * types.length)];
        
        // Crear objeto poder sin usar clase
        var power = {
            posX: x,
            posY: y,
            type: randomType,
            width: 40,
            height: 40,
            speed: 2,
            color: (randomType === 'vida') ? '#FF6B6B' : 
                   (randomType === 'dobleDisparo') ? '#FFD93D' : '#4ECDC4',
            emoji: (randomType === 'vida') ? '❤️' : 
                   (randomType === 'dobleDisparo') ? '🔫' : '🛡️',
            image: (randomType === 'vida') ? powerVidaImage : 
                   (randomType === 'dobleDisparo') ? powerDisparoImage : powerEscudoImage
        };
        
        powersBuffer.push(power);
    }
}

/**
 * Verifica si el jugador ha colisionado con algún poder y aplica el efecto.
 */
function checkPowerCollisions() {
    for (var i = powersBuffer.length - 1; i >= 0; i--) {
        var power = powersBuffer[i];
        if (!power) continue;
        
        // Detectar colisión con jugador
        var hitPlayer = (power.posX >= player.posX && power.posX <= (player.posX + player.width) &&
                        power.posY >= player.posY && power.posY <= (player.posY + player.height));
        
        if (hitPlayer) {
            applyPowerEffect(power);
            arrayRemove(powersBuffer, i);
        } else if (power.posY > canvas.height) {
            // Eliminar si sale de pantalla
            arrayRemove(powersBuffer, i);
        }
    }
}

/**
 * Aplica el efecto del poder al jugador según su tipo.
 * @param {Power} power - El poder a aplicar.
 */
function applyPowerEffect(power) {
    switch(power.type) {
        case 'vida':
            // Recuperar una vida, máximo CONFIG.POWER_MAX_LIVES
            if (player.life < CONFIG.POWER_MAX_LIVES) {
                player.life++;
            }
            // Mostrar efecto de vida durante 2 segundos
            if (lifeEffectTimeout) {
                clearTimeout(lifeEffectTimeout);
            }
            lifeEffectActive = true;
            lifeEffectTimeout = setTimeout(function() {
                lifeEffectActive = false;
            }, 2000);  // 2 segundos
            break;
        
        case 'dobleDisparo':
            // Activa disparo doble por 10 segundos
            if (doubleFireTimeout) {
                clearTimeout(doubleFireTimeout);
            }
            doubleFireActive = true;
            doubleFireTimeout = setTimeout(function() {
                doubleFireActive = false;
            }, CONFIG.POWER_DURATION);
            break;
        
        case 'escudo':
            // Activa escudo por 10 segundos (jugador invulnerable)
            if (shieldTimeout) {
                clearTimeout(shieldTimeout);
            }
            shieldActive = true;
            shieldTimeout = setTimeout(function() {
                shieldActive = false;
            }, CONFIG.POWER_DURATION);
            break;
    }
}

/******************************* ENTRADA DE TECLADO *******************************/

/**
 * Manejador del evento keydown. Marca como presionada la tecla en keyPressed.
 * También maneja la tecla ESC para pausar/reanudar el juego.
 * @param {KeyboardEvent} e - El evento de teclado.
 */
function keyDown(e) {
    var key = (window.event ? e.keyCode : e.which);
    
    // Tecla ESC para pausar
    if (key === keyMap.pause) {
        e.preventDefault();
        togglePause();
        return;
    }
    
    for (var inkey in keyMap) {
        if (key === keyMap[inkey]) {
            e.preventDefault();
            keyPressed[inkey] = true;
        }
    }
}

/**
 * Manejador del evento keyup. Desmarca la tecla en keyPressed.
 * @param {KeyboardEvent} e - El evento de teclado.
 */
function keyUp(e) {
    var key = (window.event ? e.keyCode : e.which);
    for (var inkey in keyMap) {
        if (key === keyMap[inkey]) {
            e.preventDefault();
            keyPressed[inkey] = false;
        }
    }
}

/** Delega el procesamiento de entrada del jugador a player.doAnything(). */
function playerAction(dt) {
    player.doAnything(dt);
}

/******************************* GAME LOOP *******************************/

/**
 * Ejecuta un frame del juego: actualiza el estado y dibuja en pantalla.
 * Es llamada en cada pulso de requestAnimFrame (~60 fps).
 */
function loop(dt) {
    update(dt);
    draw();
}

/** Vuelca el contenido del buffer al canvas principal visible. */
function draw() {
    ctx.drawImage(buffer, 0, 0);
}

/**
 * Actualiza el estado del juego en cada frame: dibuja fondo, entidades,
 * procesa colisiones, movimiento del jugador y muestra HUD.
 * Retorna temprano si el juego no ha comenzado, está en pausa, está en victoria o en derrota.
 */
function update(dt) {
    drawBackground();

    if (!gameStarted) {
        return;
    }
    if (levelTransitionActive) {
        // Durante la transición de nivel, mostrar animación arcade
        drawLevelTransitionEffect();
        return;
    }
    if (gamePaused) {
        bufferctx.drawImage(player, player.posX, player.posY);
        if (lifeEffectActive) drawLifeEffect();
        if (doubleFireActive) drawDoubleFirEffect();
        if (shieldActive) drawShieldEffect();
        bufferctx.drawImage(evil.image, evil.posX, evil.posY);
        drawEnemyLifeBar();
        showLifeAndScore();
        return;
    }
    if (congratulations) {
        showCongratulations();
        return;
    }
    if (youLose) {
        showGameOver();
        return;
    }

    bufferctx.drawImage(player, player.posX, player.posY);
    if (lifeEffectActive) drawLifeEffect();
    if (doubleFireActive) drawDoubleFirEffect();
    if (shieldActive) drawShieldEffect();
    bufferctx.drawImage(evil.image, evil.posX, evil.posY);
    drawEnemyLifeBar();

    updateEvil(dt);
    updateSlowdownEffect();  // Actualizar efecto de lentitud

    // Actualizar y renderizar poderes
    for (var p = 0; p < powersBuffer.length; p++) {
        updatePower(powersBuffer[p], p, dt);
    }
    checkPowerCollisions();

    for (var j = 0; j < playerShotsBuffer.length; j++) {
        updatePlayerShot(playerShotsBuffer[j], j, dt);
    }

    if (isEvilHittingPlayer()) {
        player.killPlayer();
        onPlayerDamaged();
    } else {
        for (var i = 0; i < evilShotsBuffer.length; i++) {
            updateEvilShot(evilShotsBuffer[i], i, dt);
        }
    }

    showLifeAndScore();
    drawSlowdownOverlay();  // Dibujar overlay rojo si está ralentizado
    playerAction(dt);
}

/******************************* RENDERIZADO *******************************/

/** Dibuja el marcador de vidas y puntos en la esquina superior derecha del buffer. */
/** Dibuja la barra de vida encima del enemigo. */
function drawEnemyLifeBar() {
    if (evil.dead) {
        return;
    }
    
    var barWidth = 60;  // Ancho de la barra
    var barHeight = 8;  // Alto de la barra
    var barX = evil.posX + (evil.image.width - barWidth) / 2;  // Centrar horizontalmente
    var barY = evil.posY - 15;  // Posición arriba del enemigo
    
    // Calcular el porcentaje de vida
    var lifePercent = evil.life / evil.maxLife;
    var filledWidth = barWidth * lifePercent;
    
    // Dibujar fondo de la barra (rojo/gris)
    bufferctx.fillStyle = '#333333';
    bufferctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Dibujar barra de vida (rojo a verde según se van eliminando)
    // Rojo cuando tiene toda la vida, verde cuando está casi muerto
    var hue = lifePercent * 120;  // 0 grados (rojo) a 120 grados (verde)
    bufferctx.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
    bufferctx.fillRect(barX, barY, filledWidth, barHeight);
    
    // Dibujar borde de la barra
    bufferctx.strokeStyle = '#FFFFFF';
    bufferctx.lineWidth = 1;
    bufferctx.strokeRect(barX, barY, barWidth, barHeight);
}

function showLifeAndScore() {
    // Actualizar puntuación en el panel DOM
    var scoreEl = document.getElementById('currentScoreDisplay');
    if (scoreEl) { scoreEl.textContent = player.score; }

    bufferctx.textAlign = 'right';
    bufferctx.fillStyle = '#90EE90';
    bufferctx.font = 'bold 16px Arial';
    bufferctx.fillText('Puntos: ' + player.score, canvas.width - 5, 20);
    
    // Mostrar nivel
    bufferctx.textAlign = 'left';
    bufferctx.fillStyle = '#26b619';
    bufferctx.font = 'bold 14px Arial';
    bufferctx.fillText('Nivel ' + currentLevel, 10, 20);
    
    // Mostrar enemigos restantes
    bufferctx.fillStyle = '#87CEEB';
    bufferctx.font = 'bold 12px Arial';
    var enemyText = 'Enemigos: ' + totalEvils + (currentLevel === 4 ? ' (JEFE)' : '');
    bufferctx.fillText(enemyText, 10, 40);
    
    // Dibujar corazones rojos en lugar de número de vidas
    bufferctx.textAlign = 'right';
    bufferctx.fillStyle = '#FF0000';
    bufferctx.font = 'bold 24px Arial';
    var hearts = '';
    for (var i = 0; i < player.life; i++) {
        hearts += '\u2665 ';
    }
    bufferctx.fillText(hearts, canvas.width - 100, 45);
    
    // Mostrar indicadores de efectos activos
    var yOffset = 60;
    if (doubleFireActive) {
        bufferctx.fillStyle = '#FFD93D';
        bufferctx.font = 'bold 14px Arial';
        bufferctx.fillText('🔫 Disparo Doble Activo', 10, yOffset);
        yOffset += 20;
    }
    if (shieldActive) {
        bufferctx.fillStyle = '#4ECDC4';
        bufferctx.font = 'bold 14px Arial';
        bufferctx.fillText('🛡️ Escudo Activo', 10, yOffset);
    }
    bufferctx.textAlign = 'left';
}

/**
 * Dibuja cañones laterales estilo arcade cuando el jugador tiene doble disparo activo.
 */
function drawDoubleFirEffect() {
    var cannonColor = '#FFD93D';  // Amarillo para los cañones
    var glowColor = '#FFFF00';   // Amarillo brillante para el brillo
    var playerCenterX = player.posX + player.width / 2;
    var playerCenterY = player.posY + player.height / 2;
    
    // Efecto pulsante: brillo de los cañones
    var pulseValue = (Math.sin(now * 8) + 1) / 2;  // Oscila entre 0 y 1
    bufferctx.globalAlpha = 0.6 + (pulseValue * 0.4);  // Oscila entre 0.6 y 1.0
    
    // CAÑÓN IZQUIERDO
    var leftCannonX = player.posX + 8;
    var leftCannonY = player.posY + 20;
    
    // Base del cañón (rectángulo redondeado)
    bufferctx.fillStyle = cannonColor;
    bufferctx.beginPath();
    bufferctx.moveTo(leftCannonX + 3, leftCannonY);
    bufferctx.lineTo(leftCannonX + 12, leftCannonY);
    bufferctx.quadraticCurveTo(leftCannonX + 14, leftCannonY + 2, leftCannonX + 14, leftCannonY + 6);
    bufferctx.lineTo(leftCannonX + 14, leftCannonY + 20);
    bufferctx.quadraticCurveTo(leftCannonX + 12, leftCannonY + 22, leftCannonX + 8, leftCannonY + 22);
    bufferctx.lineTo(leftCannonX + 2, leftCannonY + 22);
    bufferctx.quadraticCurveTo(leftCannonX, leftCannonY + 20, leftCannonX, leftCannonY + 16);
    bufferctx.lineTo(leftCannonX, leftCannonY + 6);
    bufferctx.quadraticCurveTo(leftCannonX, leftCannonY + 2, leftCannonX + 3, leftCannonY);
    bufferctx.fill();
    
    // Tubo del cañón (más largo)
    bufferctx.fillStyle = cannonColor;
    bufferctx.fillRect(leftCannonX + 3, leftCannonY - 8, 8, 10);
    
    // Punta del cañón izquierdo (triángulo)
    bufferctx.fillStyle = glowColor;
    bufferctx.beginPath();
    bufferctx.moveTo(leftCannonX + 5, leftCannonY - 8);
    bufferctx.lineTo(leftCannonX + 11, leftCannonY - 8);
    bufferctx.lineTo(leftCannonX + 8, leftCannonY - 14);
    bufferctx.fill();
    
    // Destello en la punta
    bufferctx.fillStyle = 'rgba(255, 255, 255, ' + (0.4 + pulseValue * 0.6) + ')';
    bufferctx.beginPath();
    bufferctx.arc(leftCannonX + 8, leftCannonY - 12, 2, 0, Math.PI * 2);
    bufferctx.fill();
    
    // CAÑÓN DERECHO
    var rightCannonX = player.posX + player.width - 14;
    var rightCannonY = player.posY + 20;
    
    // Base del cañón (rectángulo redondeado)
    bufferctx.fillStyle = cannonColor;
    bufferctx.beginPath();
    bufferctx.moveTo(rightCannonX + 2, rightCannonY);
    bufferctx.lineTo(rightCannonX + 11, rightCannonY);
    bufferctx.quadraticCurveTo(rightCannonX + 14, rightCannonY + 2, rightCannonX + 14, rightCannonY + 6);
    bufferctx.lineTo(rightCannonX + 14, rightCannonY + 16);
    bufferctx.quadraticCurveTo(rightCannonX + 14, rightCannonY + 20, rightCannonX + 11, rightCannonY + 22);
    bufferctx.lineTo(rightCannonX + 3, rightCannonY + 22);
    bufferctx.quadraticCurveTo(rightCannonX, rightCannonY + 20, rightCannonX, rightCannonY + 6);
    bufferctx.quadraticCurveTo(rightCannonX, rightCannonY + 2, rightCannonX + 2, rightCannonY);
    bufferctx.fill();
    
    // Tubo del cañón (más largo)
    bufferctx.fillStyle = cannonColor;
    bufferctx.fillRect(rightCannonX + 5, rightCannonY - 8, 8, 10);
    
    // Punta del cañón derecho (triángulo)
    bufferctx.fillStyle = glowColor;
    bufferctx.beginPath();
    bufferctx.moveTo(rightCannonX + 3, rightCannonY - 8);
    bufferctx.lineTo(rightCannonX + 9, rightCannonY - 8);
    bufferctx.lineTo(rightCannonX + 6, rightCannonY - 14);
    bufferctx.fill();
    
    // Destello en la punta
    bufferctx.fillStyle = 'rgba(255, 255, 255, ' + (0.4 + pulseValue * 0.6) + ')';
    bufferctx.beginPath();
    bufferctx.arc(rightCannonX + 6, rightCannonY - 12, 2, 0, Math.PI * 2);
    bufferctx.fill();
    
    // Aura amarilla alrededor del jugador
    bufferctx.strokeStyle = 'rgba(255, 217, 61, 0.5)';
    bufferctx.lineWidth = 2;
    bufferctx.beginPath();
    bufferctx.rect(player.posX - 5, player.posY - 5, player.width + 10, player.height + 10);
    bufferctx.stroke();
    
    bufferctx.globalAlpha = 1.0;
}

/**
 * Dibuja un efecto de vida estilo arcade cuando el jugador agarra el poder de vida.
 */
function drawLifeEffect() {
    var lifeColor = '#FF6B6B';  // Rojo para vida
    var glowColor = '#FF1744';  // Rojo más oscuro para el brillo
    var playerCenterX = player.posX + player.width / 2;
    var playerCenterY = player.posY + player.height / 2;
    
    // Efecto pulsante fuerte
    var pulseValue = (Math.sin(now * 10) + 1) / 2;  // Oscila entre 0 y 1
    var alpha = 0.4 + (pulseValue * 0.5);  // Oscila entre 0.4 y 0.9
    
    bufferctx.globalAlpha = alpha;
    
    // Aura roja pulsante alrededor del jugador
    bufferctx.strokeStyle = lifeColor;
    bufferctx.lineWidth = 3;
    bufferctx.beginPath();
    bufferctx.arc(playerCenterX, playerCenterY, 35 + pulseValue * 5, 0, Math.PI * 2);
    bufferctx.stroke();
    
    // Segunda aura con fase desfasada
    bufferctx.strokeStyle = glowColor;
    bufferctx.lineWidth = 2;
    bufferctx.globalAlpha = alpha * 0.6;
    bufferctx.beginPath();
    bufferctx.arc(playerCenterX, playerCenterY, 28, 0, Math.PI * 2);
    bufferctx.stroke();
    
    // Dibujar corazones decorativos alrededor del jugador
    bufferctx.globalAlpha = alpha * 0.8;
    bufferctx.fillStyle = lifeColor;
    var heartCount = 4;
    for (var i = 0; i < heartCount; i++) {
        var angle = (i / heartCount) * Math.PI * 2 + now * 2;
        var heartX = playerCenterX + Math.cos(angle) * 40;
        var heartY = playerCenterY + Math.sin(angle) * 40;
        
        // Dibujar corazón pequeño
        var scale = 0.015 + pulseValue * 0.005;
        bufferctx.save();
        bufferctx.translate(heartX, heartY);
        bufferctx.scale(scale, scale);
        drawSmallHeart(0, 0);
        bufferctx.restore();
    }
    
    bufferctx.globalAlpha = 1.0;
}

/**
 * Dibuja un corazón pequeño en las coordenadas especificadas.
 */
function drawSmallHeart(x, y) {
    bufferctx.beginPath();
    bufferctx.moveTo(x, y + 50);
    bufferctx.bezierCurveTo(x, y, x - 50, y, x - 50, y - 30);
    bufferctx.bezierCurveTo(x - 50, y - 60, x, y - 60, x, y - 30);
    bufferctx.bezierCurveTo(x, y - 60, x + 50, y - 60, x + 50, y - 30);
    bufferctx.bezierCurveTo(x + 50, y, x, y, x, y + 50);
    bufferctx.fill();
}

/**
 * Dibuja la animación de transición de nivel arcade.
 */
function drawLevelTransitionEffect() {
    // Calcular progreso de la transición (0 a 1)
    var elapsed = now - transitionStartTime;
    transitionProgress = Math.min(elapsed / (CONFIG.LEVEL_TRANSITION_DELAY - 500), 1);
    
    if (transitionProgress > 1) transitionProgress = 1;
    
    // Determinar qué animación mostrar según el nivel actual
    if (currentLevel === 2) {
        drawTransitionLevel1to2();
    } else if (currentLevel === 3) {
        drawTransitionLevel2to3();
    } else if (currentLevel === 4) {
        drawTransitionLevel3toBoss();
    }
}

/**
 * Transición Nivel 1 a 2: Escaneo de líneas tipo CRT arcade
 */
function drawTransitionLevel1to2() {
    // Fondo oscuro
    bufferctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Líneas de escaneo que bajan
    bufferctx.strokeStyle = '#00FF00';
    bufferctx.lineWidth = 3;
    var scanlineY = -canvas.height + (transitionProgress * canvas.height * 2);
    
    for (var i = 0; i < 8; i++) {
        var y = scanlineY + (i * canvas.height / 4);
        if (y > 0 && y < canvas.height) {
            bufferctx.beginPath();
            bufferctx.moveTo(0, y);
            bufferctx.lineTo(canvas.width, y);
            bufferctx.stroke();
        }
    }
    
    // Efecto de distorsión pixelada
    bufferctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    for (var j = 0; j < 20; j++) {
        var x = Math.random() * canvas.width;
        var y = Math.random() * canvas.height;
        var size = 10 + Math.random() * 20;
        bufferctx.fillRect(x, y, size, size);
    }
    
    // Texto del nivel con efecto 8-bit
    bufferctx.fillStyle = '#00FF00';
    bufferctx.font = 'bold 48px monospace';
    bufferctx.globalAlpha = 0.5 + (transitionProgress * 0.5);
    bufferctx.fillText('LEVEL 2', canvas.width/2 - 90, canvas.height/2 - 20);
    bufferctx.font = 'bold 24px monospace';
    bufferctx.fillText('¡LOS ENEMIGOS DESPIERTAN!', canvas.width/2 - 160, canvas.height/2 + 40);
    bufferctx.globalAlpha = 1.0;
}

/**
 * Transición Nivel 2 a 3: Líneas de velocidad convergentes
 */
function drawTransitionLevel2to3() {
    // Fondo degradado negro a rojo oscuro
    var gradient = bufferctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a0000');
    gradient.addColorStop(0.5, '#000000');
    gradient.addColorStop(1, '#3a0000');
    bufferctx.fillStyle = gradient;
    bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    
    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;
    
    // Pulsación central intensa
    var pulseSize = 30 + (Math.sin(transitionProgress * Math.PI * 8) * 20);
    bufferctx.fillStyle = 'rgba(255, 107, 0, 0.4)';
    bufferctx.beginPath();
    bufferctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
    bufferctx.fill();
    
    // Líneas de energía radiales que se contraen
    bufferctx.strokeStyle = '#FF6B00';
    var lineCount = 32;
    for (var i = 0; i < lineCount; i++) {
        var angle = (i / lineCount) * Math.PI * 2 + transitionProgress * Math.PI;
        var innerRadius = 10 + (1 - transitionProgress) * 150;
        var outerRadius = 10 + (1 - transitionProgress) * 250;
        
        var x1 = centerX + Math.cos(angle) * innerRadius;
        var y1 = centerY + Math.sin(angle) * innerRadius;
        var x2 = centerX + Math.cos(angle) * outerRadius;
        var y2 = centerY + Math.sin(angle) * outerRadius;
        
        bufferctx.lineWidth = 2;
        bufferctx.beginPath();
        bufferctx.moveTo(x1, y1);
        bufferctx.lineTo(x2, y2);
        bufferctx.stroke();
    }
    
    // Círculos concéntricos pulsantes
    var circleCount = 5;
    for (var c = 0; c < circleCount; c++) {
        var delay = c * 0.1;
        var pulse = (transitionProgress + delay) % 1;
        var radius = 30 + (pulse * 250);
        var alpha = Math.max(0, 1 - pulse);
        
        bufferctx.strokeStyle = 'rgba(255, 107, 0, ' + alpha * 0.8 + ')';
        bufferctx.lineWidth = 3;
        bufferctx.beginPath();
        bufferctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        bufferctx.stroke();
    }
    
    // Barras de energía verticales en los costados
    var barWidth = 8;
    var barCount = 12;
    for (var b = 0; b < barCount; b++) {
        var barX = (b / barCount) * canvas.width;
        var barHeight = 50 + (Math.sin(transitionProgress * Math.PI * 4 + b * 0.5) * 80);
        bufferctx.fillStyle = 'rgba(255, 107, 0, 0.6)';
        bufferctx.fillRect(barX, centerY - barHeight / 2, barWidth, barHeight);
    }
    
    // Efecto de relámpago tipo arcade
    if (transitionProgress > 0.3 && transitionProgress < 0.7) {
        bufferctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
        bufferctx.lineWidth = 4;
        var lightningX = centerX + (Math.random() - 0.5) * 50;
        bufferctx.beginPath();
        bufferctx.moveTo(centerX - 100, centerY - 150);
        bufferctx.lineTo(lightningX, centerY);
        bufferctx.lineTo(centerX + 100, centerY + 150);
        bufferctx.stroke();
    }
    
    // Destello blanco pulsante
    var flashIntensity = Math.sin(transitionProgress * Math.PI * 6) * 0.5 + 0.2;
    bufferctx.fillStyle = 'rgba(255, 255, 255, ' + flashIntensity * 0.4 + ')';
    bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Texto del nivel con sombra dramática
    bufferctx.font = 'bold 72px monospace';
    bufferctx.globalAlpha = 0.3;
    bufferctx.fillStyle = '#000000';
    bufferctx.fillText('LEVEL 3', canvas.width/2 - 95, canvas.height/2 - 15);
    
    bufferctx.globalAlpha = 0.5 + (transitionProgress * 0.5);
    bufferctx.fillStyle = '#FF6B00';
    bufferctx.fillText('LEVEL 3', canvas.width/2 - 90, canvas.height/2 - 20);
    
    // Subtítulo con efecto de escritura
    bufferctx.font = 'bold 28px monospace';
    bufferctx.fillStyle = '#FFAA00';
    var subtitleAlpha = Math.sin(transitionProgress * Math.PI * 3) * 0.3 + 0.4;
    bufferctx.globalAlpha = subtitleAlpha;
    bufferctx.fillText('⚡ PUNTO SIN RETORNO ⚡', canvas.width/2 - 200, canvas.height/2 + 60);
    bufferctx.globalAlpha = 1.0;
}

/**
 * Transición Nivel 3 a Jefe Final: Explosión épica tipo arcade
 */
function drawTransitionLevel3toBoss() {
    // Fondo rojo degradado
    var gradient = bufferctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#4a0000');
    gradient.addColorStop(0.5, '#1a0000');
    gradient.addColorStop(1, '#6a0000');
    bufferctx.fillStyle = gradient;
    bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    
    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;
    
    // Onda de choque expansiva (principal)
    var shockWave = transitionProgress * 500;
    bufferctx.strokeStyle = 'rgba(255, 0, 0, ' + (1 - transitionProgress) + ')';
    bufferctx.lineWidth = 5;
    bufferctx.beginPath();
    bufferctx.arc(centerX, centerY, 20 + shockWave, 0, Math.PI * 2);
    bufferctx.stroke();
    
    // Múltiples ondas de choque en cascada
    for (var w = 1; w <= 4; w++) {
        var delay = w * 0.15;
        var waveProgress = Math.max(0, transitionProgress - delay);
        var waveRadius = 20 + (waveProgress * 400);
        var waveAlpha = Math.max(0, 1 - (waveProgress * 1.5));
        
        bufferctx.strokeStyle = 'rgba(255, ' + Math.floor(107 - w * 25) + ', 0, ' + waveAlpha * 0.7 + ')';
        bufferctx.lineWidth = 4 - w * 0.5;
        bufferctx.beginPath();
        bufferctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
        bufferctx.stroke();
    }
    
    // Partículas de fuego/explosión más grandes y numerosas
    var particleCount = 50;
    for (var p = 0; p < particleCount; p++) {
        var angle = (p / particleCount) * Math.PI * 2 + transitionProgress * Math.PI;
        var distance = transitionProgress * 400 + Math.sin(p) * 50;
        var px = centerX + Math.cos(angle) * distance;
        var py = centerY + Math.sin(angle) * distance;
        
        var particleSize = 5 + (Math.sin(p * 0.3) * 8);
        var particleAlpha = 1 - transitionProgress;
        
        bufferctx.fillStyle = 'rgba(255, ' + Math.floor(100 + Math.sin(p) * 155) + ', 0, ' + particleAlpha + ')';
        bufferctx.fillRect(px - particleSize / 2, py - particleSize / 2, particleSize, particleSize);
    }
    
    // Rayos de fuego en líneas desde el centro
    bufferctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
    bufferctx.lineWidth = 3;
    var rayCount = 16;
    for (var r = 0; r < rayCount; r++) {
        var rayAngle = (r / rayCount) * Math.PI * 2;
        var rayLength = transitionProgress * 350;
        var rayEndX = centerX + Math.cos(rayAngle) * rayLength;
        var rayEndY = centerY + Math.sin(rayAngle) * rayLength;
        
        bufferctx.beginPath();
        bufferctx.moveTo(centerX, centerY);
        bufferctx.lineTo(rayEndX, rayEndY);
        bufferctx.stroke();
    }
    
    // Destello nuclear
    var flashSize = Math.max(0, transitionProgress - 0.2);
    bufferctx.fillStyle = 'rgba(255, 255, 100, ' + (1 - flashSize) * 0.5 + ')';
    bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Efecto de vibración/distorsión
    if (transitionProgress < 0.8) {
        var vibration = Math.sin(transitionProgress * Math.PI * 20) * 3;
        bufferctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        bufferctx.lineWidth = 2;
        bufferctx.strokeRect(vibration, vibration, canvas.width - vibration * 2, canvas.height - vibration * 2);
    }
    
    // Texto del jefe con efecto épico
    var bossTextAlpha = Math.max(0, transitionProgress - 0.25) / 0.75;
    
    // Sombra del texto
    bufferctx.font = 'bold 80px monospace';
    bufferctx.globalAlpha = bossTextAlpha * 0.4;
    bufferctx.fillStyle = '#000000';
    bufferctx.fillText('⚔ JEFE ⚔', centerX - 140, centerY - 25);
    
    // Texto principal rojo
    bufferctx.globalAlpha = bossTextAlpha * 0.8;
    bufferctx.fillStyle = '#FF0000';
    bufferctx.fillText('⚔ JEFE ⚔', centerX - 135, centerY - 30);
    
    // Efecto de brillo dorado
    bufferctx.globalAlpha = bossTextAlpha * 0.5;
    bufferctx.fillStyle = '#FFFF00';
    bufferctx.fillText('⚔ JEFE ⚔', centerX - 130, centerY - 35);
    
    // Subtítulo dramático
    bufferctx.font = 'bold 32px monospace';
    bufferctx.globalAlpha = bossTextAlpha;
    bufferctx.fillStyle = '#FFAA00';
    bufferctx.fillText('¡ENFRENTA TU DESTINO!', centerX - 230, centerY + 80);
    
    bufferctx.globalAlpha = 1.0;
}

/**
 * Dibuja un escudo estilo arcade cuando el jugador tiene el escudo activo.
 */
function drawShieldEffect() {
    var shieldColor = '#4ECDC4';  // Azul claro del escudo
    var playerCenterX = player.posX + player.width / 2;
    var playerCenterY = player.posY + player.height / 2;
    var shieldRadius = 45;
    
    // Efecto pulsante: varía la opacidad según el tiempo
    var pulseValue = (Math.sin(now * 5) + 1) / 2;  // Oscila entre 0 y 1
    var alpha = 0.3 + (pulseValue * 0.3);  // Oscila entre 0.3 y 0.6
    
    // Guardar el alpha actual
    bufferctx.globalAlpha = alpha;
    
    // Dibujar circulo de escudo
    bufferctx.strokeStyle = shieldColor;
    bufferctx.lineWidth = 3;
    bufferctx.beginPath();
    bufferctx.arc(playerCenterX, playerCenterY, shieldRadius, 0, Math.PI * 2);
    bufferctx.stroke();
    
    // Dibujar algunos "rayos" alrededor del escudo para efecto arcade
    bufferctx.lineWidth = 2;
    for (var i = 0; i < 8; i++) {
        var angle = (i / 8) * Math.PI * 2;
        var x1 = playerCenterX + Math.cos(angle) * shieldRadius;
        var y1 = playerCenterY + Math.sin(angle) * shieldRadius;
        var x2 = playerCenterX + Math.cos(angle) * (shieldRadius + 10);
        var y2 = playerCenterY + Math.sin(angle) * (shieldRadius + 10);
        
        bufferctx.beginPath();
        bufferctx.moveTo(x1, y1);
        bufferctx.lineTo(x2, y2);
        bufferctx.stroke();
    }
    
    // Restaurar el alpha
    bufferctx.globalAlpha = 1.0;
}

/** Muestra la pantalla de derrota mediante el overlay. */
function showGameOver() {
    stopBackgroundAudio();  // Detiene el sonido de fondo
    showOverlay('gameOver');
}

/**
 * Muestra la pantalla de victoria mediante el overlay.
 */
function showCongratulations() {
    showOverlay('victory');
}

/**
 * Dibuja el fondo del juego en el buffer.
 * Usa bgBoss cuando el enemigo activo es un FinalBoss; de lo contrario usa bgMain.
 */
function drawBackground() {
    bufferctx.drawImage(evil instanceof FinalBoss ? bgBoss : bgMain, 0, 0);
}

/**
 * Actualiza la posición y animación del enemigo activo.
 * Si sale de pantalla, reaparece en la parte superior (llama evil.reappear()).
 */
function updateEvil(dt) {
    if (!evil.dead) {
        evil.update(dt);
        if (evil.isOutOfScreen()) {
            applySlowdownPenalty();  // Aplicar penalización cuando el enemigo se escapa
            evil.reappear();
        }
    }
}

/**
 * Actualiza un disparo del jugador: mueve hacia arriba, detecta colisión con el enemigo
 * y lo elimina si sale de pantalla o impacta.
 * @param {PlayerShot} shot - El proyectil a actualizar.
 * @param {number} id - Índice del proyectil en playerShotsBuffer.
 */
function updatePlayerShot(shot, id, dt) {
    if (shot) {
        shot.identifier = id;
        if (checkCollisions(shot)) {
            if (shot.posY > 0) {
                shot.posY -= shot.speed * dt * 60;
                bufferctx.drawImage(shot.image, shot.posX, shot.posY);
            } else {
                shot.deleteShot(parseInt(shot.identifier));
            }
        }
    }
}

/**
 * Actualiza un disparo enemigo: mueve hacia abajo, detecta colisión con el jugador
 * y lo elimina si sale de pantalla o impacta.
 * @param {EvilShot} shot - El proyectil a actualizar.
 * @param {number} id - Índice del proyectil en evilShotsBuffer.
 */
function updateEvilShot(shot, id, dt) {
    if (shot) {
        shot.identifier = id;
        if (!shot.isHittingPlayer()) {
            if (shot.posY <= canvas.height) {
                shot.posY += shot.speed * dt * 60;
                bufferctx.drawImage(shot.image, shot.posX, shot.posY);
            } else {
                shot.deleteShot(parseInt(shot.identifier));
            }
        } else {
            // Solo dañar al jugador si el escudo no está activo
            if (!shieldActive) {
                playSound('Sonidos/Perdida_vida.mp3', 0.8);
                player.killPlayer();
                onPlayerDamaged();
            }
            // Eliminar el disparo en ambos casos
            shot.deleteShot(parseInt(shot.identifier));
        }
    }
}

/**
 * Actualiza un poder: mueve hacia abajo, lo renderiza.
 * @param {Object} power - El poder a actualizar.
 * @param {number} id - Índice del poder en powersBuffer.
 * @param {number} dt - Delta time en segundos.
 */
function updatePower(power, id, dt) {
    if (!power) {
        return;
    }
    
    // Actualizar posición
    power.posY += power.speed * dt * 60;
    
    // Si hay imagen, dibujarla; si no, usar color y emoji
    if (power.image && power.image.complete) {
        // Dibujar imagen
        bufferctx.drawImage(power.image, power.posX, power.posY, power.width, power.height);
    } else {
        // Dibujar fondo de color
        bufferctx.fillStyle = power.color || '#FFFFFF';
        bufferctx.fillRect(power.posX, power.posY, power.width, power.height);
        
        // Dibujar emoji
        bufferctx.fillStyle = '#000000';
        bufferctx.font = 'bold 28px Arial';
        bufferctx.textAlign = 'center';
        bufferctx.textBaseline = 'middle';
        var emoji = power.emoji || '?';
        bufferctx.fillText(emoji, power.posX + power.width / 2, power.posY + power.height / 2);
        bufferctx.textAlign = 'left';
    }
    
    // Borde del poder (siempre se dibuja)
    bufferctx.strokeStyle = '#FFFFFF';
    bufferctx.lineWidth = 2;
    bufferctx.strokeRect(power.posX, power.posY, power.width, power.height);
}

/******************************* API PÚBLICA *******************************/

/** Objeto público del juego. Solo expone init() para ser llamado desde el HTML. */
var game = { init: init };
