const playerKeys = Object.keys(config.players);
const $ = document.querySelector.bind(document);

const $css = getComputedStyle(document.documentElement);

const $winner = $("#winner");
const $startAutorace = $("#start-autorace");
const $startCoop = $("#start-coop");
const $scene = $("#scene");
const $trackers = $("#trackers");
const $resetButton = $("#reset-button");
const $start = $("#start");
const $music = $("#music");

const game = {
  $: { rocks: [], bushes: [], players: {}, progress: {} },
};

// Static values from CSS
const kTrackWidth = getCSSVar("--track-width");
const kImgSize = getCSSVar("--img-size");
const kInfiniteTrackLength = getCSSVar("--infinite-track-length");

// Static values
const kFPS = 60;
const framesPerSecond = 1000 / kFPS;
const kAutoMinAdvance = 1;
const kAutoMaxAdvance = 10;
const kXNoiseMax = 2;

const kCoopMul = 1;
const kCoopBoost = kCoopMul * kAutoMaxAdvance;
const kCoopDecay = kCoopMul * 0.05;
const kMaxCoopBost = 3;
const kCoopX = 2;

const kGoalZOffset = 100;
const kRockDensity = 20;
const kBushOffset = 16;
const kBushDensity = 30;

const kCameraOffset = 600;
const kMaxCameraZ = -480;
const kCameraX = kTrackWidth / 4;
const kCameraY = 400;

function loadGame() {
  readOptions();

  game.started = false;
  game.mode = null;
  game.winner = null;
  game.loser = null;

  game.$.players = playerKeys.reduce((acc, key) => {
    acc[key] = {
      ...acc[key],
      key: key,
      config: config.players[key],
      x: config.players[key].xOffset,
      y: 0,
      z: game.trackLength,
      frame: 0,
      coopValue: 0,
    };
    return acc;
  }, game.$.players || {});

  document.body.classList.remove("game-ended");
  document.body.classList.remove("game-started");

  $start.style.transform = `translate3d(-50%, -100%, ${
    -1 * game.trackLength
  }px)`;
}

function getAdvanceBy(p) {
  return kAutoMinAdvance + Math.floor(Math.random() * kAutoMaxAdvance);
}

function prepareSceneAddBushes() {
  [-kTrackWidth + kBushOffset, kTrackWidth - kBushOffset].forEach((_x) => {
    for (let i = 0; i < kBushDensity; i++) {
      const x = _x / 2;
      const y = 0;
      const z = 0 + Math.random() * (kInfiniteTrackLength - 0);
      const bush = {
        x,
        y,
        z,
        $: (() => {
          const $ = document.createElement("div");
          $.className = "bush bush-style";
          return $;
        })(),
      };
      game.$.bushes.push(bush);
      applyCoordinates(bush);
      $scene.appendChild(bush.$);
    }
  });
}

function prepareSceneAddRocks() {
  // Put the bushes in the scene
  const maxX = kBushOffset + kTrackWidth / 2 - kBushOffset * 2;
  for (let i = 0; i < kRockDensity; i++) {
    const x = maxX - Math.random() * maxX * 2;
    const y = 0;
    const z =
      kGoalZOffset + Math.random() * (kInfiniteTrackLength - kGoalZOffset);
    [-1, 1].forEach((dir) => {
      const rock = {
        x: dir * x,
        y,
        z,
        $: (() => {
          const $ = document.createElement("div");
          $.className = "bush rock-style";
          return $;
        })(),
      };
      game.$.rocks.push(rock);
      applyCoordinates(rock);
      $scene.appendChild(rock.$);
    });
  }
}

const __rockCollisionCache = {};
function checkForRockCollision({ x, y, z }, treshold) {
  __rockCollisionCache[treshold] =
    __rockCollisionCache[treshold] ||
    game.$.rocks.reduce((acc, rock) => {
      const quantizedX = Math.floor(rock.x / treshold);
      const quantizedY = Math.floor(rock.y);
      const quantizedZ = Math.floor(rock.z / treshold);
      const key = `${quantizedX}-${quantizedY}-${quantizedZ}`;
      acc[key] = rock;
      return acc;
    }, {});

  // Check for lookup
  const quantizedX = Math.floor(x / treshold);
  const quantizedY = Math.floor(y);
  const quantizedZ = Math.floor(z / treshold);
  const key = `${quantizedX}-${quantizedY}-${quantizedZ}`;

  return key in __rockCollisionCache[treshold];
}

