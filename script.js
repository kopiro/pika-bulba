const $winner = document.querySelector("#winner");
const $startButton = document.querySelector("#start-button");
const $scene = document.querySelector("#scene");
const $trackers = document.querySelector("#trackers");

const CUBE_SIZE = 300; // sync with CSS!!

const Z_START = -(CUBE_SIZE / 2);
const Z_END = CUBE_SIZE / 2;
const FPS = 1000 / 60;
const MAX_ADVANCE = 100;
const ROAD_METERS = 1000;
const X_NOISE = 1;

const GOAL = MAX_ADVANCE * 300;

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
    winner: null,
    loser: null,
    $: {},
  }
);

function renderPlayer(key) {
  // Limit the x position to the cube size
  game.$[key].x = Math.min(
    CUBE_SIZE / 2 - IMG_OFFSET,
    Math.max(-(CUBE_SIZE / 2) + IMG_OFFSET, game.$[key].x)
  );
  game.$[key].z = Math.max(0, Math.min(GOAL, game.$[key].z));

  const ratio = Math.min(1, game.$[key].z / GOAL);
  const z = Z_START + (Z_END - Z_START) * ratio;

  game.$[key].$image.src = `./${key}/${1 + game.$[key].frame}.png`;
  game.$[
    key
  ].$image.style.transform = `translate3d(${game.$[key].x}px, ${CUBE_SIZE}px, ${z}px)`;

  const meters = Math.floor(ROAD_METERS * ratio);
  game.$[key].$progress.firstChild.textContent = `${meters}m`;
  game.$[key].$progress.firstChild.style.transform = `translateX(-${
    (1 - ratio) * 100
  }%)`;
}

function advancePlayer(key) {
  requestAnimationFrame(() => {
    const advanceBy = Math.floor(Math.random() * MAX_ADVANCE);

    game.$[key].z = Math.min(GOAL, game.$[key].z + advanceBy);
    game.$[key].frame = (game.$[key].frame + 1) % config.$[key].maxFrames;

    // Apply a bit of noise to the x position
    game.$[key].x += -X_NOISE + Math.random() * X_NOISE * 2;

    renderPlayer(key);

    if (game.$[key].z === GOAL) {
      if (!game.winner) {
        declareWinner(key);
      } else {
        declareLoser(key);
      }
      return;
    }

    setTimeout(() => {
      advancePlayer(key);
    }, FPS);
  });
}

function declareWinner(key) {
  game.winner = key;
  game.$[key].$image.src = `./${key}/win.gif`;
  $winner.textContent = `${key} won!`;
  $winner.style.color = config.$[key].color;
}

function declareLoser(key) {
  game.loser = key;
  game.$[key].$image.src = `./${key}/lost.gif`;
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
  KEYS.forEach((key) => {
    advancePlayer(key);
  });
}

console.log("config :>> ", config);

Promise.all(KEYS.map((key) => preloadImages(key))).then(() => {
  KEYS.forEach((key) => {
    $scene.appendChild(game.$[key].$image);
    $trackers.appendChild(game.$[key].$progress);
    renderPlayer(key);
  });
  $startButton.classList.add("active");
});

$startButton.addEventListener("click", () => {
  $startButton.classList.remove("active");
  handleAccelerometer();
  startRace();
});
