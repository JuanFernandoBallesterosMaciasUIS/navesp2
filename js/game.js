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
var evilShotImage, playerShotImage, playerKilledImage, powerVidaImage, powerDisparoImage, powerVelocidadImage;

var evilImages  = { animation: [], killed: null };
var bossImages  = { animation: [], killed: null };

var backgroundAudio = null;  // Variable para el sonido de fondo
var backgroundAudioPaused = false;  // Variable para rastrear si el sonido está pausado

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
var speedBoostActive = false;
var speedBoostTimeout = null;
var originalPlayerSpeed = CONFIG.PLAYER_SPEED;

var overlay, startContent, endContent, pauseContent, mainMenuContent, tutorialContent, optionsContent, gameOverContent, victoryContent;
var especificacionesContent, mainMenuScoresPanel;
var gameLeftPanel, gameScoresPanel, mainMenuLeftPanel;
var logrosContent, logrosButton, backFromLogrosButton;
var nameInput, startButton, restartButton, resumeButton, exitButton, finalText;
var playButton, backButton, tutorialButton, optionsButton, quitButton, especificacionesButton;
var backFromTutorialButton, backFromOptionsButton, backFromEspecificacionesButton;
var gameOverRestartButton, gameOverMenuButton, victoryRestartButton, victoryMenuButton;
var soundToggleBtn;  // Botón de control de sonido
var finalAnimationTick = 0;
var gameStarted = false;
var gamePaused = false;
var levelTransitionActive = false;  // Variable para controlar la transición de nivel

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
    powerVelocidadImage = createImage('images/podervelocidad.png');
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
        backgroundAudio.src = 'Sonidos/Sonido_fondo.mp3';
        backgroundAudio.loop = true;
        backgroundAudio.volume = 0.5;  // Volumen al 50%
    }
    backgroundAudio.play();
    backgroundAudioPaused = false;
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
        showOverlay('start');
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
function togglePause() {
    if (gameStarted && !youLose && !congratulations) {
        gamePaused = !gamePaused;
        if (gamePaused) {
            showOverlay('pause');
        } else {
            hideOverlay();
        }
    }
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
    initBackgroundAudio();  // Inicia el sonido de fondo
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
    speedBoostActive = false;
    if (doubleFireTimeout) clearTimeout(doubleFireTimeout);
    if (speedBoostTimeout) clearTimeout(speedBoostTimeout);
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
    speedBoostActive = false;
    if (doubleFireTimeout) clearTimeout(doubleFireTimeout);
    if (speedBoostTimeout) clearTimeout(speedBoostTimeout);
    applyLevelConfiguration(currentLevel);
    player.speed = playerSpeed;  // Restaurar velocidad original del nuevo nivel
    originalPlayerSpeed = playerSpeed;  // Actualizar velocidad original para el nuevo nivel
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
 * Si mata al enemigo, hay probabilidad de crear un poder aleatorio.
 * @param {PlayerShot} shot - El disparo a evaluar.
 * @returns {boolean} false si hubo impacto; true si el disparo puede continuar.
 */
function checkCollisions(shot) {
    if (shot.isHittingEvil()) {
        if (evil.life > 1) {
            evil.life--;
        } else {
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
        var types = ['vida', 'dobleDisparo', 'velocidad'];
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
                   (randomType === 'dobleDisparo') ? '#FFD93D' : '#6BCB77',
            emoji: (randomType === 'vida') ? '❤️' : 
                   (randomType === 'dobleDisparo') ? '🔫' : '⚡',
            image: (randomType === 'vida') ? powerVidaImage : 
                   (randomType === 'dobleDisparo') ? powerDisparoImage : powerVelocidadImage
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
            break;
        
        case 'dobleDisparo':
            // Activa disparo doble por 5 segundos
            if (doubleFireTimeout) {
                clearTimeout(doubleFireTimeout);
            }
            doubleFireActive = true;
            doubleFireTimeout = setTimeout(function() {
                doubleFireActive = false;
            }, CONFIG.POWER_DURATION);
            break;
        
        case 'velocidad':
            // Aumenta velocidad por 5 segundos
            if (speedBoostTimeout) {
                clearTimeout(speedBoostTimeout);
            }
            player.speed = originalPlayerSpeed * 2.0;
            speedBoostActive = true;
            speedBoostTimeout = setTimeout(function() {
                player.speed = originalPlayerSpeed;
                speedBoostActive = false;
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
    bufferctx.fillText(hearts, canvas.width - 100, 45);
    
    // Mostrar indicadores de efectos activos
    var yOffset = 60;
    if (doubleFireActive) {
        bufferctx.fillStyle = '#FFD93D';
        bufferctx.font = 'bold 14px Arial';
        bufferctx.fillText('🔫 Disparo Doble Activo', 10, yOffset);
        yOffset += 20;
    }
    if (speedBoostActive) {
        bufferctx.fillStyle = '#6BCB77';
        bufferctx.font = 'bold 14px Arial';
        bufferctx.fillText('⚡ Velocidad Activa', 10, yOffset);
    }
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
 * Si sale de pantalla, lo elimina (llama evil.kill()).
 */
function updateEvil(dt) {
    if (!evil.dead) {
        evil.update(dt);
        if (evil.isOutOfScreen()) {
            evil.kill();
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
            player.killPlayer();            onPlayerDamaged();        }
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
