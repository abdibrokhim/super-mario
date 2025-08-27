//Main Class of Mario Game

function MarioGame() {
  var gameUI = GameUI.getInstance();

  var maxWidth; //width of the game world
  var height;
  var viewPort; //width of canvas, viewPort that can be seen
  var tileSize;
  var map;
  var originalMaps;

  var translatedDist; //distance translated(side scrolled) as mario moves to the right
  var centerPos; //center position of the viewPort, viewable screen
  var marioInGround;

  //instances
  var mario;
  var element;
  var gameSound;
  var score;

  var keys = [];
  var goombas;
  var powerUps;
  var bullets;
  var bulletFlag = false;

  // quirky feature toggles
  var gravityInverted = false; // G key
  var coinMagnetEnabled = false; // M key
  var starModeActive = false; // I key
  var glitchModeActive = false; // H key: invert controls

  // emotion states
  var currentEmotion = 'none'; // 'none' | 'happy' | 'sad' | 'angry'
  var emotionExpireAt = 0; // timestamp ms

  var currentLevel;

  var animationID;
  var timeOutId;

  var tickCounter = 0; //for animating mario
  var maxTick = 25; //max number for ticks to show mario sprite
  var instructionTick = 0; //showing instructions counter
  var that = this;

  this.init = function(levelMaps, level) {
    height = 480;
    maxWidth = 0;
    viewPort = 1280;
    tileSize = 32;
    translatedDist = 0;
    goombas = [];
    powerUps = [];
    bullets = [];

    gameUI.setWidth(viewPort);
    gameUI.setHeight(height);
    gameUI.show();

    currentLevel = level;
    originalMaps = levelMaps;
    map = JSON.parse(levelMaps[currentLevel]);

    if (!score) {
      //so that when level changes, it uses the same instance
      score = new Score();
      score.init();
    }
    score.displayScore();
    score.updateLevelNum(currentLevel);

    if (!mario) {
      //so that when level changes, it uses the same instance
      mario = new Mario();
      mario.init();
    } else {
      mario.x = 10;
      mario.frame = 0;
    }
    element = new Element();
    gameSound = new GameSound();
    gameSound.init();

    that.calculateMaxWidth();
    that.bindKeyPress();
    that.startGame();
  };

  that.calculateMaxWidth = function() {
    //calculates the max width of the game according to map size
    for (var row = 0; row < map.length; row++) {
      for (var column = 0; column < map[row].length; column++) {
        if (maxWidth < map[row].length * 32) {
          maxWidth = map[column].length * 32;
        }
      }
    }
  };

  that.bindKeyPress = function() {
    var canvas = gameUI.getCanvas(); //for use with touch events

    //key binding
    document.body.addEventListener('keydown', function(e) {
      keys[e.keyCode] = true;
    });

    document.body.addEventListener('keyup', function(e) {
      keys[e.keyCode] = false;

      // feature toggles on key release to avoid rapid toggling
      if (e.keyCode == 71) {
        // G: gravity flip
        gravityInverted = !gravityInverted;
      } else if (e.keyCode == 77) {
        // M: coin magnet
        coinMagnetEnabled = !coinMagnetEnabled;
      } else if (e.keyCode == 73) {
        // I: star mode (invulnerability + slight speed boost)
        starModeActive = !starModeActive;
        if (mario) {
          mario.invulnerable = starModeActive;
        }
        if (starModeActive) {
          gameSound.play('powerUp');
        }
      } else if (e.keyCode == 72) {
        // H: glitch mode (invert controls)
        glitchModeActive = !glitchModeActive;
      } else if (e.keyCode == 49) {
        // 1: happy
        currentEmotion = 'happy';
        emotionExpireAt = Date.now() + 8000; // 8s
      } else if (e.keyCode == 50) {
        // 2: sad
        currentEmotion = 'sad';
        emotionExpireAt = Date.now() + 8000;
      } else if (e.keyCode == 51) {
        // 3: angry
        currentEmotion = 'angry';
        emotionExpireAt = Date.now() + 6000; // shorter burst
      } else if (e.keyCode == 66) {
        // B: befriend nearest goomba
        that.befriendNearestGoomba();
      }
    });

    //key binding for touch events
    canvas.addEventListener('touchstart', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = true; //left arrow
        }
        if (touches[i].pageX > 200 && touches[i].pageX < 400) {
          keys[39] = true; //right arrow
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          //in touch events, same area acts as sprint and bullet key
          keys[16] = true; //shift key
          keys[17] = true; //ctrl key
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = true; //space
        }
      }
    });

    canvas.addEventListener('touchend', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = false;
        }
        if (touches[i].pageX > 200 && touches[i].pageX <= 640) {
          keys[39] = false;
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          keys[16] = false;
          keys[17] = false;
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = false;
        }
      }
    });

    canvas.addEventListener('touchmove', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = true;
          keys[39] = false;
        }
        if (touches[i].pageX > 200 && touches[i].pageX < 400) {
          keys[39] = true;
          keys[37] = false;
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          keys[16] = true;
          keys[32] = false;
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = true;
          keys[16] = false;
          keys[17] = false;
        }
      }
    });
  };

  //Main Game Loop
  this.startGame = function() {
    animationID = window.requestAnimationFrame(that.startGame);

    gameUI.clear(0, 0, maxWidth, height);

    // always show quick feature status
    that.renderStatus();

    if (instructionTick < 1000) {
      that.showInstructions(); //showing control instructions
      instructionTick++;
    }

    that.renderMap();

    for (var i = 0; i < powerUps.length; i++) {
      powerUps[i].draw();
      powerUps[i].update();
    }

    for (var i = 0; i < bullets.length; i++) {
      bullets[i].draw();
      bullets[i].update();
    }

    for (var i = 0; i < goombas.length; i++) {
      // allies follow mario gently
      if (goombas[i].isAlly) {
        var desiredDir = 0;
        if (Math.abs((goombas[i].x + goombas[i].width / 2) - (mario.x + mario.width / 2)) > 40) {
          desiredDir = (mario.x > goombas[i].x) ? 1 : -1;
        }
        goombas[i].velX = desiredDir * 1.2;
      }

      goombas[i].draw();
      goombas[i].update();
    }

    that.checkPowerUpMarioCollision();
    that.checkBulletEnemyCollision();
    that.checkEnemyMarioCollision();

    if (coinMagnetEnabled) {
      that.magnetCollectCoins();
    }

    that.updateEmotion();

    mario.draw();
    that.updateMario();
    that.wallCollision();
    marioInGround = mario.grounded; //for use with flag sliding
  };

  this.showInstructions = function() {
    gameUI.writeText('Controls: Arrow keys for direction, shift to run, ctrl for bullets', 30, 30);
    gameUI.writeText('Tip: Jumping while running makes you jump higher', 30, 60);
    gameUI.writeText('New: G=Flip Gravity, M=Coin Magnet, I=Star Mode, H=Glitch', 30, 90);
    gameUI.writeText('Emotions: 1=Happy, 2=Sad, 3=Angry, B=Befriend', 30, 120);
  };

  this.renderStatus = function() {
    var statusText = 'G: ' + (gravityInverted ? 'Gravity UP' : 'Gravity DOWN') +
      ' | M: ' + (coinMagnetEnabled ? 'Magnet ON' : 'Magnet OFF') +
      ' | I: ' + (starModeActive ? 'Star ON' : 'Star OFF') +
      ' | H: ' + (glitchModeActive ? 'Glitch ON' : 'Glitch OFF') +
      ' | Mood: ' + currentEmotion.toUpperCase();
    gameUI.writeText(statusText, 30, 20);
  };

  this.updateEmotion = function() {
    if (currentEmotion != 'none' && Date.now() > emotionExpireAt) {
      currentEmotion = 'none';
    }
  };

  this.renderMap = function() {
    //setting false each time the map renders so that elements fall off a platform and not hover around
    mario.grounded = false;

    for (var i = 0; i < powerUps.length; i++) {
      powerUps[i].grounded = false;
    }
    for (var i = 0; i < goombas.length; i++) {
      goombas[i].grounded = false;
    }

    for (var row = 0; row < map.length; row++) {
      for (var column = 0; column < map[row].length; column++) {
        switch (map[row][column]) {
          case 1: //platform
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.platform();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 2: //coinBox
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.coinBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 3: //powerUp Box
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.powerUpBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 4: //uselessBox
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.uselessBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 5: //flagPole
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.flagPole();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            break;

          case 6: //flag
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.flag();
            element.draw();
            break;

          case 7: //pipeLeft
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeLeft();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 8: //pipeRight
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeRight();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 9: //pipeTopLeft
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeTopLeft();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 10: //pipeTopRight
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeTopRight();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 20: //goomba
            var enemy = new Enemy();
            enemy.x = column * tileSize;
            enemy.y = row * tileSize;
            enemy.goomba();
            enemy.draw();

            goombas.push(enemy);
            map[row][column] = 0;
        }
      }
    }
  };

  this.collisionCheck = function(objA, objB) {
    // get the vectors to check against
    var vX = objA.x + objA.width / 2 - (objB.x + objB.width / 2);
    var vY = objA.y + objA.height / 2 - (objB.y + objB.height / 2);

    // add the half widths and half heights of the objects
    var hWidths = objA.width / 2 + objB.width / 2;
    var hHeights = objA.height / 2 + objB.height / 2;
    var collisionDirection = null;

    // if the x and y vector are less than the half width or half height, then we must be inside the object, causing a collision
    if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
      // figures out on which side we are colliding (top, bottom, left, or right)
      var offsetX = hWidths - Math.abs(vX);
      var offsetY = hHeights - Math.abs(vY);

      if (offsetX >= offsetY) {
        if (vY > 0 && vY < 37) {
          collisionDirection = 't';
          if (objB.type != 5) {
            //if flagpole then pass through it
            objA.y += offsetY;
          }
        } else if (vY < 0) {
          collisionDirection = 'b';
          if (objB.type != 5) {
            //if flagpole then pass through it
            objA.y -= offsetY;
          }
        }
      } else {
        if (vX > 0) {
          collisionDirection = 'l';
          objA.x += offsetX;
        } else {
          collisionDirection = 'r';
          objA.x -= offsetX;
        }
      }
    }
    return collisionDirection;
  };

  this.checkElementMarioCollision = function(element, row, column) {
    // sad emotion: phase through some blocks (coin and useless boxes)
    if (currentEmotion == 'sad' && (element.type == 2 || element.type == 4)) {
      return;
    }
    var collisionDirection = that.collisionCheck(mario, element);

    if (collisionDirection == 'l' || collisionDirection == 'r') {
      mario.velX = 0;
      mario.jumping = false;

      if (element.type == 5) {
        //flag pole
        that.levelFinish(collisionDirection);
      }
    } else if (collisionDirection == 'b') {
      if (element.type != 5) {
        if (!gravityInverted) {
          // landing on top when gravity is normal
          mario.grounded = true;
          mario.jumping = false;
        } else {
          // inverted gravity: hitting a block "from below" is actually from above
          mario.velY *= -1;

          if (element.type == 3) {
            //PowerUp Box
            var powerUp = new PowerUp();

            if (mario.type == 'small') {
              powerUp.mushroom(element.x, element.y);
              powerUps.push(powerUp);
            } else {
              powerUp.flower(element.x, element.y);
              powerUps.push(powerUp);
            }

            map[row][column] = 4;
            gameSound.play('powerUpAppear');
          }

          if (element.type == 11) {
            var powerUp = new PowerUp();
            powerUp.flower(element.x, element.y);
            powerUps.push(powerUp);
            map[row][column] = 4;
            gameSound.play('powerUpAppear');
          }

          if (element.type == 2) {
            score.coinScore++;
            score.totalScore += 100;
            score.updateCoinScore();
            score.updateTotalScore();
            map[row][column] = 4;
            gameSound.play('coin');
          }
        }
      }
    } else if (collisionDirection == 't') {
      if (element.type != 5) {
        if (!gravityInverted) {
          // bumping head on block in normal gravity
          mario.velY *= -1;

          if (element.type == 3) {
            //PowerUp Box
            var powerUp = new PowerUp();

            //gives mushroom if mario is small, otherwise gives flower
            if (mario.type == 'small') {
              powerUp.mushroom(element.x, element.y);
              powerUps.push(powerUp);
            } else {
              powerUp.flower(element.x, element.y);
              powerUps.push(powerUp);
            }

            map[row][column] = 4; //sets to useless box after powerUp appears

            //sound when mushroom appears
            gameSound.play('powerUpAppear');
          }

          if (element.type == 11) {
            //Flower Box
            var powerUp = new PowerUp();
            powerUp.flower(element.x, element.y);
            powerUps.push(powerUp);

            map[row][column] = 4; //sets to useless box after powerUp appears

            //sound when flower appears
            gameSound.play('powerUpAppear');
          }

          if (element.type == 2) {
            //Coin Box
            score.coinScore++;
            score.totalScore += 100;

            score.updateCoinScore();
            score.updateTotalScore();
            map[row][column] = 4; //sets to useless box after coin appears

            //sound when coin block is hit
            gameSound.play('coin');
          }
        } else {
          // inverted gravity: landing on underside counts as ground
          mario.grounded = true;
          mario.jumping = false;
        }
      }
    }
  };

  this.checkElementPowerUpCollision = function(element) {
    for (var i = 0; i < powerUps.length; i++) {
      var collisionDirection = that.collisionCheck(powerUps[i], element);

      if (collisionDirection == 'l' || collisionDirection == 'r') {
        powerUps[i].velX *= -1; //change direction if collision with any element from the sidr
      } else if (collisionDirection == 'b') {
        powerUps[i].grounded = true;
      }
    }
  };

  this.checkElementEnemyCollision = function(element) {
    for (var i = 0; i < goombas.length; i++) {
      if (goombas[i].state != 'deadFromBullet') {
        //so that goombas fall from the map when dead from bullet
        var collisionDirection = that.collisionCheck(goombas[i], element);

        if (collisionDirection == 'l' || collisionDirection == 'r') {
          goombas[i].velX *= -1;
        } else if (collisionDirection == 'b') {
          goombas[i].grounded = true;
        }
      }
    }
  };

  this.checkElementBulletCollision = function(element) {
    for (var i = 0; i < bullets.length; i++) {
      var collisionDirection = that.collisionCheck(bullets[i], element);

      if (collisionDirection == 'b') {
        //if collision is from bottom of the bullet, it is grounded, so that it can be bounced
        bullets[i].grounded = true;
      } else if (collisionDirection == 't' || collisionDirection == 'l' || collisionDirection == 'r') {
        bullets.splice(i, 1);
      }
    }
  };

  this.checkPowerUpMarioCollision = function() {
    for (var i = 0; i < powerUps.length; i++) {
      var collWithMario = that.collisionCheck(powerUps[i], mario);
      if (collWithMario) {
        if (powerUps[i].type == 30 && mario.type == 'small') {
          //mushroom
          mario.type = 'big';
        } else if (powerUps[i].type == 31) {
          //flower
          mario.type = 'fire';
        }
        powerUps.splice(i, 1);

        score.totalScore += 1000;
        score.updateTotalScore();

        //sound when mushroom appears
        gameSound.play('powerUp');
      }
    }
  };

  this.checkEnemyMarioCollision = function() {
    for (var i = 0; i < goombas.length; i++) {
      if (goombas[i].isAlly) {
        // allies don't hurt mario
        continue;
      }
      // star mode: destroy enemies on any contact
      if (starModeActive && goombas[i].state != 'dead' && goombas[i].state != 'deadFromBullet') {
        var starColl = that.collisionCheck(goombas[i], mario);
        if (starColl) {
          goombas[i].state = 'deadFromBullet';
          score.totalScore += 1000;
          score.updateTotalScore();
          gameSound.play('killEnemy');
          continue;
        }
      }

      if (!mario.invulnerable && goombas[i].state != 'dead' && goombas[i].state != 'deadFromBullet') {
        //if mario is invulnerable or goombas state is dead, collision doesnt occur
        var collWithMario = that.collisionCheck(goombas[i], mario);

        if (collWithMario == 't') {
          //kill goombas if collision is from top
          if (goombas[i].spiked) {
            // spiked goombas hurt when stomped
            collWithMario = 'l'; // treat like side collision damage below
          } else {
            goombas[i].state = 'dead';

            mario.velY = -mario.speed;

            score.totalScore += 1000;
            score.updateTotalScore();

            // adapt: track stomp streak
            if (!that._stompCount) { that._stompCount = 0; }
            that._stompCount++;
            if (that._stompCount >= 3) {
              // future goombas gain spikes
              for (var s = 0; s < goombas.length; s++) {
                if (goombas[s].state != 'dead' && goombas[s].state != 'deadFromBullet') {
                  goombas[s].spiked = true;
                }
              }
            }

          //sound when enemy dies
          gameSound.play('killEnemy');
          }
        } 
        if (collWithMario == 'r' || collWithMario == 'l' || collWithMario == 'b') {
          goombas[i].velX *= -1;

          // angry short-range attack: side contact can blast enemy
          if (currentEmotion == 'angry') {
            goombas[i].state = 'deadFromBullet';
            score.totalScore += 1000;
            score.updateTotalScore();
            mario.velX *= -0.5; // recoil
            gameSound.play('killEnemy');
            continue;
          }

          if (mario.type == 'big') {
            mario.type = 'small';
            mario.invulnerable = true;
            collWithMario = undefined;

            //sound when mario powerDowns
            gameSound.play('powerDown');

            setTimeout(function() {
              mario.invulnerable = false;
            }, 1000);
          } else if (mario.type == 'fire') {
            mario.type = 'big';
            mario.invulnerable = true;

            collWithMario = undefined;

            //sound when mario powerDowns
            gameSound.play('powerDown');

            setTimeout(function() {
              mario.invulnerable = false;
            }, 1000);
          } else if (mario.type == 'small') {
            //kill mario if collision occurs when he is small
            that.pauseGame();

            mario.frame = 13;
            collWithMario = undefined;

            score.lifeCount--;
            score.updateLifeCount();

            //sound when mario dies
            gameSound.play('marioDie');

            timeOutId = setTimeout(function() {
              if (score.lifeCount == 0) {
                that.gameOver();
              } else {
                that.resetGame();
              }
            }, 3000);
            break;
          }
        }
      }
    }
  };

  this.befriendNearestGoomba = function() {
    var nearestIndex = -1;
    var nearestDist = 999999;
    for (var i = 0; i < goombas.length; i++) {
      if (goombas[i].state == 'dead' || goombas[i].state == 'deadFromBullet' || goombas[i].isAlly) {
        continue;
      }
      var dx = (goombas[i].x + goombas[i].width / 2) - (mario.x + mario.width / 2);
      var dy = (goombas[i].y + goombas[i].height / 2) - (mario.y + mario.height / 2);
      var d2 = dx * dx + dy * dy;
      if (d2 < nearestDist) {
        nearestDist = d2;
        nearestIndex = i;
      }
    }
    if (nearestIndex >= 0 && nearestDist < 200 * 200) {
      goombas[nearestIndex].isAlly = true;
      goombas[nearestIndex].spiked = false;
      goombas[nearestIndex].fireResistant = false;
      // flip direction toward mario immediately
      goombas[nearestIndex].velX = (mario.x > goombas[nearestIndex].x) ? 1 : -1;
      score.totalScore += 100; // tiny score for recruiting
      score.updateTotalScore();
    }
  };

  this.checkBulletEnemyCollision = function() {
    for (var i = 0; i < goombas.length; i++) {
      for (var j = 0; j < bullets.length; j++) {
        if (goombas[i] && goombas[i].state != 'dead') {
          //check for collision only if goombas exist and is not dead
          var collWithBullet = that.collisionCheck(goombas[i], bullets[j]);
        }

        if (collWithBullet) {
          // fire-resistant goombas ignore bullets
          if (goombas[i].fireResistant) {
            bullets.splice(j, 1);
            continue;
          }
          bullets[j] = null;
          bullets.splice(j, 1);

          goombas[i].state = 'deadFromBullet';

          score.totalScore += 1000;
          score.updateTotalScore();

          // adapt: track bullet streak
          if (!that._bulletCount) { that._bulletCount = 0; }
          that._bulletCount++;
          if (that._bulletCount >= 3) {
            for (var b = 0; b < goombas.length; b++) {
              if (goombas[b].state != 'dead' && goombas[b].state != 'deadFromBullet') {
                goombas[b].fireResistant = true;
              }
            }
          }

          //sound when enemy dies
          gameSound.play('killEnemy');
        }
      }
    }
  };

  // coin magnet: auto-collect nearby coin boxes
  this.magnetCollectCoins = function() {
    var radiusTiles = 4;
    var centerRow = Math.floor((mario.y + mario.height / 2) / tileSize);
    var centerCol = Math.floor((mario.x + mario.width / 2) / tileSize);

    var rowStart = Math.max(0, centerRow - radiusTiles);
    var rowEnd = Math.min(map.length - 1, centerRow + radiusTiles);

    for (var row = rowStart; row <= rowEnd; row++) {
      var colStart = 0;
      var colEnd = map[row].length - 1;
      colStart = Math.max(0, centerCol - radiusTiles);
      colEnd = Math.min(map[row].length - 1, centerCol + radiusTiles);

      for (var col = colStart; col <= colEnd; col++) {
        if (map[row][col] == 2) {
          // collect coin from box
          map[row][col] = 4; // turn into useless box
          score.coinScore++;
          score.totalScore += 100;
          score.updateCoinScore();
          score.updateTotalScore();
          gameSound.play('coin');
        }
      }
    }
  };

  this.wallCollision = function() {
    //for walls (vieport walls)
    if (mario.x >= maxWidth - mario.width) {
      mario.x = maxWidth - mario.width;
    } else if (mario.x <= translatedDist) {
      mario.x = translatedDist + 1;
    }

    //for ground (viewport ground)
    if (!gravityInverted && mario.y >= height) {
      that.pauseGame();

      //sound when mario dies
      gameSound.play('marioDie');

      score.lifeCount--;
      score.updateLifeCount();

      timeOutId = setTimeout(function() {
        if (score.lifeCount == 0) {
          that.gameOver();
        } else {
          that.resetGame();
        }
      }, 3000);
    }

    // top boundary death when gravity inverted
    if (gravityInverted && mario.y + mario.height <= 0) {
      that.pauseGame();

      //sound when mario dies
      gameSound.play('marioDie');

      score.lifeCount--;
      score.updateLifeCount();

      timeOutId = setTimeout(function() {
        if (score.lifeCount == 0) {
          that.gameOver();
        } else {
          that.resetGame();
        }
      }, 3000);
    }
  };

  //controlling mario with key events
  this.updateMario = function() {
    var friction = 0.9;
    var gravity = gravityInverted ? -0.2 : 0.2;

    mario.checkMarioType();

    if (keys[38] || keys[32]) {
      //up arrow
      if (!mario.jumping && mario.grounded) {
        mario.jumping = true;
        mario.grounded = false;
        var gdir = gravityInverted ? -1 : 1;
        var jumpBoost = (currentEmotion == 'happy') ? 1.5 : 0;
        mario.velY = -((mario.speed / 2 + 5.5 + jumpBoost)) * gdir;

        // mario sprite position
        if (mario.frame == 0 || mario.frame == 1) {
          mario.frame = 3; //right jump
        } else if (mario.frame == 8 || mario.frame == 9) {
          mario.frame = 2; //left jump
        }

        //sound when mario jumps
        gameSound.play('jump');
      }
    }

    var pressRight = keys[39];
    var pressLeft = keys[37];
    if (glitchModeActive) {
      // invert horizontal inputs
      var tmp = pressRight;
      pressRight = pressLeft;
      pressLeft = tmp;
    }

    if (pressRight) {
      //right arrow
      that.checkMarioPos(); //if mario goes to the center of the screen, sidescroll the map

      if (mario.velX < mario.speed) {
        mario.velX++;
      }

      //mario sprite position
      if (!mario.jumping) {
        tickCounter += 1;

        if (tickCounter > maxTick / mario.speed) {
          tickCounter = 0;

          if (mario.frame != 1) {
            mario.frame = 1;
          } else {
            mario.frame = 0;
          }
        }
      }
    }

    if (pressLeft) {
      //left arrow
      if (mario.velX > -mario.speed) {
        mario.velX--;
      }

      //mario sprite position
      if (!mario.jumping) {
        tickCounter += 1;

        if (tickCounter > maxTick / mario.speed) {
          tickCounter = 0;

          if (mario.frame != 9) {
            mario.frame = 9;
          } else {
            mario.frame = 8;
          }
        }
      }
    }

    var baseSpeed = keys[16] ? 4.5 : 3; // shift for sprint
    if (starModeActive) {
      baseSpeed += 1;
    }
    if (currentEmotion == 'happy') {
      baseSpeed += 0.5;
    } else if (currentEmotion == 'angry') {
      baseSpeed += 0.3;
    }
    mario.speed = baseSpeed;

    if (keys[17] && mario.type == 'fire') {
      //ctrl key
      if (!bulletFlag) {
        bulletFlag = true;
        var bullet = new Bullet();
        if (mario.frame == 9 || mario.frame == 8 || mario.frame == 2) {
          var direction = -1;
        } else {
          var direction = 1;
        }
        if (glitchModeActive) { direction *= -1; }
        bullet.init(mario.x, mario.y, direction);
        bullets.push(bullet);

        //bullet sound
        gameSound.play('bullet');

        setTimeout(function() {
          bulletFlag = false; //only lets mario fire bullet after 500ms
        }, 500);
      }
    }

    //velocity 0 sprite position
    if (mario.velX > 0 && mario.velX < 1 && !mario.jumping) {
      mario.frame = 0;
    } else if (mario.velX > -1 && mario.velX < 0 && !mario.jumping) {
      mario.frame = 8;
    }

    if (mario.grounded) {
      mario.velY = 0;

      //grounded sprite position
      if (mario.frame == 3) {
        mario.frame = 0; //looking right
      } else if (mario.frame == 2) {
        mario.frame = 8; //looking left
      }
    }

    //change mario position
    mario.velX *= friction;
    mario.velY += gravity;

    mario.x += mario.velX;
    mario.y += mario.velY;
  };

  this.checkMarioPos = function() {
    centerPos = translatedDist + viewPort / 2;

    //side scrolling as mario reaches center of the viewPort
    if (mario.x > centerPos && centerPos + viewPort / 2 < maxWidth) {
      gameUI.scrollWindow(-mario.speed, 0);
      translatedDist += mario.speed;
    }
  };

  this.levelFinish = function(collisionDirection) {
    //game finishes when mario slides the flagPole and collides with the ground
    if (collisionDirection == 'r') {
      mario.x += 10;
      mario.velY = 2;
      mario.frame = 11;
    } else if (collisionDirection == 'l') {
      mario.x -= 32;
      mario.velY = 2;
      mario.frame = 10;
    }

    if (marioInGround) {
      mario.x += 20;
      mario.frame = 10;
      tickCounter += 1;
      if (tickCounter > maxTick) {
        that.pauseGame();

        mario.x += 10;
        tickCounter = 0;
        mario.frame = 12;

        //sound when stage clears
        gameSound.play('stageClear');

        timeOutId = setTimeout(function() {
          currentLevel++;
          if (originalMaps[currentLevel]) {
            that.init(originalMaps, currentLevel);
            score.updateLevelNum(currentLevel);
          } else {
            that.gameOver();
          }
        }, 5000);
      }
    }
  };

  this.pauseGame = function() {
    window.cancelAnimationFrame(animationID);
  };

  this.gameOver = function() {
    score.gameOverView();
    gameUI.makeBox(0, 0, maxWidth, height);
    gameUI.writeText('Game Over', centerPos - 80, height - 300);
    gameUI.writeText('Thanks For Playing', centerPos - 122, height / 2);
  };

  this.resetGame = function() {
    that.clearInstances();
    that.init(originalMaps, currentLevel);
  };

  this.clearInstances = function() {
    mario = null;
    element = null;
    gameSound = null;

    goombas = [];
    bullets = [];
    powerUps = [];
  };

  this.clearTimeOut = function() {
    clearTimeout(timeOutId);
  };

  this.removeGameScreen = function() {
    gameUI.hide();

    if (score) {
      score.hideScore();
    }
  };

  this.showGameScreen = function() {
    gameUI.show();
  };
}
