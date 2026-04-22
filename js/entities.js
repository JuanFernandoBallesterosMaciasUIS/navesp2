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

/**
 * Disparo de la estrellita. Hereda de EvilShot y agrega capacidad de rebote en bordes.
 * @param {number} x - Posición horizontal inicial.
 * @param {number} y - Posición vertical inicial.
 * @param {number} velocityX - Velocidad horizontal (para rebote).
 * @param {number} velocityY - Velocidad vertical (normalmente hacia abajo).
 */
function StarShot(x, y, velocityX, velocityY) {
    Object.getPrototypeOf(StarShot.prototype).constructor.call(this, x, y);
    this.velocityX = velocityX || 0;  // Velocidad horizontal para rebote
    this.velocityY = velocityY || this.speed;  // Velocidad vertical (hacia abajo)
    this.isHittingPlayer = function() {
        return (this.posX >= player.posX && this.posX <= (player.posX + player.width)
            && this.posY >= player.posY && this.posY <= (player.posY + player.height));
    };
}

StarShot.prototype = Object.create(EvilShot.prototype);
StarShot.prototype.constructor = StarShot;

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
        playSound('Sonidos/Disparo_1.mp3', evil instanceof FinalBoss ? 0.06 : 0.12);
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

/**
 * Estrellita - Enemigo especial con capacidad de rebote y disparo múltiple.
 * Dispara principalmente desde las dos patitas inferiores a los lados.
 * Cada 3 disparos, dispara desde todas las patitas.
 * Se mueve por toda la pantalla y las balas rebotan en los bordes.
 */
