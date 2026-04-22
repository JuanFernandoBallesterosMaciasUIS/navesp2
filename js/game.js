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
var evils = [];  // Array de enemigos activos simultáneamente
var bgMain, bgBoss;
var currentWaveSize = 1;  // Tamaño de la horda actual (aumenta 1 por horda)
var bossNextMinionType = 0;  // 0=Murciélago, 1=Cangrejo, 2=Estrella (ciclo de esbirros del jefe)

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
var sparklesBuffer    = [];    // Buffer para las partículas de explosión
var evilShotImage, playerShotImage, playerKilledImage, powerVidaImage, powerDisparoImage, powerEscudoImage;

var evilImages  = { animation: [], killed: null };
var bossImages  = { animation: [], killed: null };
var starImages  = { animation: [], killed: null };  // Imágenes para la estrellita
var crabImages  = { animation: [], killed: null };  // Imágenes para el cangrejo

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
 * Escala una imagen a un tamaño específico creando un canvas con la imagen redimensionada.
 * @param {HTMLImageElement} img - La imagen a escalar.
 * @param {number} width - Ancho destino en píxeles.
 * @param {number} height - Alto destino en píxeles.
 * @returns {HTMLCanvasElement|HTMLImageElement} Canvas o imagen escalada.
 */
function scaleImage(img, width, height) {
    if (!img || !img.complete || img.width === 0) {
        return img;  // Retornar la imagen original si no está lista
    }
    
    var scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = width;
    scaledCanvas.height = height;
    var ctx = scaledCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    return scaledCanvas;
}

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
    
    // Cargar imagen de la estrellita y escalarla a un tamaño apropiado
    var starImg = createImage('images/estrellita.png');
    // Usar una imagen placeholder temporal mientras se carga
    starImages.animation[0] = createImage('images/malo1.png');
    starImages.killed = createImage('images/malo1.png');
    
    starImg.onload = function() {
        starImages.animation[0] = scaleImage(starImg, 100, 100);
        starImages.killed = starImages.animation[0];
    };
    
    // Cargar imágenes del cangrejo (6 frames de animación) y escalarlas
    // Usar placeholder temporal mientras se cargan
    for (var j = 0; j < 6; j++) {
        crabImages.animation[j] = createImage('images/malo1.png');
    }
    crabImages.killed = createImage('images/malo1.png');
    
    for (var j = 1; j <= 6; j++) {
        var crabImg = createImage('images/Cangrejo_animacion/Cangrejo_' + j + '.png');
        // Escalar cada frame a 80x80 píxeles
        (function(img, index) {
            img.onload = function() {
                crabImages.animation[index] = scaleImage(img, 80, 80);
            };
        })(crabImg, j - 1);
    }
    
    // Cargar imagen del cangrejo muerto
    var crabKilledImg = createImage('images/Cangrejo_animacion/Cangrejo_1.png');
    crabKilledImg.onload = function() {
        crabImages.killed = scaleImage(crabKilledImg, 100, 100);
    };
    
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
        now = timestamp;
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

function updateControlButtonsVisibility() {
    var visibility = gamePaused ? 'hidden' : 'visible';
    if (restartLevelBtn) restartLevelBtn.style.visibility = visibility;
    if (soundToggleBtn) soundToggleBtn.style.visibility = visibility;
    if (pauseButton) pauseButton.style.visibility = visibility;
}

function togglePause() {
    if (gameStarted && !youLose && !congratulations) {
        gamePaused = !gamePaused;
        updatePauseButtonLabel();
        updateControlButtonsVisibility();
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
    updateControlButtonsVisibility();
    playerShotsBuffer = [];
    evilShotsBuffer = [];
    sparklesBuffer = [];  // Limpiar partículas de explosión
    evils = [];  // Limpiar enemigos activos
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
    powersBuffer      = [];    // Limpiar poderes
    sparklesBuffer    = [];    // Limpiar partículas de explosión
    killAllActiveEnemies();    // Corta cadenas de disparo y limpia evils + evilShotsBuffer
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
        currentWaveSize = 1;  // Reiniciar hordas al comenzar cada nivel
        
        // Configurar estadísticas del jefe final para el nivel 4
        if (levelNumber === 4) {
            finalBossLife = CONFIG.BOSS_LIFE + 8;  // Jefe más fuerte en nivel 4
            finalBossShots = CONFIG.BOSS_SHOTS + 15;
            bossNextMinionType = 0;  // Reiniciar ciclo de esbirros
        }
    }
}

/******************************* GESTIÓN DE ENEMIGOS *******************************/

/**
 * Verifica si todos los enemigos activos han sido eliminados.
 * Si todos están muertos, programa la creación del siguiente lote de enemigos.
 */
