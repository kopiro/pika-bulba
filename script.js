const $css = getComputedStyle(document.documentElement);

const $winner = document.querySelector("#winner");
const $startAutorace = document.querySelector("#start-autorace");
const $startCoop = document.querySelector("#start-coop");
const $scene = document.querySelector("#scene");
const $trackers = document.querySelector("#trackers");
const $resetButton = document.querySelector("#reset-button");

const $images = {};
const $progress = {};

const $rocks = [];

// Static values from CSS
const TRACK_WIDTH = getCSSVar("--track-width");
const IMG_SIZE = getCSSVar("--img-size");
const INFINITE_TRACK_LENGTH = getCSSVar("--infinite-track-length");

// Static values
const FPS = 1000 / 60;
const MIN_ADVANCE = 1;
const MAX_ADVANCE = 10;
const X_NOISE = 1;
const COOP_ADVANCE = 10;
const GOAL_Z_OFFSET = 100;

// Determined at runtime
let TRACK_LENGTH;

const KEYS = Object.keys(config.$);

let game = null;

function loadGame() {
  readOptions();

  game = KEYS.reduce(
    (acc, key) => {
      acc.$[key] = {
        x: config.$[key].xOffset,
        y: 0,
        z: TRACK_LENGTH,
        frame: 0,
      };
      return acc;
    },
    {
      started: false,
      mode: null,
      winner: null,
      loser: null,
      $: {},
    }
  );

  document.body.classList.remove("game-ended");
  document.body.classList.remove("game-started");
}

function getAdvanceBy(key) {
  return MIN_ADVANCE + Math.floor(Math.random() * MAX_ADVANCE);
}

function prepareSceneAddBushes() {
  const BUSH_OFFSET = 16;
  const BUSH_DENSITY = 30;
  [-TRACK_WIDTH + BUSH_OFFSET, TRACK_WIDTH - BUSH_OFFSET].forEach((_x) => {
    for (let i = 0; i < BUSH_DENSITY; i++) {
      const $bush = document.createElement("div");
      $bush.className = "bush bush-style";
      const x = _x / 2;
      const y = 0;
      const z =
        GOAL_Z_OFFSET + Math.random() * (INFINITE_TRACK_LENGTH - GOAL_Z_OFFSET);
      applyCoordinates({ x, y, z }, $bush);
      $scene.appendChild($bush);
    }
  });
}

function prepareSceneAddRocks() {
  // Put the bushes in the scene
  const maxX = TRACK_WIDTH / 2 - 16;
  const ROCK_DENSITY = 20;
  for (let i = 0; i < ROCK_DENSITY; i++) {
    const $rock = document.createElement("div");
    $rock.className = "bush rock-style";
    const x = maxX - Math.random() * maxX * 2;
    const y = 0;
    const z =
      GOAL_Z_OFFSET + Math.random() * (INFINITE_TRACK_LENGTH - GOAL_Z_OFFSET);
    $rocks.push({ x, y, z });
    applyCoordinates({ x, y, z }, $rock);
    $scene.appendChild($rock);
  }
}

function checkForRockCollision(key, treshold) {
  const { x, y, z } = game.$[key];
  const collision = $rocks.find(
    (rock) =>
      Math.abs(rock.x - x) < treshold &&
      Math.abs(rock.y - y) < treshold &&
      Math.abs(rock.z - z) < treshold
  );
  return collision;
}

function prepareSceneSetLines() {
  document.querySelector(
    "#start"
  ).style.transform = `translate3d(-50%, -100%, ${-1 * TRACK_LENGTH}px)`;
}

async function prepareScene() {
  prepareSceneSetLines();
  prepareSceneAddBushes();
  prepareSceneAddRocks();

  KEYS.forEach((key) => {
    $images[key] = (() => {
      const img = new Image();
      img.className = "img";
      return img;
    })();
    $scene.appendChild($images[key]);

    $progress[key] = (() => {
      const $tracker = document.createElement("div");
      $tracker.className = `tracker`;
      const $subtracker = document.createElement("span");
      $subtracker.className = "subtracker";
      $subtracker.style.backgroundColor = config.$[key].color;
      $tracker.appendChild($subtracker);
      return $tracker;
    })();
    $trackers.appendChild($progress[key]);
  });
}

function clampPlayer(key) {
  game.$[key].x = Math.min(
    TRACK_WIDTH / 2 - IMG_SIZE,
    Math.max(-(TRACK_WIDTH / 2) + IMG_SIZE, game.$[key].x)
  );
  game.$[key].y = Math.max(0, game.$[key].y);
  game.$[key].z = Math.max(0, game.$[key].z);
}

function applyCoordinates(coords, $element) {
  const { x, y, z } = coords;
  const cssX = x;
  const cssY = -y;
  const cssZ = -z;
  $element.style.transform = `translate3d(${cssX}px, ${cssY}px, ${cssZ}px)`;
}

