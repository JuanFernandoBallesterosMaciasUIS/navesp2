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
var nameInput, startButton, restartButton, resumeButton, exitButton, finalText;
var playButton, backButton, tutorialButton, optionsButton, quitButton;
var backFromTutorialButton, backFromOptionsButton;
var gameOverRestartButton, gameOverMenuButton, victoryRestartButton, victoryMenuButton;
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
    gameOverContent = document.getElementById('gameOverContent');
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
    gameOverRestartButton = document.getElementById('gameOverRestartButton');
    gameOverMenuButton = document.getElementById('gameOverMenuButton');
    victoryRestartButton = document.getElementById('victoryRestartButton');
    victoryMenuButton = document.getElementById('victoryMenuButton');

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
    addListener(quitButton, 'click', function() {
        alert('¡Gracias por jugar!');
    });
    addListener(backFromTutorialButton, 'click', function() {
        showOverlay('mainMenu');
    });
    addListener(backFromOptionsButton, 'click', function() {
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
    addListener(nameInput, 'keydown', function (e) {
        var key = (window.event ? e.keyCode : e.which);
        if (key === 13) {
            e.preventDefault();
            startGame();
        }
    });

    showOverlay('mainMenu');

    function anim() {
        loop();
        requestAnimFrame(anim);
    }
    anim();
}

/**
 * Muestra el overlay con el contenido especificado.
 * @param {'mainMenu'|'nameInput'|'tutorial'|'options'|'end'|'pause'|'levelTransition'} type - El tipo de overlay a mostrar.
 */
function showOverlay(type) {
    overlay.classList.remove('hidden');
    
    // Ocultar todos primero
    mainMenuContent.classList.add('hidden');
    startContent.classList.add('hidden');
    endContent.classList.add('hidden');
    pauseContent.classList.add('hidden');
    tutorialContent.classList.add('hidden');
    optionsContent.classList.add('hidden');
    gameOverContent.classList.add('hidden');
    victoryContent.classList.add('hidden');
    
    if (type === 'mainMenu') {
        mainMenuContent.classList.remove('hidden');
        gameStarted = false;
        gamePaused = false;
    } else if (type === 'nameInput') {
        startContent.classList.remove('hidden');
        nameInput.value = playerName || '';
        nameInput.focus();
    } else if (type === 'tutorial') {
        tutorialContent.classList.remove('hidden');
    } else if (type === 'options') {
        optionsContent.classList.remove('hidden');
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
    resetGameState();
    hideOverlay();
    gameStarted = true;
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
    currentLevel++;
    evilCounter = 1;
    playerShotsBuffer = [];
    evilShotsBuffer = [];
    applyLevelConfiguration(currentLevel);
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
    saveFinalScore();
    congratulations = true;
    finalText.textContent = '¡ENHORABUENA, ' + playerName + '! Has ganado.';
    setTimeout(showVictoryOverlay, CONFIG.CONGRATS_OVERLAY_DELAY);
}

/** Muestra el overlay de victoria. */
function showVictoryOverlay() {
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
            evil.life--;
        } else {
            evil.kill();
            player.score += evil.pointsToKill;
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
function playerAction() {
    player.doAnything();
}

/******************************* GAME LOOP *******************************/

/**
 * Ejecuta un frame del juego: actualiza el estado y dibuja en pantalla.
 * Es llamada en cada pulso de requestAnimFrame (~60 fps).
 */
function loop() {
    update();
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
function update() {
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

    updateEvil();

    for (var j = 0; j < playerShotsBuffer.length; j++) {
        updatePlayerShot(playerShotsBuffer[j], j);
    }

    if (isEvilHittingPlayer()) {
        player.killPlayer();
    } else {
        for (var i = 0; i < evilShotsBuffer.length; i++) {
            updateEvilShot(evilShotsBuffer[i], i);
        }
    }

    showLifeAndScore();
    playerAction();
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
    bufferctx.fillStyle = '#90EE90';
    bufferctx.font = 'bold 16px Arial';
    bufferctx.fillText('Puntos: ' + player.score, canvas.width - 100, 20);
    
    // Mostrar nivel
    bufferctx.fillStyle = '#FFD700';
    bufferctx.font = 'bold 14px Arial';
    bufferctx.fillText('Nivel ' + currentLevel, 10, 20);
    
    // Mostrar enemigos restantes
    bufferctx.fillStyle = '#87CEEB';
    bufferctx.font = 'bold 12px Arial';
    var enemyText = 'Enemigos: ' + totalEvils + (currentLevel === 4 ? ' (JEFE)' : '');
    bufferctx.fillText(enemyText, 10, 40);
    
    // Dibujar corazones rojos en lugar de número de vidas
    bufferctx.fillStyle = '#FF0000';
    bufferctx.font = 'bold 24px Arial';
    var hearts = '';
    for (var i = 0; i < player.life; i++) {
        hearts += '\u2665 ';
    }
    bufferctx.fillText(hearts, canvas.width - 100, 45);
}

/** Muestra la pantalla de derrota mediante el overlay. */
function showGameOver() {
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
function updateEvil() {
    if (!evil.dead) {
        evil.update();
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
function updatePlayerShot(shot, id) {
    if (shot) {
        shot.identifier = id;
        if (checkCollisions(shot)) {
            if (shot.posY > 0) {
                shot.posY -= shot.speed;
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
function updateEvilShot(shot, id) {
    if (shot) {
        shot.identifier = id;
        if (!shot.isHittingPlayer()) {
            if (shot.posY <= canvas.height) {
                shot.posY += shot.speed;
                bufferctx.drawImage(shot.image, shot.posX, shot.posY);
            } else {
                shot.deleteShot(parseInt(shot.identifier));
            }
        } else {
            player.killPlayer();
        }
    }
}

/******************************* API PÚBLICA *******************************/

/** Objeto público del juego. Solo expone init() para ser llamado desde el HTML. */
var game = { init: init };
