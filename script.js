const $css = getComputedStyle(document.documentElement);

const $winner = document.querySelector("#winner");
const $startAutorace = document.querySelector("#start-autorace");
const $startCoop = document.querySelector("#start-coop");
const $scene = document.querySelector("#scene");
const $trackers = document.querySelector("#trackers");
const $resetButton = document.querySelector("#reset-button");
const $start = document.querySelector("#start");

const playerKeys = Object.keys(config.players);

const game = {
  $: { rocks: [], bushes: [], players: {}, progress: {} },
};

// Static values from CSS
const kTrackWidth = getCSSVar("--track-width");
const kImgSize = getCSSVar("--img-size");
const kInfiniteTrackLength = getCSSVar("--infinite-track-length");

// Static values
const kFPS = 1000 / 60;
const kAutoMinAdvance = 1;
const kAutoMaxAdvance = 10;
const kXNoiseMax = 1;
const kCoopAdvance = 10;
const kGoalZOffset = 100;

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
  const BUSH_OFFSET = 16;
  const BUSH_DENSITY = 30;
  [-kTrackWidth + BUSH_OFFSET, kTrackWidth - BUSH_OFFSET].forEach((_x) => {
    for (let i = 0; i < BUSH_DENSITY; i++) {
      const x = _x / 2;
      const y = 0;
      const z =
        kGoalZOffset + Math.random() * (kInfiniteTrackLength - kGoalZOffset);
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
  const maxX = kTrackWidth / 2 - 16;
  const ROCK_DENSITY = 20;
  for (let i = 0; i < ROCK_DENSITY; i++) {
    const x = maxX - Math.random() * maxX * 2;
    const y = 0;
    const z =
      kGoalZOffset + Math.random() * (kInfiniteTrackLength - kGoalZOffset);
    const rock = {
      x,
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
  }
}

const __rockCollisionCache = {};
function checkForRockCollision({ x, y, z }, treshold) {
  __rockCollisionCache[treshold] =
    __rockCollisionCache[treshold] ||
    game.$.rocks.reduce((acc, rock) => {
      const quantizedX = Math.floor(rock.x / treshold);
      const quantizedY = Math.floor(rock.y / treshold);
      const quantizedZ = Math.floor(rock.z / (treshold * 2));
      const key = `${quantizedX}-${quantizedY}-${quantizedZ}`;
      acc[key] = rock;
      return acc;
    }, {});

  // Check for lookup
  const quantizedX = Math.floor(x / treshold);
  const quantizedY = Math.floor(y / treshold);
  const quantizedZ = Math.floor(z / (treshold * 2));
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

  console.log("game.$.players :>> ", game.$.players);
}

function clampPlayer(p) {
  p.x = Math.min(
    kTrackWidth / 2 - kImgSize,
    Math.max(-(kTrackWidth / 2) + kImgSize, p.x)
  );
  p.y = Math.max(0, p.y);
  p.z = Math.max(0, p.z);
}

function applyCoordinates(p) {
  const cssX = p.x;
  const cssY = -p.y;
  const cssZ = -p.z;
  p.$.style.transform = `translate3d(${cssX}px, ${cssY}px, ${cssZ}px)`;
}

function applySrc(obj, src) {
  if (obj.src !== src) {
    obj.src = src;
    obj.$.src = obj.src;
  }
}

function renderPlayer(p, now) {
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

function startRenderingLoop() {
  requestAnimationFrame(startRenderingLoop);

  let now = Date.now();
  let deltaTime = now - then;

  if (deltaTime <= kFPS) return;
  then = now - (deltaTime % kFPS);

  if (game.started) {
    Object.keys(game.$.players).forEach((key) => {
      movePlayer(game.$.players[key], now);
    });
  }

  Object.keys(game.$.players).forEach((key) => {
    renderPlayer(game.$.players[key], now);
  });
}

function flyUpEquation(t) {
  return 130 * t + 5 * Math.sin(20 * t);
}

function jumpEquation(t) {
  return 30 * Math.sin(10 * t);
}

function movePlayer(p, now) {
  if (game.winner === p) {
    const timeSinceWin = (now - p.wonAt) / 1000;
    p.x += 0.5;
    p.y = flyUpEquation(timeSinceWin);
    return;
  }

  if (game.loser === p) {
    return;
  }

  // Move player
  if (game.mode === "auto") {
    // Check for imminent collision
    if (!p.jumpingStartTime) {
      const collision = checkForRockCollision(p, kImgSize);
      if (collision) {
        console.log("collision :>> ", collision);
        p.jumpingStartTime = now;
      }
    }

    // Add noise
    const xNoise = -kXNoiseMax + Math.random() * kXNoiseMax * 2;
    p.x += xNoise;

    // Check if player is jumping
    if (p.jumpingStartTime) {
      const timeSinceJump = (now - p.jumpingStartTime) / 1000;
      p.y = jumpEquation(timeSinceJump);

      if (p.y < 0) {
        p.y = 0;
        p.jumpingStartTime = null;
      }
    }

    // Advance Z
    const advanceBy = getAdvanceBy(p.key);
    p.z = Math.max(0, p.z - advanceBy);
  }

  // Advance next frame of the GIF
  p.frame = (p.frame + 1) % p.config.maxFrames;

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
  p.wonAt = Date.now();

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
  console.log("game.$.players :>> ", game.$.players);
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
  game.trackLength = document.querySelector("#opt-track-length").value;
}

function startGame() {
  if (game.started) return;
  document.body.classList.add("game-started");
  game.started = true;
}

function endGame() {
  if (!game.started) return;
  document.body.classList.add("game-ended");
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
    loadGame();
  });

  document.querySelector("#opt-track-length").addEventListener("input", () => {
    loadGame();
  });

  window.addEventListener("keyup", (e) => {
    if (game.mode !== "coop") return;

    playerKeys.forEach((key) => {
      if (e.key.toLowerCase() === key.substring(0, 1).toLowerCase()) {
        game.$.players[key].z -= kCoopAdvance;
      }
    });
  });

  startRenderingLoop();
}

console.log("config :>> ", config);
main();
