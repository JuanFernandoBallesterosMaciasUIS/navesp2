/**
 * entities.js — Constructores de entidades del juego "naves".
 *
 * Depende de:
 *   - config.js  : CONFIG
 *   - utils.js   : createImage, getRandomNumber
 *   - game.js    : estado global (canvas, evil, player, playerShotsBuffer,
 *                  evilShotsBuffer, playerShotImage, evilShotImage,
 *                  playerKilledImage, evilImages, bossImages, evilSpeed,
 *                  evilShots, evilLife, evilCounter, finalBossLife,
 *                  finalBossShots, minHorizontalOffset, maxHorizontalOffset,
 *                  totalEvils, shotSpeed, playerSpeed, keyPressed,
 *                  nextPlayerShot, playerShotDelay, now, playerShot,
 *                  youLose, playerName, finalText, doubleFireActive, 
 *                  shieldActive, lifeEffectActive, doubleFireTimeout, 
 *                  shieldTimeout, lifeEffectTimeout)
 *   - game.js    : funciones globales (verifyToCreateNewEvil, createNewEvil,
 *                  showOverlay)
 *   - scores.js  : saveFinalScore
 *
 * NOTA: Este archivo se carga antes de game.js. Las referencias al estado
 * global se resuelven en tiempo de ejecución (no de carga), por lo que
 * funcionan correctamente una vez que game.js ha sido evaluado por el navegador.
 */

/******************************* DISPAROS *******************************/

/**
 * Constructor base para proyectiles (disparos).
 * @param {number} x - Posición horizontal inicial en píxeles.
 * @param {number} y - Posición vertical inicial en píxeles.
 * @param {Array} array - Buffer de proyectiles donde se agrega/elimina este disparo.
 * @param {HTMLImageElement} img - Imagen del proyectil.
 */