async function prepareScene() {
  prepareSceneAddBushes();
  prepareSceneAddRocks();

  Object.keys(game.$.players).forEach((key) => {
    const p = game.$.players[key];

    p.$ = (() => {
      const img = new Image();
      img.className = "img";
      return img;
    })();
    $scene.appendChild(p.$);

    game.$.progress[p.key] = (() => {
      const $tracker = document.createElement("div");
      $tracker.className = `tracker`;
      const $subtracker = document.createElement("span");
      $subtracker.className = "subtracker";
      $subtracker.style.backgroundColor = p.config.color;
      $tracker.appendChild($subtracker);
      return $tracker;
    })();
    $trackers.appendChild(game.$.progress[p.key]);
  });
}

function clampPlayer(p) {
  if (game.winner !== p) {
    p.x = Math.min(
      kTrackWidth / 2 - kImgSize,
      Math.max(-(kTrackWidth / 2) + kImgSize, p.x)
    );
  }
  p.y = Math.max(0, p.y);
  p.z = Math.max(0, p.z);
}

function applyCoordinates(p) {
  const cssX = p.x;
  const cssY = -p.y;
  const cssZ = -p.z;
  p.$.style.transform = `translate3d(${cssX}px, ${cssY}px, ${cssZ}px)`;
}

function moveCamera(z) {
  const realZ = Math.max(z - kCameraOffset, kMaxCameraZ);
  $scene.style.transform = `translate3d(${kCameraX}px, ${kCameraY}px, ${realZ}px)`;
}

function applySrc(obj, src) {
  if (obj.src !== src) {
    obj.src = src;
    obj.$.src = obj.src;
  }
}

function renderPlayer(p) {
  clampPlayer(p);
  applyCoordinates(p);

  const ratio = (game.trackLength - p.z) / game.trackLength;

  if (game.winner === p) {
    applySrc(p, `./${p.key}/win.gif`);
  } else if (game.loser === p) {
    applySrc(p, `./${p.key}/lost.gif`);
  } else {
    applySrc(p, `./${p.key}/${p.frame + 1}.png`);
    game.$.progress[p.key].firstChild.textContent = `${Math.floor(
      ratio * game.trackLength
    )}m`;
  }

  game.$.progress[p.key].firstChild.style.transform = `translateX(-${
    (1 - ratio) * 100
  }%)`;
}

let then = null;
let now = null;
let deltaTime = null;
let frameCount = 1;

function startRenderingLoop() {
  requestAnimationFrame(startRenderingLoop);

  now = Date.now();
  deltaTime = now - then;

  if (deltaTime <= framesPerSecond) return;
  then = now - (deltaTime % framesPerSecond);
  frameCount++;

  if (game.started) {
    Object.keys(game.$.players).forEach((key) => {
      movePlayer(game.$.players[key]);
    });
  }

  Object.keys(game.$.players).forEach((key) => {
    renderPlayer(game.$.players[key]);
  });

  // Find the player with the lowest Z
  const lowestZ = Object.keys(game.$.players).reduce((acc, key) => {
    return Math.min(acc, game.$.players[key].z);
  }, kInfiniteTrackLength);

  moveCamera(lowestZ);
}

function flyEquation(t) {
  return {
    x: -1 * t,
    y: 130 * t + 5 * Math.sin(20 * t),
  };
}

function jumpEquation(t) {
  return {
    z: 0,
    y: 50 * Math.sin(6 * t),
  };
}

function movePlayer(p) {
  if (game.winner === p) {
    const timeSinceNow = now - p.wonT;
    const { x, y } = flyEquation(timeSinceNow / 1000);
    p.x += x;
    p.y = y;
    return;
  }

  if (game.loser === p) {
    return;
  }

  // Check if player is jumping
  if (p.jumpingT) {
    const timeSinceJump = now - p.jumpingT;
    const { z, y } = jumpEquation(timeSinceJump / 1000);
    p.y = y;
    p.z -= z;

    if (p.y < 0) {
      p.y = 0;
      p.jumpingT = null;
    }
  }

  // Move player
  if (game.mode === "auto") {
    // Check for imminent collision
    if (!p.jumpingT) {
      const collision = checkForRockCollision(p, kImgSize);
      if (collision) {
        p.jumpingT = now;
      }
    }

    // Add noise
    const xNoise = -kXNoiseMax + Math.random() * kXNoiseMax * 2;
    p.x += xNoise;

    // Advance Z
    const advanceBy = getAdvanceBy(p.key);
    p.z = Math.max(0, p.z - advanceBy);
  } else if (game.mode === "coop") {
    p.coopValue = Math.max(0, p.coopValue - kCoopDecay);

    const collision = checkForRockCollision(p, kImgSize);
    if (collision) {
      // Do nothing, do not advance
    } else {
      p.z -= p.coopValue;
    }
  }

  // Advance next frame of the GIF
  if (p.lastZ > p.z) {
    p.frame = (p.frame + 1) % p.config.maxFrames;
  }
  p.lastZ = p.z;

  // Check if someone won
  if (p.z <= 0) {
    if (game.winner === null) {
      declareWinner(p);
    } else if (game.winner !== p) {
      declareLoser(p);
    }
  }
}