function verifyToCreateNewEvil() {
    // Contar enemigos vivos
    var aliveEnemies = 0;
    for (var i = 0; i < evils.length; i++) {
        if (!evils[i].dead) {
            aliveEnemies++;
        }
    }
    
    // Si no hay enemigos vivos, crear el siguiente
    if (aliveEnemies === 0) {
        if (totalEvils > 0) {
            currentWaveSize++;  // Siguiente horda tiene un enemigo más
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
}

/** Crea el siguiente enemigo e incrementa el contador de oleadas. */
function spawnNextEvil() {
    createNewEvil();
    evilCounter++;
}

/**
 * Marca todos los enemigos activos como muertos para cortar sus cadenas de disparo,
 * y limpia los buffers de disparos enemigos y el array de enemigos.
 */
function killAllActiveEnemies() {
    for (var i = 0; i < evils.length; i++) {
        evils[i].dead = true;  // Detiene el setTimeout de shoot() de cada instancia
        // Si es una estrellita, limpiar también su timeout propio
        if (evils[i].shotTimeout) {
            clearTimeout(evils[i].shotTimeout);
            evils[i].shotTimeout = null;
        }
    }
    evils = [];
    evilShotsBuffer = [];
}

/**
 * [DEBUG] Salta directamente al nivel indicado (1-4).
 * @param {number} targetLevel - Nivel destino.
 */
function debugJumpToLevel(targetLevel) {
    if (targetLevel < 1 || targetLevel > 4) return;
    if (targetLevel === currentLevel) return;
    if (gamePaused) togglePause();  // Reanudar si estaba pausado
    var livesBeforeTransition = player ? player.life : 0;
    currentLevel = targetLevel - 1;  // startNextLevel hará currentLevel++
    evilCounter = 1;
    playerShotsBuffer = [];
    powersBuffer = [];
    sparklesBuffer = [];
    killAllActiveEnemies();  // Corta cadenas de disparo y limpia evils + evilShotsBuffer
    doubleFireActive = false;
    shieldActive = false;
    lifeEffectActive = false;
    if (doubleFireTimeout) clearTimeout(doubleFireTimeout);
    if (shieldTimeout) clearTimeout(shieldTimeout);
    if (lifeEffectTimeout) clearTimeout(lifeEffectTimeout);
    applyLevelConfiguration(targetLevel);
    currentLevel = targetLevel;
    player.speed = playerSpeed;
    originalPlayerSpeed = playerSpeed;
    changeTrack(getMusicTrackForLevel(currentLevel));
    onLevelChanged(currentLevel, livesBeforeTransition);
    showLevelTransition();
    createNewEvil();
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
    powersBuffer = [];   // Limpiar poderes al cambiar de nivel
    sparklesBuffer = []; // Limpiar partículas de explosión al cambiar de nivel
    killAllActiveEnemies();  // Corta cadenas de disparo y limpia evils + evilShotsBuffer
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
    playSound('Sonidos/Sonido_victoria.mp3', 0.8);  // Reproduce el sonido de victoria
    showOverlay('victory');
    congratulations = false;
}

/**
 * Retorna cuántos esbirros debe haber en pantalla según la vida actual del jefe.
 * Fase 1 (>66% vida): 1 esbirro. Fase 2 (>33%): 2. Fase 3 (≤33%): 3.
 * @param {number} bossLife    - Vida actual del jefe.
 * @param {number} bossMaxLife - Vida máxima del jefe.
 * @returns {number} Número de esbirros objetivo.
 */
function getBossTargetMinions(bossLife, bossMaxLife) {
    var pct = bossLife / bossMaxLife;
    if (pct > 0.66) return 1;
    if (pct > 0.33) return 2;
    return 3;
}

/**
 * Crea un esbirro para el nivel del jefe, ciclando entre Evil→Crab→Star
 * y evitando repetir el mismo tipo si ya está vivo en pantalla.
 * @returns {Enemy} Nuevo esbirro con isBossMinion=true.
 */
function createBossMinion() {
    // Recolectar tipos de esbirros ya vivos
    var liveTypes = [];
    for (var i = 0; i < evils.length; i++) {
        if (evils[i].isBossMinion && !evils[i].dead) {
            liveTypes.push(evils[i]._minionType);
        }
    }
    // Avanzar ciclo hasta encontrar un tipo que no esté ya en pantalla
    var type = bossNextMinionType;
    var attempts = 0;
    while (liveTypes.indexOf(type) !== -1 && attempts < 3) {
        type = (type + 1) % 3;
        attempts++;
    }
    bossNextMinionType = (type + 1) % 3;

    var minion;
    if (type === 0) {
        minion = new Evil(evilLife, evilShots);
    } else if (type === 1) {
        minion = new Crab();
    } else {
        minion = new Star();
    }
    minion.isBossMinion = true;
    minion._minionType = type;
    return minion;
}

/**
 * Reemplaza un esbirro muerto del jefe si aún hacen falta según la fase actual.
 * Llamado desde Enemy.kill() cuando isBossMinion===true.
 */
function spawnBossMinion() {
    if (currentLevel !== 4 || youLose || congratulations) return;
    // Verificar que el jefe siga vivo
    var boss = null;
    for (var i = 0; i < evils.length; i++) {
        if (evils[i] instanceof FinalBoss && !evils[i].dead) {
            boss = evils[i];
            break;
        }
    }
    if (!boss) return;  // Jefe ya muerto, no reponer esbirros

    var liveMinions = 0;
    for (var j = 0; j < evils.length; j++) {
        if (evils[j].isBossMinion && !evils[j].dead) liveMinions++;
    }
    var target = getBossTargetMinions(boss.life, boss.maxLife);
    if (liveMinions < target) {
        evils.push(createBossMinion());
    }
}

/**
 * Comprueba si el jefe acaba de cruzar un umbral de fase y, si es así,
 * añade esbirros adicionales inmediatamente.
 * @param {FinalBoss} boss - Instancia del jefe.
 */
function checkBossPhase(boss) {
    var liveMinions = 0;
    for (var i = 0; i < evils.length; i++) {
        if (evils[i].isBossMinion && !evils[i].dead) liveMinions++;
    }
    var target = getBossTargetMinions(boss.life, boss.maxLife);
    while (liveMinions < target) {
        evils.push(createBossMinion());
        liveMinions++;
    }
}

/**
 * Crea el siguiente enemigo y lo asigna a la variable `evil`.
 * Crea un FinalBoss en el nivel 4; en caso contrario, crea un Evil
 * con vidas y disparos incrementados según evilCounter.
 * Con probabilidad, puede crear una estrellita especial en niveles 2-3.
 */
function createNewEvil() {
    if (currentLevel === 4) {
        // Nivel 4: crear el jefe + primer esbirro de la fase 1
        var boss = new FinalBoss();
        evils.push(boss);
        evil = boss;
        evils.push(createBossMinion());
        return;
    }

    // Número de enemigos a crear esta horda (respetando los que quedan)
    var enemyCount = Math.min(currentWaveSize, totalEvils);
    
    for (var i = 0; i < enemyCount; i++) {
        var newEvil;
        if (currentLevel === 4) {
            // Nivel 4: JEFE FINAL (siempre uno)
            newEvil = new FinalBoss();
        } else if (currentLevel === 3 && getRandomNumber(100) < 30) {
            // Nivel 3: 30% de probabilidad de crear una estrellita
            newEvil = new Star();
        } else if ((currentLevel === 2 || currentLevel === 3) && getRandomNumber(100) < 50) {
            // Niveles 2-3: 50% de probabilidad de crear un cangrejo
            newEvil = new Crab();
        } else {
            // Nivel 1: solo murciélagos. Niveles 2-3: murciélagos como resto
            newEvil = new Evil(evilLife + evilCounter - 1, evilShots + evilCounter - 1);
        }
        
        evils.push(newEvil);
        if (i === 0) {
            evil = newEvil;  // Mantener compatibilidad con la variable evil
        }
    }
}

/******************************* COLISIONES *******************************/

/**
 * Detecta colisión AABB entre el cuerpo del enemigo activo y el jugador.
 * @returns {boolean} true si el enemigo está tocando al jugador.
 */
function isEvilHittingPlayer() {
    // Verificar si alguno de los enemigos activos está tocando al jugador
    for (var i = 0; i < evils.length; i++) {
        var e = evils[i];
        if (!e.dead && ((e.posY + e.image.height) > player.posY && (player.posY + player.height) >= e.posY) &&
            ((player.posX >= e.posX && player.posX <= (e.posX + e.image.width)) ||
                (player.posX + player.width >= e.posX && (player.posX + player.width) <= (e.posX + e.image.width)))) {
            return true;
        }
    }
    return false;
}

/**
 * Verifica si un disparo del jugador impactó algún enemigo activo.
 * Si hay impacto: reduce la vida del enemigo (o lo mata) y elimina el disparo.
 * Si mata al enemigo, hay probabilidad de crear un poder aleatorio.
 * @param {PlayerShot} shot - El disparo a evaluar.
 * @returns {boolean} false si hubo impacto; true si el disparo puede continuar.
 */
function checkCollisions(shot) {
    // Verificar colisión con cada enemigo activo
    for (var i = evils.length - 1; i >= 0; i--) {
        var currentEvil = evils[i];
        if (!currentEvil.dead && shot.posX >= currentEvil.posX && shot.posX <= (currentEvil.posX + currentEvil.image.width) &&
            shot.posY >= currentEvil.posY && shot.posY <= (currentEvil.posY + currentEvil.image.height)) {
            
            if (currentEvil.life > 1) {
                playSound('Sonidos/Boom.mp3', 1);
                currentEvil.life--;
                // Si es el jefe, verificar si cambió de fase y añadir esbirros
                if (currentEvil instanceof FinalBoss) {
                    checkBossPhase(currentEvil);
                }
            } else {
                if (currentEvil instanceof FinalBoss) {
                    playSound('Sonidos/Boom_nave_Final.mp3', 1);
                } else {
                    playSound('Sonidos/Boom.mp3', 1);
                }
                
                // Crear chispas de explosión
                var centerX = currentEvil.posX + currentEvil.image.width / 2;
                var centerY = currentEvil.posY + currentEvil.image.height / 2;
                createExplosionSparkles(centerX, centerY);
                
                currentEvil.kill();
                player.score += currentEvil.pointsToKill;
                // Crear poder aleatorio al matar un enemigo
                createRandomPower(currentEvil.posX + currentEvil.image.width / 2, currentEvil.posY);
                onEnemyKilled();
                
                // Remover enemigo muerto del array si ha estado muerto un tiempo
                // Lo dejamos por ahora para que se muestre la animación de muerte
            }
            shot.deleteShot(parseInt(shot.identifier));
            return false;
        }
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
    
    // [DEBUG] Teclas 1-4 para saltar de nivel
    if (key >= 49 && key <= 52 && !youLose && !congratulations && gameStarted) {
        e.preventDefault();
        debugJumpToLevel(key - 48);
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
        // Dibujar todos los enemigos activos
        for (var i = 0; i < evils.length; i++) {
            bufferctx.drawImage(evils[i].image, evils[i].posX, evils[i].posY);
        }
        drawAllEnemyLifeBars();
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

    // Parpadeo del jugador durante inmunidad (cada 100ms alterna entre 20% y 100% de opacidad)
    if (player.immuneUntil && Date.now() < player.immuneUntil) {
        bufferctx.globalAlpha = (Math.floor(Date.now() / 100) % 2 === 0) ? 0.2 : 1.0;
    }
    bufferctx.drawImage(player, player.posX, player.posY);
    bufferctx.globalAlpha = 1.0;
    if (lifeEffectActive) drawLifeEffect();
    if (doubleFireActive) drawDoubleFirEffect();
    if (shieldActive) drawShieldEffect();
    
    // Dibujar todos los enemigos activos
    for (var i = 0; i < evils.length; i++) {
        var evilToDraw = evils[i];
        bufferctx.drawImage(evilToDraw.image, evilToDraw.posX, evilToDraw.posY);
    }
    drawAllEnemyLifeBars();

    updateAllEvils(dt);
    updateSlowdownEffect();  // Actualizar efecto de lentitud

    // Actualizar y renderizar poderes
    for (var p = 0; p < powersBuffer.length; p++) {
        updatePower(powersBuffer[p], p, dt);
    }
    checkPowerCollisions();

    // Actualizar y renderizar partículas de explosión
    updateSparkles(dt);

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

/**
 * Dibuja las barras de vida para todos los enemigos activos.
 */
function drawAllEnemyLifeBars() {
    for (var i = 0; i < evils.length; i++) {
        var e = evils[i];
        if (!e.dead) {
            var barWidth = 60;
            var barHeight = 8;
            var barX = e.posX + (e.image.width - barWidth) / 2;
            var barY = e.posY - 15;
            
            var lifePercent = e.life / e.maxLife;
            var filledWidth = barWidth * lifePercent;
            
            // Dibujar fondo
            bufferctx.fillStyle = '#333333';
            bufferctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Dibujar barra de vida
            var hue = lifePercent * 120;
            bufferctx.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
            bufferctx.fillRect(barX, barY, filledWidth, barHeight);
            
            // Dibujar borde
            bufferctx.strokeStyle = '#FFFFFF';
            bufferctx.lineWidth = 1;
            bufferctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    }
}

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

    // Mostrar total de bajas acumuladas en la sesión
    bufferctx.fillStyle = '#FFA07A';
    bufferctx.font = 'bold 12px Arial';
    bufferctx.fillText('Bajas: ' + sessionKills, 10, 57);

    // [DEBUG] Indicador de teclas de nivel
    bufferctx.textAlign = 'right';
    bufferctx.fillStyle = 'rgba(255,255,100,0.55)';
    bufferctx.font = '10px monospace';
    bufferctx.fillText('[DEBUG] 1·2·3·4 = saltar nivel', canvas.width - 5, canvas.height - 5);
    
    // Dibujar corazones rojos en lugar de número de vidas
    bufferctx.textAlign = 'right';
    bufferctx.fillStyle = '#FF0000';
    bufferctx.font = 'bold 24px Arial';
    var hearts = '';
    for (var i = 0; i < player.life; i++) {
        hearts += '\u2665 ';
    }
    bufferctx.fillText(hearts, canvas.width - 5, 45);
    
    // Mostrar indicadores de efectos activos
    bufferctx.textAlign = 'left';
    var yOffset = 75;
    if (doubleFireActive) {
        bufferctx.fillStyle = '#FFD93D';
        bufferctx.font = 'bold 14px Arial';
        bufferctx.fillText('🔫 Disparo Doble Activo', 20, yOffset);
        yOffset += 20;
    }
    if (shieldActive) {
        bufferctx.fillStyle = '#4ECDC4';
        bufferctx.font = 'bold 14px Arial';
        bufferctx.fillText('🛡️ Escudo Activo', 20, yOffset);
    }
    bufferctx.textAlign = 'left';
}

/**
 * Dibuja cañones laterales estilo arcade cuando el jugador tiene doble disparo activo.
 */
function drawDoubleFirEffect() {
    var cannonColor = '#FFD93D';  // Amarillo para los cañones
    var glowColor = '#FFFF00';   // Amarillo brillante
    var playerCenterX = player.posX + player.width / 2;
    var playerCenterY = player.posY + player.height / 2;
    
    // Múltiples pulsos para efecto más dinámico
    var pulseValue = (Math.sin(now * 8) + 1) / 2;  // Oscila entre 0 y 1
    var pulseValue2 = (Math.sin(now * 6 + 2) + 1) / 2;  // Desfasado
    var pulse3 = (Math.sin(now * 10) + 1) / 2;  // Más rápido
    bufferctx.globalAlpha = 0.7 + (pulseValue * 0.3);  // Base más visible
    
    // CAÑÓN IZQUIERDO
    var leftCannonX = player.posX + 8;
    var leftCannonY = player.posY + 20;
    
    // Brillo radiante izquierdo (círculos pulsantes)
    var glowRadius1 = 15 + pulse3 * 5;
    bufferctx.fillStyle = 'rgba(255, 217, 61, ' + (0.15 - pulseValue * 0.1) + ')';
    bufferctx.beginPath();
    bufferctx.arc(leftCannonX + 7, leftCannonY + 11, glowRadius1, 0, Math.PI * 2);
    bufferctx.fill();
    
    var glowRadius2 = 10 + pulseValue2 * 8;
    bufferctx.fillStyle = 'rgba(255, 255, 0, ' + (0.2 - pulseValue2 * 0.15) + ')';
    bufferctx.beginPath();
    bufferctx.arc(leftCannonX + 7, leftCannonY + 11, glowRadius2, 0, Math.PI * 2);
    bufferctx.fill();
    
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
    
    // Punta del cañón izquierdo (triángulo con brillo)
    bufferctx.fillStyle = glowColor;
    bufferctx.beginPath();
    bufferctx.moveTo(leftCannonX + 5, leftCannonY - 8);
    bufferctx.lineTo(leftCannonX + 11, leftCannonY - 8);
    bufferctx.lineTo(leftCannonX + 8, leftCannonY - 14);
    bufferctx.fill();
    
    // Rayos de energía desde la punta
    bufferctx.strokeStyle = 'rgba(255, 255, 0, ' + (0.6 + pulseValue * 0.4) + ')';
    bufferctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
        var angle = (i / 4) * Math.PI * 2 - Math.PI / 2 + (now / 500);
        var startX = leftCannonX + 8;
        var startY = leftCannonY - 14;
        var endX = startX + Math.cos(angle) * (8 + pulseValue * 4);
        var endY = startY + Math.sin(angle) * (8 + pulseValue * 4);
        bufferctx.beginPath();
        bufferctx.moveTo(startX, startY);
        bufferctx.lineTo(endX, endY);
        bufferctx.stroke();
    }
    
    // Destello intenso en la punta
    bufferctx.fillStyle = 'rgba(255, 255, 255, ' + (0.6 + pulseValue * 0.4) + ')';
    bufferctx.beginPath();
    bufferctx.arc(leftCannonX + 8, leftCannonY - 12, 2.5 + pulseValue * 1, 0, Math.PI * 2);
    bufferctx.fill();
    
    // CAÑÓN DERECHO - MISMO EFECTO
    var rightCannonX = player.posX + player.width - 14;
    var rightCannonY = player.posY + 20;
    
    // Brillo radiante derecho
    var glowRadiusR1 = 15 + pulse3 * 5;
    bufferctx.fillStyle = 'rgba(255, 217, 61, ' + (0.15 - pulseValue * 0.1) + ')';
    bufferctx.beginPath();
    bufferctx.arc(rightCannonX + 7, rightCannonY + 11, glowRadiusR1, 0, Math.PI * 2);
    bufferctx.fill();
    
    var glowRadiusR2 = 10 + pulseValue2 * 8;
    bufferctx.fillStyle = 'rgba(255, 255, 0, ' + (0.2 - pulseValue2 * 0.15) + ')';
    bufferctx.beginPath();
    bufferctx.arc(rightCannonX + 7, rightCannonY + 11, glowRadiusR2, 0, Math.PI * 2);
    bufferctx.fill();
    
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
    
    // Rayos de energía desde la punta derecha
    bufferctx.strokeStyle = 'rgba(255, 255, 0, ' + (0.6 + pulseValue * 0.4) + ')';
    bufferctx.lineWidth = 1;
    for (var j = 0; j < 4; j++) {
        var angleR = (j / 4) * Math.PI * 2 - Math.PI / 2 - (now / 500);
        var startXR = rightCannonX + 6;
        var startYR = rightCannonY - 14;
        var endXR = startXR + Math.cos(angleR) * (8 + pulseValue * 4);
        var endYR = startYR + Math.sin(angleR) * (8 + pulseValue * 4);
        bufferctx.beginPath();
        bufferctx.moveTo(startXR, startYR);
        bufferctx.lineTo(endXR, endYR);
        bufferctx.stroke();
    }
    
    // Destello intenso en la punta derecha
    bufferctx.fillStyle = 'rgba(255, 255, 255, ' + (0.6 + pulseValue * 0.4) + ')';
    bufferctx.beginPath();
    bufferctx.arc(rightCannonX + 6, rightCannonY - 12, 2.5 + pulseValue * 1, 0, Math.PI * 2);
    bufferctx.fill();
    
    // Aura amarilla dinámica alrededor del jugador
    bufferctx.strokeStyle = 'rgba(255, 217, 61, ' + (0.4 + pulseValue * 0.3) + ')';
    bufferctx.lineWidth = 3;
    bufferctx.beginPath();
    bufferctx.rect(player.posX - 8, player.posY - 8, player.width + 16, player.height + 16);
    bufferctx.stroke();
    
    // Aura interior más sutil
    bufferctx.strokeStyle = 'rgba(255, 255, 0, ' + (0.2 + pulseValue2 * 0.2) + ')';
    bufferctx.lineWidth = 1;
    bufferctx.beginPath();
    bufferctx.rect(player.posX - 12, player.posY - 12, player.width + 24, player.height + 24);
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
 * Transición Nivel 1 a 2: Efecto de barrido simple tipo arcade
 */
function drawTransitionLevel1to2() {
    // Fondo oscuro
    bufferctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Línea de barrido que se mueve de izquierda a derecha
    var barX = -canvas.width + (transitionProgress * canvas.width * 2);
    bufferctx.fillStyle = 'rgba(129, 199, 132, 0.4)';
    bufferctx.fillRect(barX, 0, canvas.width / 4, canvas.height);
    
    // Líneas horizontales tipo CRT
    bufferctx.strokeStyle = 'rgba(129, 199, 132, 0.3)';
    bufferctx.lineWidth = 1;
    for (var i = 0; i < canvas.height; i += 20) {
        bufferctx.beginPath();
        bufferctx.moveTo(0, i);
        bufferctx.lineTo(canvas.width, i);
        bufferctx.stroke();
    }
    
    // Efecto de fade in del texto
    var textAlpha = Math.min(1, transitionProgress * 2);
    bufferctx.textAlign = 'center';
    bufferctx.globalAlpha = textAlpha;
    
    // Primera línea
    bufferctx.font = 'bold 24px monospace';
    bufferctx.fillStyle = '#81c784';
    bufferctx.fillText('NIVEL 1 COMPLETADO', canvas.width / 2, canvas.height / 2 - 80);
    
    // Segunda línea más grande
    bufferctx.font = 'bold 40px monospace';
    bufferctx.fillStyle = '#FFD700';
    bufferctx.fillText('DESBLOQUEANDO NIVEL 2', canvas.width / 2, canvas.height / 2 - 10);
    
    // Subtítulo
    bufferctx.font = 'bold 16px monospace';
    bufferctx.fillStyle = '#81c784';
    bufferctx.fillText('Primer encuentro...', canvas.width / 2, canvas.height / 2 + 60);
    
    bufferctx.globalAlpha = 1.0;
    bufferctx.textAlign = 'left';
}

/**
 * Transición Nivel 2 a 3: Pulso de energía simple
 */
function drawTransitionLevel2to3() {
    // Fondo oscuro
    bufferctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    
    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;
    
    // Pulsación central creciente - escalada al tamaño del canvas
    var maxRadius = Math.min(canvas.width, canvas.height) * 0.35;
    var pulseRadius = transitionProgress * maxRadius;
    bufferctx.strokeStyle = '#ff4500';
    bufferctx.lineWidth = 3;
    bufferctx.beginPath();
    bufferctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
    bufferctx.stroke();
    
    // Anillos secundarios
    for (var r = 1; r <= 3; r++) {
        var delay = r * 0.2;
        if (transitionProgress > delay) {
            var ringProgress = (transitionProgress - delay) / (1 - delay);
            var ringRadius = ringProgress * maxRadius;
            var ringAlpha = 1 - ringProgress;
            bufferctx.strokeStyle = 'rgba(255, 69, 0, ' + ringAlpha * 0.6 + ')';
            bufferctx.lineWidth = 2;
            bufferctx.beginPath();
            bufferctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
            bufferctx.stroke();
        }
    }
    
    // Líneas radiales
    bufferctx.strokeStyle = 'rgba(129, 199, 132, 0.5)';
    bufferctx.lineWidth = 1;
    var radialLength = Math.min(canvas.width, canvas.height) * 0.25;
    for (var angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        var endX = centerX + Math.cos(angle) * (transitionProgress * radialLength);
        var endY = centerY + Math.sin(angle) * (transitionProgress * radialLength);
        bufferctx.beginPath();
        bufferctx.moveTo(centerX, centerY);
        bufferctx.lineTo(endX, endY);
        bufferctx.stroke();
    }
    
    // Texto
    var textAlpha = Math.min(1, transitionProgress * 2);
    bufferctx.textAlign = 'center';
    bufferctx.globalAlpha = textAlpha;
    
    // Primera línea
    bufferctx.font = 'bold 24px monospace';
    bufferctx.fillStyle = '#ff4500';
    bufferctx.fillText('NIVEL 2 COMPLETADO', centerX, centerY - 90);
    
    // Segunda línea más grande
    bufferctx.font = 'bold 40px monospace';
    bufferctx.fillStyle = '#FFD700';
    bufferctx.fillText('DESBLOQUEANDO NIVEL 3', centerX, centerY - 20);
    
    // Subtítulo
    bufferctx.font = 'bold 16px monospace';
    bufferctx.fillStyle = '#81c784';
    bufferctx.fillText('El poder se intensifica...', centerX, centerY + 70);
    
    bufferctx.globalAlpha = 1.0;
    bufferctx.textAlign = 'left';
}

/**
 * Transición Nivel 3 a Jefe Final: Efecto de enfoque intenso
 */
function drawTransitionLevel3toBoss() {
    // Fondo oscuro
    bufferctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    
    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;
    var maxRadius = Math.min(canvas.width, canvas.height) * 0.35;
    
    // Pulsaciones múltiples
    for (var p = 0; p < 3; p++) {
        var delay = p * 0.2;
        if (transitionProgress > delay) {
            var pulseProgress = (transitionProgress - delay) / (1 - delay);
            var radius = pulseProgress * maxRadius;
            var alpha = (1 - pulseProgress) * 0.8;
            bufferctx.strokeStyle = 'rgba(255, 69, 0, ' + alpha + ')';
            bufferctx.lineWidth = 4;
            bufferctx.beginPath();
            bufferctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            bufferctx.stroke();
        }
    }
    
    // Líneas de energía que se expanden
    bufferctx.strokeStyle = 'rgba(255, 69, 0, 0.6)';
    bufferctx.lineWidth = 2;
    var rayCount = 12;
    var rayLength = Math.min(canvas.width, canvas.height) * 0.3;
    for (var i = 0; i < rayCount; i++) {
        var angle = (i / rayCount) * Math.PI * 2;
        var length = transitionProgress * rayLength;
        var endX = centerX + Math.cos(angle) * length;
        var endY = centerY + Math.sin(angle) * length;
        bufferctx.beginPath();
        bufferctx.moveTo(centerX, centerY);
        bufferctx.lineTo(endX, endY);
        bufferctx.stroke();
    }
    
    // Núcleo central pulsante
    var coreAlpha = 0.5 + (Math.sin(transitionProgress * Math.PI * 4) * 0.5);
    bufferctx.fillStyle = 'rgba(255, 69, 0, ' + coreAlpha + ')';
    bufferctx.beginPath();
    bufferctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    bufferctx.fill();
    
    // Efecto de brillo blanco cuando está completo
    if (transitionProgress > 0.5) {
        var glowAlpha = (transitionProgress - 0.5) * 0.8;
        bufferctx.fillStyle = 'rgba(255, 255, 255, ' + glowAlpha + ')';
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Texto del jefe
    var textAlpha = Math.min(1, transitionProgress * 2);
    bufferctx.textAlign = 'center';
    bufferctx.globalAlpha = textAlpha;
    
    // Primera línea
    bufferctx.font = 'bold 24px monospace';
    bufferctx.fillStyle = '#ff4500';
    bufferctx.fillText('NIVEL 3 COMPLETADO', centerX, centerY - 90);
    
    // Segunda línea más grande
    bufferctx.font = 'bold 40px monospace';
    bufferctx.fillStyle = '#FFD700';
    bufferctx.fillText('ENCONTRANDO AL BOSS', centerX, centerY - 20);
    
    // Subtítulo
    bufferctx.font = 'bold 16px monospace';
    bufferctx.fillStyle = '#81c784';
    bufferctx.fillText('La batalla final te espera...', centerX, centerY + 70);
    
    bufferctx.globalAlpha = 1.0;
    bufferctx.textAlign = 'left';
}

/**
 * Dibuja un escudo estilo arcade cuando el jugador tiene el escudo activo.
 */
function drawShieldEffect() {
    var shieldColorInner = '#00FFFF';  // Cyan brillante interior
    var shieldColorOuter = '#4ECDC4';  // Azul claro exterior
    var playerCenterX = player.posX + player.width / 2;
    var playerCenterY = player.posY + player.height / 2;
    var shieldRadius = 45;
    
    // Múltiples pulsos desfasados para efecto más dinámico
    var pulseValue = (Math.sin(now * 5) + 1) / 2;  // Oscila entre 0 y 1
    var pulseValue2 = (Math.sin(now * 4 + 1.5) + 1) / 2;  // Desfasado
    var pulseValue3 = (Math.sin(now * 6) + 1) / 2;  // Más rápido
    
    // Capas de brillo radiante del escudo
    var glowRadius1 = shieldRadius + 15 + pulseValue2 * 10;
    bufferctx.globalAlpha = 0.15 - pulseValue * 0.08;
    bufferctx.fillStyle = shieldColorOuter;
    bufferctx.beginPath();
    bufferctx.arc(playerCenterX, playerCenterY, glowRadius1, 0, Math.PI * 2);
    bufferctx.fill();
    
    var glowRadius2 = shieldRadius + 8 + pulseValue3 * 6;
    bufferctx.globalAlpha = 0.25 - pulseValue2 * 0.12;
    bufferctx.fillStyle = shieldColorInner;
    bufferctx.beginPath();
    bufferctx.arc(playerCenterX, playerCenterY, glowRadius2, 0, Math.PI * 2);
    bufferctx.fill();
    
    // Círculo principal del escudo con gradiente
    bufferctx.globalAlpha = 0.4 + (pulseValue * 0.25);
    bufferctx.strokeStyle = shieldColorInner;
    bufferctx.lineWidth = 3;
    bufferctx.beginPath();
    bufferctx.arc(playerCenterX, playerCenterY, shieldRadius, 0, Math.PI * 2);
    bufferctx.stroke();
    
    // Círculo exterior adicional
    bufferctx.globalAlpha = 0.3 + (pulseValue2 * 0.2);
    bufferctx.strokeStyle = shieldColorOuter;
    bufferctx.lineWidth = 1.5;
    bufferctx.beginPath();
    bufferctx.arc(playerCenterX, playerCenterY, shieldRadius + 5, 0, Math.PI * 2);
    bufferctx.stroke();
    
    // Rayos rotativos alrededor del escudo para efecto arcade mejorado
    bufferctx.globalAlpha = 0.35 + (pulseValue3 * 0.3);
    bufferctx.lineWidth = 2.5;
    var rayCount = 12;  // Más rayos para efecto más denso
    var rotationOffset = (now / 1000) * Math.PI;  // Rotación continua
    
    for (var i = 0; i < rayCount; i++) {
        var angle = (i / rayCount) * Math.PI * 2 + rotationOffset;
        var rayLength = 15 + pulseValue * 8;
        var x1 = playerCenterX + Math.cos(angle) * shieldRadius;
        var y1 = playerCenterY + Math.sin(angle) * shieldRadius;
        var x2 = playerCenterX + Math.cos(angle) * (shieldRadius + rayLength);
        var y2 = playerCenterY + Math.sin(angle) * (shieldRadius + rayLength);
        
        // Alternar colores en los rayos
        if (i % 3 === 0) {
            bufferctx.strokeStyle = shieldColorInner;
        } else {
            bufferctx.strokeStyle = shieldColorOuter;
        }
        
        bufferctx.beginPath();
        bufferctx.moveTo(x1, y1);
        bufferctx.lineTo(x2, y2);
        bufferctx.stroke();
    }
    
    // Patrón de puntos pulsantes alrededor del escudo
    bufferctx.globalAlpha = 0.5 + (pulseValue2 * 0.35);
    bufferctx.fillStyle = shieldColorInner;
    for (var j = 0; j < 8; j++) {
        var dotAngle = (j / 8) * Math.PI * 2;
        var dotX = playerCenterX + Math.cos(dotAngle) * (shieldRadius - 8);
        var dotY = playerCenterY + Math.sin(dotAngle) * (shieldRadius - 8);
        bufferctx.beginPath();
        bufferctx.arc(dotX, dotY, 2 + pulseValue * 1.5, 0, Math.PI * 2);
        bufferctx.fill();
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
 * Actualiza todos los enemigos activos y elimina los muertos del array.
 */
function updateAllEvils(dt) {
    for (var i = evils.length - 1; i >= 0; i--) {
        var currentEvil = evils[i];
        if (!currentEvil.dead) {
            currentEvil.update(dt);
            if (currentEvil.isOutOfScreen()) {
                applySlowdownPenalty();
                currentEvil.reappear();
            }
        } else {
            // Rastrear tiempo desde la muerte
            if (!currentEvil.deathTime) {
                currentEvil.deathTime = 0;
            }
            currentEvil.deathTime += dt;
            
            // Remover enemigo muerto después de 0.5 segundos (para que se muestren las chispas)
            if (currentEvil.deathTime >= 0.5) {
                evils.splice(i, 1);
            }
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
            // Verificar si es un disparo que rebota (StarShot)
            if (shot.velocityX !== undefined) {
                // Es un StarShot - aplicar movimiento con rebote
                shot.posX += shot.velocityX * dt * 60;
                shot.posY += shot.velocityY * dt * 60;
                
                // Rebote en bordes laterales
                if (shot.posX <= 0 || shot.posX >= canvas.width - shot.image.width) {
                    shot.velocityX *= -1;  // Invertir dirección horizontal
                }
                
                // Eliminar si sale de la pantalla (arriba o abajo)
                if (shot.posY > canvas.height) {
                    shot.deleteShot(parseInt(shot.identifier));
                    return;
                }
            } else {
                // Disparo normal (no rebota)
                shot.posY += shot.speed * dt * 60;
                
                if (shot.posY > canvas.height) {
                    shot.deleteShot(parseInt(shot.identifier));
                    return;
                }
            }
            
            bufferctx.drawImage(shot.image, shot.posX, shot.posY);
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

/**
 * Crea chispas de explosión cuando muere un enemigo.
 * @param {number} x - Posición horizontal del centro de la explosión.
 * @param {number} y - Posición vertical del centro de la explosión.
 */
function createExplosionSparkles(x, y) {
    var sparkleCount = 12 + getRandomNumber(8);  // 12-20 chispas
    var colors = ['#FFD700', '#FFA500', '#FF6B6B', '#FF4500', '#FFD93D'];
    
    for (var i = 0; i < sparkleCount; i++) {
        var angle = (Math.PI * 2 * i) / sparkleCount + (Math.random() - 0.5);
        var speed = 3 + Math.random() * 5;
        var life = 0.3 + Math.random() * 0.7;  // 0.3 a 1 segundo
        
        var sparkle = {
            posX: x + Math.cos(angle) * 5,
            posY: y + Math.sin(angle) * 5,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            life: life,
            maxLife: life,
            radius: 2 + Math.random() * 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            gravity: 2  // Caída por gravedad
        };
        
        sparklesBuffer.push(sparkle);
    }
}

/**
 * Actualiza y dibuja todas las partículas de explosión.
 * @param {number} dt - Delta time desde el último frame.
 */
function updateSparkles(dt) {
    for (var i = sparklesBuffer.length - 1; i >= 0; i--) {
        var sparkle = sparklesBuffer[i];
        
        // Actualizar posición
        sparkle.posX += sparkle.velocityX * dt * 60;
        sparkle.posY += sparkle.velocityY * dt * 60;
        
        // Aplicar gravedad
        sparkle.velocityY += sparkle.gravity * dt * 10;
        
        // Reducir vida
        sparkle.life -= dt;
        
        // Dibujar chispa
        var alpha = sparkle.life / sparkle.maxLife;  // Desvanecimiento
        bufferctx.globalAlpha = alpha;
        bufferctx.fillStyle = sparkle.color;
        bufferctx.beginPath();
        bufferctx.arc(sparkle.posX, sparkle.posY, sparkle.radius, 0, Math.PI * 2);
        bufferctx.fill();
        bufferctx.globalAlpha = 1;
        
        // Remover si se acabó la vida
        if (sparkle.life <= 0) {
            sparklesBuffer.splice(i, 1);
        }
    }
}

/******************************* API PÚBLICA *******************************/

/** Objeto público del juego. Solo expone init() para ser llamado desde el HTML. */
var game = { init: init };
