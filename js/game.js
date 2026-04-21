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
var evilShotImage, playerShotImage, playerKilledImage;

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
}

/******************************* ESCALA DEL CANVAS ****************************/

/**
 * Escala el canvas para que ocupe el máximo espacio posible manteniendo
 * la proporción original (canvas.width × canvas.height), sin distorsión.
 * Usa CSS transform para no afectar las coordenadas internas del juego.
 */
function scaleCanvas() {
    if (!canvas) { return; }
    var availableWidth = window.innerWidth - 2 * CONFIG.MIN_PANEL_WIDTH;
    var scaleX = availableWidth / canvas.width;
    var scaleY = window.innerHeight / canvas.height;
    var scale  = Math.min(scaleX, scaleY);
    canvas.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    var panelWidth = Math.floor((window.innerWidth - canvas.width * scale) / 2);
    var panels = [gameLeftPanel, gameScoresPanel, mainMenuLeftPanel, mainMenuScoresPanel];
    for (var i = 0; i < panels.length; i++) {
        if (panels[i]) { panels[i].style.width = panelWidth + 'px'; }
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
    now            = 0;
    nextPlayerShot = 0;
    finalAnimationTick = 0;
    applyLevelConfiguration(currentLevel);
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
    applyLevelConfiguration(currentLevel);
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
            onEnemyKilled();
        }
        shot.deleteShot(parseInt(shot.identifier));
        return false;
    }
    return true;
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
        // Durante la transición de nivel, mostrar el mensaje
        bufferctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        bufferctx.fillStyle = '#FFD700';
        bufferctx.font = 'bold 32px Arial';
        var levelConfig = CONFIG.LEVELS[currentLevel];
        bufferctx.fillText(levelConfig.name, canvas.width/2 - 150, canvas.height/2);
        return;
    }
    if (gamePaused) {
        bufferctx.drawImage(player, player.posX, player.posY);
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
    bufferctx.drawImage(evil.image, evil.posX, evil.posY);
    drawEnemyLifeBar();

    updateEvil(dt);
    updateSlowdownEffect();  // Actualizar efecto de lentitud

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
    bufferctx.fillStyle = '#FFD700';
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
    bufferctx.fillText(hearts, canvas.width - 5, 45);
    bufferctx.textAlign = 'left';
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
            playSound('Sonidos/Perdida_vida.mp3', 0.8);
            player.killPlayer();
            onPlayerDamaged();
        }
    }
}

/******************************* API PÚBLICA *******************************/

/** Objeto público del juego. Solo expone init() para ser llamado desde el HTML. */
var game = { init: init };
