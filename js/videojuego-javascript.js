/**
 * ARCHIVO OBSOLETO — No cargar en naves.html.
 *
 * Este archivo fue el monolito original del juego. Ha sido dividido en:
 *   js/config.js   — constantes de configuración
 *   js/utils.js    — funciones utilitarias y polyfill
 *   js/entities.js — constructores de entidades (Player, Enemy, Shot…)
 *   js/scores.js   — gestión de puntuaciones (localStorage)
 *   js/game.js     — game loop, renderizado, colisiones, UI
 *
 * Se conserva solo para referencia histórica y comparación de diferencias.
 */

// nos marca los pulsos del juego
window.requestAnimFrame = (function () {
    return  window.requestAnimationFrame        ||
        window.webkitRequestAnimationFrame  ||
        window.mozRequestAnimationFrame     ||
        window.oRequestAnimationFrame       ||
        window.msRequestAnimationFrame      ||
        function ( /* function */ callback, /* DOMElement */ element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();
var game = (function () {

    // Constantes de configuración del juego — modificar aquí para ajustar parámetros
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
        CONGRATS_OVERLAY_DELAY: 2000  // ms de espera dentro del overlay de victoria
    };

    // Variables globales a la aplicacion
    var canvas,
        ctx,
        buffer,
        bufferctx,
        player,
        evil,
        playerShot,
        bgMain,
        bgBoss,
        evilSpeed = CONFIG.EVIL_BASE_SPEED,
        totalEvils = CONFIG.EVIL_TOTAL,
        playerLife = CONFIG.PLAYER_LIVES,
        shotSpeed = CONFIG.SHOT_SPEED,
        playerSpeed = CONFIG.PLAYER_SPEED,
        evilCounter = 0,
        youLose = false,
        congratulations = false,
        minHorizontalOffset = CONFIG.EVIL_MIN_HORIZONTAL_OFFSET,
        maxHorizontalOffset = CONFIG.EVIL_MAX_HORIZONTAL_OFFSET,
        evilShots = CONFIG.EVIL_BASE_SHOTS,
        evilLife = CONFIG.EVIL_BASE_LIFE,
        finalBossShots = CONFIG.BOSS_SHOTS,
        finalBossLife = CONFIG.BOSS_LIFE,
        totalBestScoresToShow = CONFIG.TOP_SCORES_TO_SHOW,
        playerShotsBuffer = [],
        evilShotsBuffer = [],
        evilShotImage,
        playerShotImage,
        playerKilledImage,
        evilImages = {
            animation : [],
            killed : new Image()
        },
        bossImages = {
            animation : [],
            killed : new Image()
        },
        keyPressed = {},
        keyMap = {
            left: 37,
            right: 39,
            fire: 32     // tecla espacio
        },
        nextPlayerShot = 0,
        playerShotDelay = CONFIG.PLAYER_SHOT_DELAY,
        now = 0,
        playerName = '',
        overlay,
        startContent,
        endContent,
        nameInput,
        startButton,
        restartButton,
        finalText,
        finalAnimationTick = 0,
        gameStarted = false;

    /**
     * Ejecuta un frame del juego: actualiza el estado y dibuja en pantalla.
     * Es llamada en cada pulso de requestAnimFrame (~60 fps).
     */
    function loop() {
        update();
        draw();
    }

    /**
     * Precarga todas las imágenes del juego antes de que empiece la partida.
     * Almacena las imágenes en las variables globales del closure:
     * evilImages, bossImages, bgMain, bgBoss, playerShotImage, evilShotImage, playerKilledImage.
     */
    function preloadImages () {
        for (var i = 1; i <= 8; i++) {
            evilImages.animation[i-1] = createImage('images/malo' + i + '.png');
            bossImages.animation[i-1] = createImage('images/jefe' + i + '.png');
        }
        evilImages.killed  = createImage('images/malo_muerto.png');
        bossImages.killed  = createImage('images/jefe_muerto.png');
        bgMain             = createImage('images/fondovertical.png');
        bgBoss             = createImage('images/fondovertical_jefe.png');
        playerShotImage    = createImage('images/disparo_bueno.png');
        evilShotImage      = createImage('images/disparo_malo.png');
        playerKilledImage  = createImage('images/bueno_muerto.png');
    }

    /**
     * Punto de entrada público del juego. Inicializa el canvas, el doble buffer,
     * los elementos del DOM, los event listeners y arranca el game loop.
     * Debe llamarse una sola vez al cargar la página: game.init().
     */
    function init() {

        preloadImages();

        showBestScores();

        canvas = document.getElementById('canvas');
        ctx = canvas.getContext("2d");

        buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        bufferctx = buffer.getContext('2d');

        overlay = document.getElementById('overlay');
        startContent = document.getElementById('startContent');
        endContent = document.getElementById('endContent');
        nameInput = document.getElementById('playerName');
        startButton = document.getElementById('startButton');
        restartButton = document.getElementById('restartButton');
        finalText = document.getElementById('finalText');

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

        function anim () {
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
        playerLife = CONFIG.PLAYER_LIVES;
        totalEvils = CONFIG.EVIL_TOTAL;
        evilCounter = 1;
        youLose = false;
        congratulations = false;
        playerShotsBuffer = [];
        evilShotsBuffer = [];
        now = 0;
        nextPlayerShot = 0;
        finalAnimationTick = 0;
        player = new Player(playerLife, 0);
        createNewEvil();
        showLifeAndScore();
    }

    /** Dibuja el marcador de vidas y puntos en la esquina superior derecha del buffer. */
    function showLifeAndScore () {
        bufferctx.fillStyle="rgb(59,59,59)";
        bufferctx.font="bold 16px Arial";
        bufferctx.fillText("Puntos: " + player.score, canvas.width - 100, 20);
        bufferctx.fillText("Vidas: " + player.life, canvas.width - 100,40);
    }

    /**
     * Genera un entero aleatorio entre 0 (inclusive) y range (exclusive).
     * @param {number} range - El límite superior exclusivo.
     * @returns {number} Entero aleatorio en [0, range).
     */
    function getRandomNumber(range) {
        return Math.floor(Math.random() * range);
    }

    /**
     * Constructor/factory del jugador. Crea y configura el objeto imagen del jugador
     * añadiéndole propiedades de estado (posX, posY, life, score, dead, speed) y
     * métodos (doAnything, killPlayer). Reasigna la variable `player` del closure.
     * @param {number} life - Número de vidas iniciales.
     * @param {number} score - Puntuación inicial.
     * @returns {HTMLImageElement} El objeto imagen configurado como jugador.
     */
    function Player(life, score) {
        player = createImage('images/bueno.png');
        player.posX = (canvas.width / 2) - (player.width / 2);
        player.posY = canvas.height - (player.height === 0 ? CONFIG.PLAYER_DEFAULT_HEIGHT : player.height) - CONFIG.PLAYER_MARGIN_BOTTOM;
        player.life = life;
        player.score = score;
        player.dead = false;
        player.speed = playerSpeed;

        var shoot = function () {
            if (nextPlayerShot < now || now === 0) {
                playerShot = new PlayerShot(player.posX + (player.width / 2) - 5 , player.posY);
                playerShot.add();
                now += playerShotDelay;
                nextPlayerShot = now + playerShotDelay;
            } else {
                now = new Date().getTime();
            }
        };

        player.doAnything = function() {
            if (player.dead)
                return;
            if (keyPressed.left && player.posX > CONFIG.PLAYER_BOUNDARY_PADDING)
                player.posX -= player.speed;
            if (keyPressed.right && player.posX < (canvas.width - player.width - CONFIG.PLAYER_BOUNDARY_PADDING))
                player.posX += player.speed;
            if (keyPressed.fire)
                shoot();
        };

        player.killPlayer = function() {
            if (this.life > 0) {
                this.dead = true;
                evilShotsBuffer.splice(0, evilShotsBuffer.length);
                playerShotsBuffer.splice(0, playerShotsBuffer.length);
                this.src = playerKilledImage.src;
                createNewEvil();
                setTimeout(function () {
                    player = new Player(player.life - 1, player.score);
                }, CONFIG.RESPAWN_DELAY);

            } else {
                saveFinalScore();
                youLose = true;
                finalText.textContent = 'GAME OVER, ' + playerName + '.';
                showOverlay('end');
            }
        };

        return player;
    }

    /******************************* DISPAROS *******************************/
    /**
     * Constructor base para proyectiles (disparos).
     * @param {number} x - Posición horizontal inicial en píxeles.
     * @param {number} y - Posición vertical inicial en píxeles.
     * @param {Array} array - Buffer de proyectiles donde se agrega/elimina este disparo.
     * @param {HTMLImageElement} img - Imagen del proyectil.
     */
    function Shot( x, y, array, img) {
        this.posX = x;
        this.posY = y;
        this.image = img;
        this.speed = shotSpeed;
        this.identifier = 0;
        this.add = function () {
            array.push(this);
        };
        this.deleteShot = function (idendificador) {
            arrayRemove(array, idendificador);
        };
    }

    /**
     * Proyectil del jugador. Hereda de Shot y agrega método isHittingEvil().
     * @param {number} x - Posición horizontal inicial.
     * @param {number} y - Posición vertical inicial.
     */
    function PlayerShot (x, y) {
        Object.getPrototypeOf(PlayerShot.prototype).constructor.call(this, x, y, playerShotsBuffer, playerShotImage);
        this.isHittingEvil = function() {
            return (!evil.dead && this.posX >= evil.posX && this.posX <= (evil.posX + evil.image.width) &&
                this.posY >= evil.posY && this.posY <= (evil.posY + evil.image.height));
        };
    }

    PlayerShot.prototype = Object.create(Shot.prototype);
    PlayerShot.prototype.constructor = PlayerShot;

    /**
     * Proyectil del enemigo. Hereda de Shot y agrega método isHittingPlayer().
     * @param {number} x - Posición horizontal inicial.
     * @param {number} y - Posición vertical inicial.
     */
    function EvilShot (x, y) {
        Object.getPrototypeOf(EvilShot.prototype).constructor.call(this, x, y, evilShotsBuffer, evilShotImage);
        this.isHittingPlayer = function() {
            return (this.posX >= player.posX && this.posX <= (player.posX + player.width)
                && this.posY >= player.posY && this.posY <= (player.posY + player.height));
        };
    }

    EvilShot.prototype = Object.create(Shot.prototype);
    EvilShot.prototype.constructor = EvilShot;
    /******************************* FIN DISPAROS ********************************/


    /******************************* ENEMIGOS *******************************/
    /**
     * Constructor base para enemigos. Define posición, velocidad, animación,
     * detección de salida de pantalla y la lógica de disparo automático.
     * @param {number} life - Vidas iniciales del enemigo.
     * @param {number} shots - Disparos disponibles.
     * @param {{animation: HTMLImageElement[], killed: HTMLImageElement}} enemyImages
     *   Objeto con el array de frames de animación y la imagen de muerte.
     */
    function Enemy(life, shots, enemyImages) {
        this.image = enemyImages.animation[0];
        this.imageNumber = 1;
        this.animation = 0;
        this.posX = getRandomNumber(canvas.width - this.image.width);
        this.posY = -50;
        this.life = life ? life : evilLife;
        this.speed = evilSpeed;
        this.shots = shots ? shots : evilShots;
        this.dead = false;

        var desplazamientoHorizontal = minHorizontalOffset +
            getRandomNumber(maxHorizontalOffset - minHorizontalOffset);
        this.minX = getRandomNumber(canvas.width - desplazamientoHorizontal);
        this.maxX = this.minX + desplazamientoHorizontal - 40;
        this.direction = 'D';


        this.kill = function() {
            this.dead = true;
            totalEvils --;
            this.image = enemyImages.killed;
            verifyToCreateNewEvil();
        };

        this.update = function () {
            this.posY += this.goDownSpeed;
            if (this.direction === 'D') {
                if (this.posX <= this.maxX) {
                    this.posX += this.speed;
                } else {
                    this.direction = 'I';
                    this.posX -= this.speed;
                }
            } else {
                if (this.posX >= this.minX) {
                    this.posX -= this.speed;
                } else {
                    this.direction = 'D';
                    this.posX += this.speed;
                }
            }
            this.animation++;
            if (this.animation > CONFIG.EVIL_ANIMATION_INTERVAL) {
                this.animation = 0;
                this.imageNumber ++;
                if (this.imageNumber > CONFIG.EVIL_ANIMATION_FRAMES) {
                    this.imageNumber = 1;
                }
                this.image = enemyImages.animation[this.imageNumber - 1];
            }
        };

        this.isOutOfScreen = function() {
            return this.posY > (canvas.height + CONFIG.EVIL_OFFSCREEN_MARGIN);
        };

        function shoot() {
            if (evil.shots > 0 && !evil.dead) {
                var disparo = new EvilShot(evil.posX + (evil.image.width / 2) - 5 , evil.posY + evil.image.height);
                disparo.add();
                evil.shots --;
                setTimeout(function() {
                    shoot();
                }, getRandomNumber(CONFIG.EVIL_SHOT_INTERVAL));
            }
        }
        setTimeout(function() {
            shoot();
        }, CONFIG.EVIL_FIRST_SHOT_BASE + getRandomNumber(CONFIG.EVIL_FIRST_SHOT_EXTRA));

        this.toString = function () {
            return 'Enemigo con vidas:' + this.life + 'shotss: ' + this.shots + ' puntos por matar: ' + this.pointsToKill;
        }

    }

    /**
     * Enemigo regular. Hereda de Enemy usando imágenes de enemigo estándar.
     * Se mueve horizontalmente y desciende a velocidad evilSpeed.
     * @param {number} vidas - Vidas del enemigo (se incrementa con evilCounter).
     * @param {number} disparos - Disparos disponibles.
     */
    function Evil (vidas, disparos) {
        Object.getPrototypeOf(Evil.prototype).constructor.call(this, vidas, disparos, evilImages);
        this.goDownSpeed = evilSpeed;
        this.pointsToKill = 5 + evilCounter;
    }

    Evil.prototype = Object.create(Enemy.prototype);
    Evil.prototype.constructor = Evil;

    /**
     * Jefe final. Hereda de Enemy con más vidas y disparos.
     * Se mueve a la mitad de la velocidad de los enemigos regulares.
     * Aparece cuando totalEvils === 1 (último enemigo de la partida).
     */
    function FinalBoss () {
        Object.getPrototypeOf(FinalBoss.prototype).constructor.call(this, finalBossLife, finalBossShots, bossImages);
        this.goDownSpeed = evilSpeed/2;
        this.pointsToKill = 20;
    }

    FinalBoss.prototype = Object.create(Enemy.prototype);
    FinalBoss.prototype.constructor = FinalBoss;
    /******************************* FIN ENEMIGOS *******************************/

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

    /**
     * Detecta colisión AABB entre el cuerpo del enemigo activo y el jugador.
     * @returns {boolean} true si el enemigo está tocando al jugador.
     */
    function isEvilHittingPlayer() {
        return ( ( (evil.posY + evil.image.height) > player.posY && (player.posY + player.height) >= evil.posY ) &&
            ((player.posX >= evil.posX && player.posX <= (evil.posX + evil.image.width)) ||
                (player.posX + player.width >= evil.posX && (player.posX + player.width) <= (evil.posX + evil.image.width))));
    }

    /**
     * Verifica si un disparo del jugador impactó al enemigo activo.
     * Si hay impacto: reduce la vida del enemigo (o lo mata) y elimina el disparo.
     * @param {PlayerShot} shot - El disparo a evaluar.
     * @returns {boolean} false si hubo impacto (el disparo debe eliminarse); true si no.
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

    /** Delega el procesamiento de entrada del jugador a player.doAnything(). */
    function playerAction() {
        player.doAnything();
    }

    /**
     * Agrega un event listener con compatibilidad IE (attachEvent) y estándar (addEventListener).
     * @param {EventTarget} element - El elemento al que se le agrega el listener.
     * @param {string} type - Tipo de evento (e.g. 'click', 'keydown').
     * @param {Function} expression - El callback del evento.
     * @param {boolean} [bubbling=false] - Si el evento usa fase de burbuja.
     */
    function addListener(element, type, expression, bubbling) {
        bubbling = bubbling || false;

        if (window.addEventListener) { // Standard
            element.addEventListener(type, expression, bubbling);
        } else if (window.attachEvent) { // IE
            element.attachEvent('on' + type, expression);
        }
    }

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

    /** Vuelca el contenido del buffer al canvas principal visible. */
    function draw() {
        ctx.drawImage(buffer, 0, 0);
    }

    /** Dibuja el texto "GAME OVER" centrado en el buffer durante el estado de derrota. */
    function showGameOver() {
        bufferctx.fillStyle="rgb(255,0,0)";
        bufferctx.font="bold 35px Arial";
        bufferctx.fillText("GAME OVER", canvas.width / 2 - 100, canvas.height / 2);
    }

    /**
     * Dibuja la animación de victoria en el buffer: texto pulsante con puntuación final
     * y esferas animadas. Llamada en cada frame mientras congratulations === true.
     */
    function showCongratulations () {
        finalAnimationTick++;
        var pulseColor = (finalAnimationTick % 30 < 15) ? "rgb(255,255,0)" : "rgb(255,255,255)";
        bufferctx.fillStyle = pulseColor;
        bufferctx.font = "bold 24px Arial";
        bufferctx.fillText("¡ENHORABUENA, " + playerName + "!", canvas.width / 2 - 210, canvas.height / 2 - 40);
        bufferctx.font = "bold 22px Arial";
        bufferctx.fillText("PUNTOS: " + player.score, canvas.width / 2 - 210, canvas.height / 2);
        bufferctx.fillText("VIDAS: " + player.life + " x 5", canvas.width / 2 - 210, canvas.height / 2 + 35);
        bufferctx.fillText("TOTAL: " + getTotalScore(), canvas.width / 2 - 210, canvas.height / 2 + 70);
        for (var i = 0; i < 6; i++) {
            bufferctx.beginPath();
            bufferctx.arc(80 + i * 90, 120 + ((finalAnimationTick * (i + 1)) % 40), 6, 0, Math.PI * 2);
            bufferctx.fill();
        }
    }

    /**
     * Calcula la puntuación final: puntos acumulados + (vidas restantes × CONFIG.SCORE_LIFE_BONUS).
     * @returns {number} La puntuación total de la partida.
     */
    function getTotalScore() {
        return player.score + player.life * 5;
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
            var disparoBueno = playerShotsBuffer[j];
            updatePlayerShot(disparoBueno, j);
        }

        if (isEvilHittingPlayer()) {
            player.killPlayer();
        } else {
            for (var i = 0; i < evilShotsBuffer.length; i++) {
                var evilShot = evilShotsBuffer[i];
                updateEvilShot(evilShot, i);
            }
        }

        showLifeAndScore();

        playerAction();
    }

    /**
     * Actualiza un disparo del jugador: mueve hacia arriba, detecta colisión con el enemigo
     * y lo elimina si sale de pantalla o impacta.
     * @param {PlayerShot} playerShot - El proyectil a actualizar.
     * @param {number} id - Índice del proyectil en playerShotsBuffer.
     */
    function updatePlayerShot(playerShot, id) {
        if (playerShot) {
            playerShot.identifier = id;
            if (checkCollisions(playerShot)) {
                if (playerShot.posY > 0) {
                    playerShot.posY -= playerShot.speed;
                    bufferctx.drawImage(playerShot.image, playerShot.posX, playerShot.posY);
                } else {
                    playerShot.deleteShot(parseInt(playerShot.identifier));
                }
            }
        }
    }

    /**
     * Actualiza un disparo enemigo: mueve hacia abajo, detecta colisión con el jugador
     * y lo elimina si sale de pantalla o impacta.
     * @param {EvilShot} evilShot - El proyectil a actualizar.
     * @param {number} id - Índice del proyectil en evilShotsBuffer.
     */
    function updateEvilShot(evilShot, id) {
        if (evilShot) {
            evilShot.identifier = id;
            if (!evilShot.isHittingPlayer()) {
                if (evilShot.posY <= canvas.height) {
                    evilShot.posY += evilShot.speed;
                    bufferctx.drawImage(evilShot.image, evilShot.posX, evilShot.posY);
                } else {
                    evilShot.deleteShot(parseInt(evilShot.identifier));
                }
            } else {
                player.killPlayer();
            }
        }
    }

    /**
     * Dibuja el fondo del juego en el buffer.
     * Usa bgBoss cuando el enemigo activo es un FinalBoss; de lo contrario usa bgMain.
     */
    function drawBackground() {
        var background;
        if (evil instanceof FinalBoss) {
            background = bgBoss;
        } else {
            background = bgMain;
        }
        bufferctx.drawImage(background, 0, 0);
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

    /******************************* MEJORES PUNTUACIONES (LOCALSTORAGE) *******************************/
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
        return fillZero(date.getDate())+'/'+
            fillZero(date.getMonth()+1)+'/'+
            date.getFullYear()+' '+
            fillZero(date.getHours())+':'+
            fillZero(date.getMinutes())+':'+
            fillZero(date.getSeconds());
    }

    /**
     * Agrega un cero a la izquierda si el número es menor a 10.
     * @param {number} number - El número a formatear.
     * @returns {string|number} El número con cero inicial si aplica.
     */
    function fillZero(number) {
        if (number < 10) {
            return '0' + number;
        }
        return number;
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
     * Renderiza la tabla de mejores puntuaciones en el DOM (#puntuaciones tbody).
     * Limpia y reconstruye las filas con medallas para los 3 primeros puestos.
     */
    function showBestScores() {
        var bestScores = getBestScoreKeys();
        var bestScoresBody = document.querySelector('#puntuaciones tbody');
        if (bestScoresBody) {
            bestScoresBody.innerHTML = '';
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
                if (i === 0) {
                    row.className = 'podium-1';
                } else if (i === 1) {
                    row.className = 'podium-2';
                } else if (i === 2) {
                    row.className = 'podium-3';
                }
                var medal = '';
                if (i === 0) {
                    medal = '🥇 ';
                } else if (i === 1) {
                    medal = '🥈 ';
                } else if (i === 2) {
                    medal = '🥉 ';
                }
                row.appendChild(createCell(record.name));
                row.children[0].textContent = medal + row.children[0].textContent;
                row.appendChild(createCell(record.score));
                bestScoresBody.appendChild(row);
            }
        }
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
     * Sanitiza el nombre del jugador eliminando caracteres HTML peligrosos,
     * recortando espacios y limitando la longitud a 12 caracteres.
     * @param {string} name - El nombre crudo ingresado por el usuario.
     * @returns {string} El nombre sanitizado, o 'Jugador' si queda vacío.
     */
    function sanitizeName(name) {
        return (name || '').replace(/[<>&"']/g, '').trim().slice(0, 12) || 'Jugador';
    }

    /**
     * Crea un objeto Image con su src asignado y un handler de error que registra un warning en consola.
     * Usar siempre esta función en lugar de `new Image()` directamente.
     * @param {string} src - Ruta relativa o absoluta de la imagen.
     * @returns {HTMLImageElement} El elemento imagen con src y onerror configurados.
     */
    function createImage(src) {
        var img = new Image();
        img.onerror = function() {
            console.warn('[naves] No se pudo cargar la imagen: ' + src);
        };
        img.src = src;
        return img;
    }

    /**
     * Elimina un elemento de un array por su índice, mutando el array en lugar de crearlo de nuevo.
     * @param {Array} array - El array a mutar.
     * @param {number} from - El índice del elemento a eliminar (admite negativos).
     * @returns {number} La nueva longitud del array.
     */
    function arrayRemove(array, from) {
        var rest = array.slice((from) + 1 || array.length);
        array.length = from < 0 ? array.length + from : from;
        return array.push.apply(array, rest);
    }

    /**
     * Verifica si un array contiene un elemento dado.
     * Reemplaza el uso de Array.prototype para no contaminar prototipos nativos.
     * @param {Array} array - El array a inspeccionar.
     * @param {*} element - El elemento a buscar.
     * @returns {boolean} true si el elemento está en el array, false en caso contrario.
     */
    function arrayContains(array, element) {
        for (var i = 0; i < array.length; i++) {
            if (array[i] === element) {
                return true;
            }
        }
        return false;
    }

    /**
     * Elimina del localStorage todos los registros que no estén en el top CONFIG.TOP_SCORES_TO_SHOW.
     * Evita que el almacenamiento crezca indefinidamente.
     */
    function removeNoBestScores() {
        var scoresToRemove = [];
        var bestScoreKeys = getBestScoreKeys();
        for (var i=0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!arrayContains(bestScoreKeys, key)) {
                scoresToRemove.push(key);
            }
        }
        for (var j = 0; j < scoresToRemove.length; j++) {
            var scoreToRemoveKey = scoresToRemove[j];
            localStorage.removeItem(scoreToRemoveKey);
        }
    }
    /******************************* FIN MEJORES PUNTUACIONES *******************************/

    return {
        init: init
    }
})();