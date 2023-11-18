const $winner = document.querySelector("#winner");
const $startButton = document.querySelector("#start-button");
const $options = document.querySelector("#options");
const $scene = document.querySelector("#scene");
const $trackers = document.querySelector("#trackers");

// sync with CSS!!
const TRACK_WIDTH = 300;
const TRACK_LENGTH = 750;
const IMG_SIZE = 40;

const Z_START = -TRACK_LENGTH + IMG_SIZE * 2;
const Z_END = -IMG_SIZE / 4;
const FPS = 1000 / 60;
const MIN_ADVANCE = 1;
const MAX_ADVANCE = 100;
const X_NOISE = 1;

// Determined at runtime
let OPT_TRACK_LENGTH;
let GOAL;

const KEYS = Object.keys(config.$);

const game = KEYS.reduce(
  (acc, key) => {
    acc.$[key] = {
      x: config.$[key].xOffset,
      z: 0,
      frame: 0,
      $image: (() => {
        const img = new Image();
        img.className = "img";
        return img;
      })(),
      $progress: (() => {
        const $tracker = document.createElement("div");
        $tracker.className = `tracker`;
        const $subtracker = document.createElement("span");
        $subtracker.className = "subtracker";
        $subtracker.style.backgroundColor = config.$[key].color;
        $tracker.appendChild($subtracker);
        return $tracker;
      })(),
    };
    return acc;
  },
  {
    started: false,
    winner: null,
    loser: null,
    $: {},
  }
);

function prepareScene() {
  // Put the bushes in the scene
  const BUSH_OFFSET = 16;
  const BUSH_DENSITY = 10;
  [-TRACK_WIDTH + BUSH_OFFSET, TRACK_WIDTH - BUSH_OFFSET].forEach((x) => {
    for (let i = 0; i < BUSH_DENSITY; i++) {
      const $bush = document.createElement("div");
      $bush.className = "bush";
      $bush.style.transform = `translate3d(${x / 2}px, 0, ${
        -1 * Math.random() * (TRACK_LENGTH - BUSH_OFFSET * 2)
      }px)`;
      $scene.appendChild($bush);
    }
  });
}

function renderPlayer(key) {
  // Limit the x position to the cube size
  game.$[key].x = Math.min(
    TRACK_WIDTH / 2 - IMG_SIZE,
    Math.max(-(TRACK_WIDTH / 2) + IMG_SIZE, game.$[key].x)
  );
  game.$[key].z = Math.max(0, Math.min(GOAL, game.$[key].z));

  if (game.winner === key || game.loser === key) {
    // Do not redraw when we already declared winner or loser
    return;
  }

  const ratio = Math.min(1, game.$[key].z / GOAL);
  const z = Z_START + (Z_END - Z_START) * ratio;

  game.$[key].$image.src = `./${key}/${1 + game.$[key].frame}.png`;
  game.$[
    key
  ].$image.style.transform = `translate3d(${game.$[key].x}px, 0, ${z}px)`;

  const meters = Math.floor(OPT_TRACK_LENGTH * ratio);
  game.$[key].$progress.firstChild.textContent = `${meters}m`;
  game.$[key].$progress.firstChild.style.transform = `translateX(-${
    (1 - ratio) * 100
  }%)`;
}

let then = null;

function renderingLoop() {
  requestAnimationFrame(renderingLoop);

  let now = Date.now();
  let deltaTime = now - then;

  if (deltaTime <= FPS) return;
  then = now - (deltaTime % FPS);

  if (game.started) {
    KEYS.forEach((key) => {
      advancePlayer(key);
    });
  }

  KEYS.forEach((key) => {
    renderPlayer(key);
  });
}

function advancePlayer(key) {
  if (game.winner === key || game.loser === key) {
    // Do not advance when we already declared winner or loser
    return;
  }

  const advanceBy =
    MIN_ADVANCE + Math.floor(Math.random() * (MAX_ADVANCE - MIN_ADVANCE));

  game.$[key].z = Math.min(GOAL, game.$[key].z + advanceBy);
  game.$[key].frame = (game.$[key].frame + 1) % config.$[key].maxFrames;

  // Apply a bit of noise to the x position
  game.$[key].x += -X_NOISE + Math.random() * X_NOISE * 2;

  if (game.$[key].z >= GOAL) {
    renderPlayer(key);

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
  game.$[key].$image.src = `./${key}/win.gif`;
  game.$[key].$progress.firstChild.textContent = "finished";
  $winner.textContent = `${key} won!`;
  $winner.style.color = config.$[key].color;
}

function declareLoser(key) {
  if (game.loser) return;

  game.loser = key;
  game.$[key].$image.src = `./${key}/lost.gif`;
  game.$[key].$progress.firstChild.textContent = "finished";
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
      img.src = `./${key}/${i}`;
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
              renderPlayer(key);
            });
          });
        }
      })
      .catch(console.error);
  }
}

function startRace() {
  game.started = true;
}

function readOptions() {
  OPT_TRACK_LENGTH = document.querySelector("#opt-track-length").value;
  GOAL = MAX_ADVANCE * OPT_TRACK_LENGTH;
}

console.log("config :>> ", config);

Promise.all(KEYS.map((key) => preloadImages(key))).then(() => {
  KEYS.forEach((key) => {
    $scene.appendChild(game.$[key].$image);
    $trackers.appendChild(game.$[key].$progress);
  });
  $startButton.classList.add("active");
  $options.classList.add("active");
});

$startButton.addEventListener("click", () => {
  $startButton.classList.remove("active");
  $options.classList.remove("active");
  readOptions();
  handleAccelerometer();
  startRace();
});

readOptions();
prepareScene();
renderingLoop();