function Star() {
    Object.getPrototypeOf(Star.prototype).constructor.call(this, CONFIG.STAR_LIFE, CONFIG.STAR_SHOTS, starImages);
    this.goDownSpeed = evilSpeed * 0.8;  // Movimiento más lento
    this.pointsToKill = CONFIG.STAR_POINTS;
    this.shotCount = 0;  // Contador de disparos para control de patrón
    this.shotTimeout = null;  // Referencia al timeout de disparos para limpiarlo después
    this.allowFullScreenMovement = true;  // Permite movimiento por toda la pantalla
    this.minY = 0;  // Puede llegar hasta arriba
    this.maxY = canvas.height * 0.7;  // Puede llegar más abajo
    this.maxX = this.minX + 200;  // Rango de movimiento horizontal limitado
    
    var self = this;
    
    // Sobrescribir el método update para Star (sin animación de múltiples frames)
    this.update = function(dt) {
        // Movimiento vertical con rebote
        if (this.posY < this.minY) {
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
        
        // Movimiento horizontal
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
        
        // Sin animación de múltiples frames para la estrellita
        this.image = starImages.animation[0];
    };
    
    // Sobrescribir el método restartShooting con lógica especial para la estrellita
    this.restartShooting = function() {
        // Limpiar timeout anterior si existe
        if (self.shotTimeout) {
            clearTimeout(self.shotTimeout);
            self.shotTimeout = null;
        }
        self.shots = self.totalShots;
        self.shotCount = 0;
        var firstDelay = CONFIG.EVIL_FIRST_SHOT_BASE + getRandomNumber(CONFIG.EVIL_FIRST_SHOT_EXTRA);
        self.shotTimeout = setTimeout(function() {
            starShoot();
        }, firstDelay);
    };
    
    function starShoot() {
        // No disparar si el juego está en pausa, terminado o el enemigo muerto
        if (gamePaused || youLose || congratulations || evil.dead || !(evil instanceof Star)) {
            self.shotTimeout = null;
            return;
        }
        
        var centerX = self.posX + (self.image.width / 2);
        var bottomY = self.posY + self.image.height;
        var offsetX = (self.image.width / 3);
        
        // Contar disparos para saber cuándo hacer disparo con todas las patitas
        self.shotCount++;
        
        if (self.shotCount % 3 === 0) {
            // Cada 3 disparos: disparar desde todas las patitas (6 posiciones)
            // 2 patitas superiores
            createStarShot(centerX - offsetX * 1.5, self.posY + 5, -2, 3);
            createStarShot(centerX + offsetX * 1.5, self.posY + 5, 2, 3);
            // 2 patitas laterales intermedias
            createStarShot(self.posX - 5, centerX, -3, 2);
            createStarShot(self.posX + self.image.width + 5, centerX, 3, 2);
            // 2 patitas inferiores (principales)
            createStarShot(centerX - offsetX, bottomY, -2, 3);
            createStarShot(centerX + offsetX, bottomY, 2, 3);
        } else {
            // Disparar desde las dos patitas inferiores a los lados
            createStarShot(centerX - offsetX, bottomY, -1.5, 3);
            createStarShot(centerX + offsetX, bottomY, 1.5, 3);
        }
        
        playSound('Sonidos/Disparo_1.mp3', 0.12);
        
        // Programar el siguiente disparo
        var delay = CONFIG.EVIL_SHOT_INTERVAL / 2 + getRandomNumber(CONFIG.EVIL_SHOT_INTERVAL);
        self.shotTimeout = setTimeout(function() {
            starShoot();
        }, delay);
    }
    
    function createStarShot(x, y, velocityX, velocityY) {
        var disparo = new StarShot(x, y, velocityX, velocityY);
        disparo.add();
    }
    
    // Iniciar los disparos de la estrellita
    this.restartShooting();
}

Star.prototype = Object.create(Enemy.prototype);
Star.prototype.constructor = Star;

/**
 * Sobrescribir método kill para la Estrellita: limpia el timeout de disparos antes de matar
 */
Star.prototype.kill = function() {
    // Limpiar timeout de disparos de la estrellita
    if (this.shotTimeout) {
        clearTimeout(this.shotTimeout);
        this.shotTimeout = null;
    }
    // Llamar al método kill de la clase padre
    Enemy.prototype.kill.call(this);
};

/**
 * Cangrejo - Enemigo con movimiento libre en todas direcciones.
 * Se mueve rápido en línea recta (izquierda, derecha, arriba, abajo) sin salirse de pantalla.
 * Dispara 2 balas por cada una de sus escopetas (4 balas totales por disparo).
 * Tiene animación de 6 frames.
 */
function Crab() {
    Object.getPrototypeOf(Crab.prototype).constructor.call(this, CONFIG.CRAB_LIFE, CONFIG.CRAB_SHOTS, crabImages);
    this.goDownSpeed = evilSpeed * 1.2;  // Movimiento rápido
    this.pointsToKill = CONFIG.CRAB_POINTS;
    this.shotCount = 0;
    this.shotTimeout = null;  // Referencia al timeout de disparos para limpiarlo después
    
    // Movimiento libre: elegir dirección aleatoria
    var directions = ['U', 'D', 'L', 'R'];
    this.moveDirection = directions[Math.floor(Math.random() * directions.length)];
    this.nextDirectionChange = Math.random() * 3000 + 2000;  // Cambiar dirección cada 2-5 segundos
    this.directionChangeTimer = 0;
    
    // Restricciones de movimiento: mantener distancia del jugador
    this.minX = 5;
    this.maxX = canvas.width - 100;
    this.minY = 30;
    this.maxY = Math.floor(canvas.height * 0.65);  // No bajar más del 65% de la pantalla para evitar colisión con jugador
    
    var self = this;
    
    // Sobrescribir método update para movimiento libre
    this.update = function(dt) {
        // Cambiar dirección aleatoriamente
        self.directionChangeTimer += dt * 1000;
        if (self.directionChangeTimer >= self.nextDirectionChange) {
            var directions = ['U', 'D', 'L', 'R'];
            self.moveDirection = directions[Math.floor(Math.random() * directions.length)];
            self.directionChangeTimer = 0;
            self.nextDirectionChange = Math.random() * 3000 + 2000;
        }
        
        // Aplicar movimiento según la dirección
        var moveSpeed = self.goDownSpeed * dt * 60;
        
        switch(self.moveDirection) {
            case 'U':  // Arriba
                if (self.posY > self.minY) {
                    self.posY -= moveSpeed;
                } else {
                    self.moveDirection = 'D';
                }
                break;
            case 'D':  // Abajo
                if (self.posY < self.maxY) {
                    self.posY += moveSpeed;
                } else {
                    self.moveDirection = 'U';
                }
                break;
            case 'L':  // Izquierda
                if (self.posX > self.minX) {
                    self.posX -= moveSpeed;
                } else {
                    self.moveDirection = 'R';
                }
                break;
            case 'R':  // Derecha
                if (self.posX < self.maxX) {
                    self.posX += moveSpeed;
                } else {
                    self.moveDirection = 'L';
                }
                break;
        }
        
        // Animación: cambiar frame cada intervalo
        self.animation += dt * 60;
        if (self.animation > CONFIG.EVIL_ANIMATION_INTERVAL) {
            self.animation = 0;
            self.imageNumber++;
            if (self.imageNumber > CONFIG.CRAB_ANIMATION_FRAMES) {
                self.imageNumber = 1;
            }
            self.image = crabImages.animation[self.imageNumber - 1];
        }
    };
    
    // Sobrescribir método restartShooting para disparos múltiples
    this.restartShooting = function() {
        // Limpiar timeout anterior si existe
        if (self.shotTimeout) {
            clearTimeout(self.shotTimeout);
            self.shotTimeout = null;
        }
        self.shots = self.totalShots;
        self.shotCount = 0;
        var firstDelay = CONFIG.EVIL_FIRST_SHOT_BASE + getRandomNumber(CONFIG.EVIL_FIRST_SHOT_EXTRA);
        self.shotTimeout = setTimeout(function() {
            crabShoot();
        }, firstDelay);
    };
    
    function crabShoot() {
        // No disparar si el juego está en pausa, terminado o el enemigo muerto
        if (gamePaused || youLose || congratulations || evil.dead || !(evil instanceof Crab)) {
            self.shotTimeout = null;
            return;
        }
        
        // Validar que el cangrejo tenga una imagen cargada correctamente
        if (!self.image || !self.image.width || self.image.width < 10) {
            // Reintentar disparo si la imagen no está lista
            var delay = 500; // Reintentar en 500ms
            self.shotTimeout = setTimeout(function() {
                crabShoot();
            }, delay);
            return;
        }
        
        var centerX = self.posX + (self.image.width / 2);
        var centerY = self.posY + (self.image.height / 2);
        var offsetX = (self.image.width / 4);
        var offsetY = (self.image.height / 4);
        
        // Disparar 2 balas por cada escopeta (4 balas totales)
        // Escopeta izquierda - 2 balas
        createCrabShot(centerX - offsetX, centerY - offsetY);
        createCrabShot(centerX - offsetX, centerY + offsetY);
        
        // Escopeta derecha - 2 balas
        createCrabShot(centerX + offsetX, centerY - offsetY);
        createCrabShot(centerX + offsetX, centerY + offsetY);
        
        playSound('Sonidos/Disparo_1.mp3', 0.12);
        
        // Programar el siguiente disparo
        var delay = CONFIG.EVIL_SHOT_INTERVAL / 2 + getRandomNumber(CONFIG.EVIL_SHOT_INTERVAL);
        self.shotTimeout = setTimeout(function() {
            crabShoot();
        }, delay);
    }
    
    function createCrabShot(x, y) {
        // Validar que el disparo esté dentro de los límites de pantalla y sea razonable
        if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) {
            return; // No crear disparos fuera de pantalla
        }
        var disparo = new EvilShot(x, y);
        disparo.add();
    }
    
    // Iniciar los disparos del cangrejo
    this.restartShooting();
}

Crab.prototype = Object.create(Enemy.prototype);
Crab.prototype.constructor = Crab;

/**
 * Sobrescribir método kill para el Crab: limpia el timeout de disparos antes de matar
 */
Crab.prototype.kill = function() {
    // Limpiar timeout de disparos del cangrejo
    if (this.shotTimeout) {
        clearTimeout(this.shotTimeout);
        this.shotTimeout = null;
    }
    // Llamar al método kill de la clase padre
    Enemy.prototype.kill.call(this);
};

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