function Shot(x, y, array, img) {
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
function PlayerShot(x, y) {
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
function EvilShot(x, y) {
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
    this.maxLife = this.life;
    this.speed = evilSpeed;
    this.shots = shots ? shots : evilShots;
    this.totalShots = this.shots;
    this.dead = false;

    var desplazamientoHorizontal = minHorizontalOffset +
        getRandomNumber(maxHorizontalOffset - minHorizontalOffset);
    this.minX = getRandomNumber(canvas.width - desplazamientoHorizontal);
    this.maxX = this.minX + desplazamientoHorizontal - 40;
    this.direction = 'D';
    this.vertDirection = 'D';
    this.minY = 30;
    this.maxY = Math.floor(canvas.height * 0.55);

    this.reappear = function() {
        this.posY = -50; // Reinicia la posición vertical
        this.posX = getRandomNumber(canvas.width - this.image.width); // Nueva posición horizontal aleatoria
        var desplazamientoHorizontal = minHorizontalOffset +
            getRandomNumber(maxHorizontalOffset - minHorizontalOffset);
        this.minX = getRandomNumber(canvas.width - desplazamientoHorizontal);
        this.maxX = this.minX + desplazamientoHorizontal - 40;
        this.vertDirection = 'D';
    };

    this.kill = function() {
        this.dead = true;
        totalEvils--;
        this.image = enemyImages.killed;
        verifyToCreateNewEvil();
    };

    this.update = function (dt) {
        // Movimiento vertical con rebote
        if (this.posY < this.minY) {
            // Aún entrando desde arriba — seguir bajando
            this.posY += this.goDownSpeed * dt * 60;
            this.vertDirection = 'D';
        } else if (this.vertDirection === 'D') {
            if (this.posY < this.maxY) {
                this.posY += this.goDownSpeed * dt * 60;
            } else {
                this.vertDirection = 'U';
                this.posY -= this.goDownSpeed * dt * 60;
            }
        } else {
            if (this.posY > this.minY) {
                this.posY -= this.goDownSpeed * dt * 60;
            } else {
                this.vertDirection = 'D';
                this.posY += this.goDownSpeed * dt * 60;
            }
        }
        if (this.direction === 'D') {
            if (this.posX <= this.maxX) {
                this.posX += this.speed * dt * 60;
            } else {
                this.direction = 'I';
                this.posX -= this.speed * dt * 60;
            }
        } else {
            if (this.posX >= this.minX) {
                this.posX -= this.speed * dt * 60;
            } else {
                this.direction = 'D';
                this.posX += this.speed * dt * 60;
            }
        }
        this.animation += dt * 60;
        if (this.animation > CONFIG.EVIL_ANIMATION_INTERVAL) {
            this.animation = 0;
            this.imageNumber++;
            if (this.imageNumber > CONFIG.EVIL_ANIMATION_FRAMES) {
                this.imageNumber = 1;
            }
            this.image = enemyImages.animation[this.imageNumber - 1];
        }
    };

    this.isOutOfScreen = function() {
        return this.posY > (canvas.height + CONFIG.EVIL_OFFSCREEN_MARGIN);
    };

    this.restartShooting = function() {
        this.shots = this.totalShots;
        setTimeout(function() {
            shoot();
        }, CONFIG.EVIL_FIRST_SHOT_BASE + getRandomNumber(CONFIG.EVIL_FIRST_SHOT_EXTRA));
    };

    function shoot() {
        // No disparar si el juego está en pausa, terminado o el enemigo muerto
        if (gamePaused || youLose || congratulations || evil.dead) {
            return;
        }
        var disparo = new EvilShot(evil.posX + (evil.image.width / 2) - 5, evil.posY + evil.image.height);
        disparo.add();
        playSound('Sonidos/Disparo_1.mp3', 0.5);
        // El delay varía aleatoriamente para que el disparo sea irregular
        var delay = CONFIG.EVIL_SHOT_INTERVAL / 2 + getRandomNumber(CONFIG.EVIL_SHOT_INTERVAL);
        setTimeout(function() {
            shoot();
        }, delay);
    }
    setTimeout(function() {
        shoot();
    }, CONFIG.EVIL_FIRST_SHOT_BASE + getRandomNumber(CONFIG.EVIL_FIRST_SHOT_EXTRA));

    this.toString = function () {
        return 'Enemigo con vidas:' + this.life + ' shots: ' + this.shots + ' puntos por matar: ' + this.pointsToKill;
    };
}

/**
 * Enemigo regular. Hereda de Enemy usando imágenes de enemigo estándar.
 * Se mueve horizontalmente y desciende a velocidad evilSpeed.
 * @param {number} vidas - Vidas del enemigo (se incrementa con evilCounter).
 * @param {number} disparos - Disparos disponibles.
 */
function Evil(vidas, disparos) {
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
function FinalBoss() {
    Object.getPrototypeOf(FinalBoss.prototype).constructor.call(this, finalBossLife, finalBossShots, bossImages);
    this.goDownSpeed = evilSpeed / 2;
    this.pointsToKill = CONFIG.BOSS_POINTS;
}

FinalBoss.prototype = Object.create(Enemy.prototype);
FinalBoss.prototype.constructor = FinalBoss;

/******************************* FIN ENEMIGOS *******************************/


/******************************* JUGADOR *******************************/

/**
 * Constructor/factory del jugador. Crea y configura el objeto imagen del jugador
 * añadiéndole propiedades de estado (posX, posY, life, score, dead, speed) y
 * métodos (doAnything, killPlayer). Reasigna la variable `player` del estado global.
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
            // Si es el primer disparo (now === 0), inicializar con el timestamp
            // real para que nextPlayerShot quede en el futuro correcto y no se
            // dispare una segunda bala inmediatamente en el siguiente frame.
            if (now === 0) { now = new Date().getTime(); }
            if (doubleFireActive) {
                // Disparar dos proyectiles a ambos lados
                playerShot = new PlayerShot(player.posX + (player.width / 4) - 5, player.posY);
                playerShot.add();
                playerShot = new PlayerShot(player.posX + (3 * player.width / 4) - 5, player.posY);
                playerShot.add();
            } else {
                // Disparo normal en el centro
                playerShot = new PlayerShot(player.posX + (player.width / 2) - 5, player.posY);
                playerShot.add();
            }
            playSound('Sonidos/Disparo_2.mp3', 0.6);
            now += playerShotDelay;
            nextPlayerShot = now + playerShotDelay;
        } else {
            now = new Date().getTime();
        }
    };

    player.doAnything = function(dt) {
        if (player.dead) {
            return;
        }
        // Aplicar modificador de velocidad si está ralentizado
        var speedMultiplier = playerSlowed ? SLOWDOWN_MULTIPLIER : 1;
        if (keyPressed.left && player.posX > CONFIG.PLAYER_BOUNDARY_PADDING) {
            player.posX -= player.speed * dt * 60 * speedMultiplier;
        }
        if (keyPressed.right && player.posX < (canvas.width - player.width - CONFIG.PLAYER_BOUNDARY_PADDING)) {
            player.posX += player.speed * dt * 60 * speedMultiplier;
        }
        if (keyPressed.fire) {
            shoot();
        }
    };

    player.killPlayer = function() {
        playSound('Sonidos/Perdida_vida.mp3', 0.8);
        if (this.life > 1) {
            this.dead = true;
            evilShotsBuffer.splice(0, evilShotsBuffer.length);
            playerShotsBuffer.splice(0, playerShotsBuffer.length);
            powersBuffer.splice(0, powersBuffer.length);  // Limpiar poderes al morir
            // Resetear efectos de poderes
            doubleFireActive = false;
            shieldActive = false;
            lifeEffectActive = false;
            if (doubleFireTimeout) clearTimeout(doubleFireTimeout);
            if (shieldTimeout) clearTimeout(shieldTimeout);
            if (lifeEffectTimeout) clearTimeout(lifeEffectTimeout);
            this.src = playerKilledImage.src;
            // Mantener al enemigo en su posición actual y reactivar sus disparos
            evil.restartShooting();
            setTimeout(function () {
                player = new Player(player.life - 1, player.score);
            }, CONFIG.RESPAWN_DELAY);
        } else {
            saveFinalScore();
            youLose = true;
            finalText.textContent = 'GAME OVER, ' + playerName + '.';
            showOverlay('gameOver');
        }
    };

    return player;
}

/******************************* FIN JUGADOR *******************************/