function renderPlayer(key) {
  clampPlayer(key);

  const { x, y, z, frame } = game.$[key];
  const ratio = (TRACK_LENGTH - z) / TRACK_LENGTH;

  if (game.winner === key) {
    const winGif = `./${key}/win.gif`;
    if ($images[key].dataset.src !== winGif) {
      $images[key].dataset.src = winGif;
      $images[key].src = winGif;
    }
  } else if (game.loser === key) {
    const lostGif = `./${key}/lost.gif`;
    if ($images[key].dataset.src !== lostGif) {
      $images[key].dataset.src = lostGif;
      $images[key].src = lostGif;
    }
  } else {
    const nextFrame = `./${key}/${frame + 1}.png`;
    if ($images[key].dataset.src !== nextFrame) {
      $images[key].dataset.src = nextFrame;
      $images[key].src = nextFrame;
    }

    $progress[key].firstChild.textContent = `${Math.floor(
      ratio * TRACK_LENGTH
    )}m`;
  }

  applyCoordinates(game.$[key], $images[key]);
  $progress[key].firstChild.style.transform = `translateX(-${
    (1 - ratio) * 100
  }%)`;
}

let then = null;

function startRenderingLoop() {
  requestAnimationFrame(startRenderingLoop);

  let now = Date.now();
  let deltaTime = now - then;

  if (deltaTime <= FPS) return;
  then = now - (deltaTime % FPS);

  if (game.started) {
    KEYS.forEach((key) => {
      advancePlayer(key, now);
    });
  }

  KEYS.forEach((key) => {
    renderPlayer(key);
  });
}

function flyUpEquation(t) {
  // Map t in radians
  return 130 * t + 5 * Math.sin(20 * t);
}

function jumpEquation(t) {
  return 30 * Math.sin(10 * t);
}

function advancePlayer(key, now) {
  if (game.winner === key) {
    const timeSinceWin = (now - game.$[key].wonAt) / 1000;
    game.$[key].y = flyUpEquation(timeSinceWin);
    return;
  }

  if (game.loser === key) {
    return;
  }

  // Move player
  if (game.mode === "auto") {
    // Check for imminent collision
    if (!game.$[key].jumpingStartTime) {
      const collision = checkForRockCollision(key, IMG_SIZE * 0.8);
      if (collision) {
        console.log("collision :>> ", collision);
        game.$[key].jumpingStartTime = now;
      }
    }

    // Add noise
    const xNoise = -X_NOISE + Math.random() * X_NOISE * 2;
    game.$[key].x += xNoise;

    // Check if player is jumping
    if (game.$[key].jumpingStartTime) {
      const timeSinceJump = (now - game.$[key].jumpingStartTime) / 1000;
      console.log("timeSinceJump :>> ", timeSinceJump);
      game.$[key].y = jumpEquation(timeSinceJump);
      console.log("game.$[key].y :>> ", game.$[key].y);
      if (game.$[key].y < 0) {
        game.$[key].y = 0;
        game.$[key].jumpingStartTime = null;
      }
    }

    // Advance Z
    const advanceBy = getAdvanceBy(key);
    game.$[key].z = Math.max(0, game.$[key].z - advanceBy);
  }

  // Advance next frame of the GIF
  game.$[key].frame = (game.$[key].frame + 1) % config.$[key].maxFrames;

  if (game.$[key].z <= 0) {
    if (game.winner === null) {
      declareWinner(key);
    } else if (game.winner !== key) {
      declareLoser(key);
    }
  }
}

function declareWinner(key) {
  if (game.winner) return;

  game.winner = key;
  game.$[key].wonAt = Date.now();

  $progress[key].firstChild.textContent = "finished";
  $winner.textContent = `${key} won!`;
  $winner.style.color = config.$[key].color;

  endGame();
}

function declareLoser(key) {
  if (game.loser) return;

  game.loser = key;
  $progress[key].firstChild.textContent = "finished";
}

function getCSSVar(key) {
  return Number($css.getPropertyValue(key).replace("px", ""));
}

function preloadImages(key) {
  return new Promise((resolve) => {
    let loaded = 0;
    const frames = new Array(config.$[key].maxFrames - 1)
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

            KEYS.forEach((key) => {
              game.$[key].x += x / 10;
            });
          });
        }
      })
      .catch(console.error);
  }
}

function readOptions() {
  TRACK_LENGTH = document.querySelector("#opt-track-length").value;
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

function preload() {
  return Promise.all(KEYS.map((key) => preloadImages(key)));
}

async function main() {
  loadGame();

  await preload();
  prepareScene();

  document.body.classList.add("game-ready");

  $startAutorace.addEventListener("click", () => {
    game.mode = "auto";
    handleAccelerometer();
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
    prepareSceneSetLines();
  });

  window.addEventListener("keyup", (e) => {
    if (game.mode !== "coop") return;

    KEYS.forEach((key) => {
      if (e.key.toLowerCase() === key.substring(0, 1).toLowerCase()) {
        game.$[key].z += COOP_ADVANCE;
      }
    });
  });

  startRenderingLoop();
}

console.log("config :>> ", config);
main();
