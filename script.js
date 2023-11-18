const $css = getComputedStyle(document.documentElement);

const $winner = document.querySelector("#winner");
const $startButton = document.querySelector("#start-button");
const $options = document.querySelector("#options");
const $scene = document.querySelector("#scene");
const $trackers = document.querySelector("#trackers");

// Static values from CSS
const TRACK_WIDTH = getCSSVar("--track-width");
const IMG_SIZE = getCSSVar("--img-size");
const INFINITE_TRACK_LENGTH = getCSSVar("--infinite-track-length");

// Static values
const FPS = 1000 / 60;
const MIN_ADVANCE = 1;
const MAX_ADVANCE = 10;
const X_NOISE = 1;

// Determined at runtime
let TRACK_LENGTH;

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

function getAdvanceBy(key) {
  return MIN_ADVANCE + Math.floor(Math.random() * MAX_ADVANCE);
}

function prepareSceneAddBushes() {
  // Put the bushes in the scene
  const BUSH_OFFSET = 16;
  const BUSH_DENSITY = 20;
  [-TRACK_WIDTH + BUSH_OFFSET, TRACK_WIDTH - BUSH_OFFSET].forEach((x) => {
    for (let i = 0; i < BUSH_DENSITY; i++) {
      const $bush = document.createElement("div");
      $bush.className =
        "bush" +
        (Math.floor(Math.random() * 4) % 2 === 0
          ? " bush-style"
          : " rock-style");
      $bush.style.transform = `translate3d(${x / 2}px, 0, ${
        -1 * Math.random() * (INFINITE_TRACK_LENGTH - BUSH_OFFSET * 2)
      }px)`;
      $scene.appendChild($bush);
    }
  });
}

function prepareSceneSetLines() {
  document.querySelector(
    "#road-start-line"
  ).style.transform = `translate3d(-50%, -50%, ${
    -1 * TRACK_LENGTH
  }px) rotateX(90deg)`;
}

function prepareScene() {
  prepareSceneSetLines();
  prepareSceneAddBushes();
}

function renderPlayer(key) {
  // Limit the x position to the cube size
  game.$[key].x = Math.min(
    TRACK_WIDTH / 2 - IMG_SIZE,
    Math.max(-(TRACK_WIDTH / 2) + IMG_SIZE, game.$[key].x)
  );
  game.$[key].z = Math.max(0, Math.min(TRACK_LENGTH, game.$[key].z));

  const { x, z, frame } = game.$[key];
  const ratio = z / TRACK_LENGTH;

  if (game.winner === key) {
    const winGif = `./${key}/win.gif`;
    if (game.$[key].$image.dataset.src !== winGif) {
      game.$[key].$image.dataset.src = winGif;
      game.$[key].$image.src = winGif;
    }
  } else if (game.loser === key) {
    const lostGif = `./${key}/lost.gif`;
    if (game.$[key].$image.dataset.src !== lostGif) {
      game.$[key].$image.dataset.src = lostGif;
      game.$[key].$image.src = lostGif;
    }
  } else {
    const nextFrame = `./${key}/${frame + 1}.png`;
    game.$[key].$image.src = nextFrame;

    game.$[key].$progress.firstChild.textContent = `${Math.floor(z)}m`;
    game.$[key].$progress.firstChild.style.transform = `translateX(-${
      (1 - ratio) * 100
    }%)`;
  }

  const cssZ = -TRACK_LENGTH + z;

  game.$[key].$image.style.transform = `translate3d(${x}px, 0, ${cssZ}px)`;
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

  // Move player
  const advanceBy = getAdvanceBy(key);
  game.$[key].z = Math.min(TRACK_LENGTH, game.$[key].z + advanceBy);

  const xNoise = -X_NOISE + Math.random() * X_NOISE * 2;
  game.$[key].x += xNoise;

  // Advance next frame of the GIF
  game.$[key].frame = (game.$[key].frame + 1) % config.$[key].maxFrames;

  if (game.$[key].z >= TRACK_LENGTH) {
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
  game.$[key].$progress.firstChild.textContent = "finished";
  $winner.textContent = `${key} won!`;
  $winner.style.color = config.$[key].color;
}

function declareLoser(key) {
  if (game.loser) return;

  game.loser = key;
  game.$[key].$progress.firstChild.textContent = "finished";
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
  TRACK_LENGTH = document.querySelector("#opt-track-length").value;
}

function main() {
  readOptions();
  prepareScene();
  renderingLoop();
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

document.querySelector("#opt-track-length").addEventListener("input", () => {
  readOptions();
  prepareSceneSetLines();
});

main();
