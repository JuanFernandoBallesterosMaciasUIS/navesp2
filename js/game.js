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
    fire:  32     // tecla espacio
};

var nextPlayerShot  = 0;
var playerShotDelay = CONFIG.PLAYER_SHOT_DELAY;
var now             = 0;
var playerName      = '';

var overlay, startContent, endContent, nameInput, startButton, restartButton, finalText;
var finalAnimationTick = 0;
var gameStarted = false;

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
    nameInput     = document.getElementById('playerName');
    startButton   = document.getElementById('startButton');
    restartButton = document.getElementById('restartButton');
    finalText     = document.getElementById('finalText');

    addListener(document, 'keydown', keyDown);
    addListener(document, 'keyup', keyUp);
    addListener(startButton, 'click', startGame);
    addListener(restartButton, 'click', function() {
        showOverlay('start');
    });
    addListener(nameInput, 'keydown', function (e) {
        var key = (window.event ? e.keyCode : e.which);
        if (key === 13) {
            e.preventDefault();
            startGame();
        }
    });

    showOverlay('start');

    function anim() {
        loop();
        requestAnimFrame(anim);
    }
    anim();
}

/**
 * Muestra el overlay con el contenido especificado.
 * @param {'start'|'end'} type - 'start' para el formulario de inicio; 'end' para la pantalla de fin.
 */
function showOverlay(type) {
    overlay.classList.remove('hidden');
    if (type === 'start') {
        startContent.classList.remove('hidden');
        endContent.classList.add('hidden');
        nameInput.value = playerName || '';
        nameInput.focus();
    } else {
        startContent.classList.add('hidden');
        endContent.classList.remove('hidden');
    }
}

/** Oculta el overlay de la UI. */
function hideOverlay() {
    overlay.classList.add('hidden');
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
    playerLife    = CONFIG.PLAYER_LIVES;
    totalEvils    = CONFIG.EVIL_TOTAL;
    evilCounter   = 1;
    youLose       = false;
    congratulations = false;
    playerShotsBuffer = [];
    evilShotsBuffer   = [];
    now            = 0;
    nextPlayerShot = 0;
    finalAnimationTick = 0;
    player = new Player(playerLife, 0);
    createNewEvil();
    showLifeAndScore();
}

/******************************* GESTIÓN DE ENEMIGOS *******************************/

/**
 * Decide qué ocurre tras matar a un enemigo:
 * - Si quedan enemigos, programa la creación del siguiente con un retardo aleatorio.
 * - Si no quedan, inicia la secuencia de victoria (animación + overlay final).
 */
function verifyToCreateNewEvil() {
    if (totalEvils > 0) {
        setTimeout(spawnNextEvil, getRandomNumber(CONFIG.NEW_EVIL_MAX_DELAY));
    } else {
        setTimeout(startVictorySequence, CONFIG.CONGRATS_DELAY);
    }
}

/** Crea el siguiente enemigo e incrementa el contador de oleadas. */
function spawnNextEvil() {
    createNewEvil();
    evilCounter++;
}

/** Guarda la puntuación, activa la animación de victoria y programa el overlay final. */
function startVictorySequence() {
    saveFinalScore();
    congratulations = true;
    finalText.textContent = '¡ENHORABUENA, ' + playerName + '! Has ganado.';
    setTimeout(showVictoryOverlay, CONFIG.CONGRATS_OVERLAY_DELAY);
}

/** Muestra el overlay de fin de partida y detiene la animación de victoria. */
function showVictoryOverlay() {
    showOverlay('end');
    congratulations = false;
}

/**
 * Crea el siguiente enemigo y lo asigna a la variable `evil`.
 * Crea un FinalBoss cuando totalEvils === 1; en caso contrario, crea un Evil
 * con vidas y disparos incrementados según evilCounter.
 */
function createNewEvil() {
    if (totalEvils !== 1) {
        evil = new Evil(evilLife + evilCounter - 1, evilShots + evilCounter - 1);
    } else {
        evil = new FinalBoss();
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
 * @param {KeyboardEvent} e - El evento de teclado.
 */
function keyDown(e) {
    var key = (window.event ? e.keyCode : e.which);
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
 * Retorna temprano si el juego no ha comenzado, está en victoria o en derrota.
 */
function update() {
    drawBackground();

    if (!gameStarted) {
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
function showLifeAndScore() {
    bufferctx.fillStyle = 'rgb(59,59,59)';
    bufferctx.font = 'bold 16px Arial';
    bufferctx.fillText('Puntos: ' + player.score, canvas.width - 100, 20);
    bufferctx.fillText('Vidas: ' + player.life,   canvas.width - 100, 40);
}

/** Dibuja el texto "GAME OVER" centrado en el buffer durante el estado de derrota. */
function showGameOver() {
    bufferctx.fillStyle = 'rgb(255,0,0)';
    bufferctx.font = 'bold 35px Arial';
    bufferctx.fillText('GAME OVER', canvas.width / 2 - 100, canvas.height / 2);
}

/**
 * Dibuja la animación de victoria en el buffer: texto pulsante con puntuación final
 * y esferas animadas. Llamada en cada frame mientras congratulations === true.
 */
function showCongratulations() {
    finalAnimationTick++;
    var pulseColor = (finalAnimationTick % 30 < 15) ? 'rgb(255,255,0)' : 'rgb(255,255,255)';
    bufferctx.fillStyle = pulseColor;
    bufferctx.font = 'bold 24px Arial';
    bufferctx.fillText('¡ENHORABUENA, ' + playerName + '!', canvas.width / 2 - 210, canvas.height / 2 - 40);
    bufferctx.font = 'bold 22px Arial';
    bufferctx.fillText('PUNTOS: ' + player.score,      canvas.width / 2 - 210, canvas.height / 2);
    bufferctx.fillText('VIDAS: ' + player.life + ' x ' + CONFIG.SCORE_LIFE_BONUS, canvas.width / 2 - 210, canvas.height / 2 + 35);
    bufferctx.fillText('TOTAL: ' + getTotalScore(),    canvas.width / 2 - 210, canvas.height / 2 + 70);
    for (var i = 0; i < 6; i++) {
        bufferctx.beginPath();
        bufferctx.arc(80 + i * 90, 120 + ((finalAnimationTick * (i + 1)) % 40), 6, 0, Math.PI * 2);
        bufferctx.fill();
    }
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