function declareWinner(p) {
  if (game.winner) return;

  game.winner = p;
  p.wonT = now;

  game.$.progress[p.key].firstChild.textContent = "finished";
  $winner.textContent = `${p.key} won!`;
  $winner.style.color = p.config.color;

  endGame();
}

function declareLoser(p) {
  if (game.loser) return;

  game.loser = p;
  game.$.progress[p.key].firstChild.textContent = "finished";
}

function getCSSVar(key) {
  return Number($css.getPropertyValue(key).replace("px", ""));
}

function preloadImages(key) {
  return new Promise((resolve) => {
    let loaded = 0;
    const frames = new Array(game.$.players[key].config.maxFrames - 1)
      .fill()
      .map((_, i) => `${i + 1}.png`);
    frames.push("win.gif");
    frames.push("lost.gif");
    frames.forEach((i) => {
      const img = new Image();
      const src = `./${key}/${i}`;
      img.onload = () => {
        loaded++;
        if (loaded === frames.length) {
          resolve();
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === frames.length) {
          resolve();
        }
      };
      img.src = src;
    });
  });
}

function handleAccelerometer() {
  // If we have an accelerometer in the device, use it to move X of the player based on the inclination of the phone (DeviceMotion)
  if (
    window.DeviceMotionEvent &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
    // Request permissions
    DeviceMotionEvent.requestPermission()
      .then((permissionState) => {
        if (permissionState === "granted") {
          window.addEventListener("devicemotion", (event) => {
            const x = event.accelerationIncludingGravity.x;
            const y = event.accelerationIncludingGravity.y;
            const z = event.accelerationIncludingGravity.z;

            playerKeys.forEach((key) => {
              game.$.players[key].x += x / 10;
            });
          });
        }
      })
      .catch(console.error);
  }
}

function readOptions() {
  game.trackLength = $("#opt-track-length").value;
}

function startGame() {
  if (game.started) return;
  document.body.classList.add("game-started");
  game.started = true;

  $("#music-bg").currentTime = 0;
  $("#music-bg").play();
}

function endGame() {
  if (!game.started) return;
  document.body.classList.add("game-ended");

  $("#music-bg").pause();

  $("#music-end").currentTime = 0;
  $("#music-end").play();
}

function preloadResources() {
  return Promise.all(
    Object.keys(game.$.players).map((key) => preloadImages(key))
  );
}

async function main() {
  loadGame();
  prepareScene();

  await preloadResources();

  document.body.classList.add("game-ready");

  $startAutorace.addEventListener("click", () => {
    game.mode = "auto";
    // handleAccelerometer();
    startGame();
  });

  $startCoop.addEventListener("click", () => {
    game.mode = "coop";
    startGame();
  });

  $resetButton.addEventListener("click", () => {
    $("#music-end").pause();
    $("#music-bg").pause();
    loadGame();
  });

  $("#opt-track-length").addEventListener("input", () => {
    loadGame();
  });

  window.addEventListener("keyup", (e) => {
    if (game.mode !== "coop") return;
    e.preventDefault();

    Object.keys(game.$.players).forEach((key) => {
      const p = game.$.players[key];
      Object.entries(p.config.keystrokes).forEach(([keystroke, action]) => {
        if (keystroke !== e.key) return;
        switch (action) {
          case "advance":
            p.coopValue = Math.min(kMaxCoopBost, p.coopValue + kCoopBoost);
            break;
          case "jump":
            p.jumpingT = p.jumpingT || now;
            break;
          case "left":
            p.x -= kCoopX;
            break;
          case "right":
            p.x += kCoopX;
            break;
        }
      });
    });
  });

  startRenderingLoop();
}

main();
