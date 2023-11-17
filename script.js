const $winner = document.querySelector("#winner");
const $startButton = document.querySelector("#start-button");

const CUBE_SIZE = 300; // sync with CSS!!

const Z_START = -(CUBE_SIZE / 2);
const Z_END = CUBE_SIZE / 2;
const IMG_OFFSET = 30;
const FPS = 1000 / 60;
const MAX_ADVANCE = 100;
const ROAD_METERS = 1000;
const X_NOISE = 1.5;

const GOAL = MAX_ADVANCE * 300;

const $frames = {
  pikacute: 0,
  bulbasuck: 0,
};

const $maxFrames = {
  pikacute: 10,
  bulbasuck: 23,
};

const $xOffsets = {
  pikacute: -IMG_OFFSET,
  bulbasuck: IMG_OFFSET,
};

const zPosition = {
  pikacute: 0,
  bulbasuck: 0,
};

const xPosition = {
  pikacute: 0,
  bulbasuck: 0,
};

const $images = {
  pikacute: document.querySelector("#pikacute-img"),
  bulbasuck: document.querySelector("#bulbasuck-img"),
};

const $progress = {
  pikacute: document.querySelector("#pikacute-tracker .subtracker"),
  bulbasuck: document.querySelector("#bulbasuck-tracker .subtracker"),
};

let winner = null;

function positionImage(selector) {
  const ratio = Math.min(1, zPosition[selector] / GOAL);
  const z = Z_START + (Z_END - Z_START) * ratio;

  $images[selector].src = `./${selector}/${1 + $frames[selector]}.png`;
  $images[selector].style.transform = `translate3d(${
    xPosition[selector] + $xOffsets[selector]
  }px, ${CUBE_SIZE}px, ${z}px)`;

  const meters = Math.floor(ROAD_METERS * ratio);
  $progress[selector].textContent = `${meters}m`;
  $progress[selector].style.transform = `translateX(-${(1 - ratio) * 100}%)`;
}

function makeItRun(selector) {
  requestAnimationFrame(() => {
    const advanceBy = Math.floor(Math.random() * MAX_ADVANCE);

    zPosition[selector] = Math.min(GOAL, zPosition[selector] + advanceBy);
    $frames[selector] = ($frames[selector] + 1) % $maxFrames[selector];

    // Apply a bit of noise to the x position
    xPosition[selector] += -X_NOISE + Math.random() * X_NOISE * 2;

    positionImage(selector);

    if (zPosition[selector] === GOAL) {
      if (!winner) {
        declareWinner(selector);
      } else {
        declareLoser(selector);
      }
      return;
    }

    setTimeout(() => {
      makeItRun(selector);
    }, FPS);
  });
}

function declareWinner(selector) {
  winner = selector;
  $images[selector].src = `./${selector}/win.gif`;
  $winner.textContent = `${selector} won!`;
  $winner.classList.add(`${selector}-color`);
}

function declareLoser(selector) {
  $images[selector].src = `./${selector}/lost.gif`;
}

function preloadImages(selector) {
  return new Promise((resolve) => {
    let loaded = 0;
    for (let i = 1; i <= $maxFrames[selector]; i++) {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === $maxFrames[selector]) {
          resolve();
        }
      };
      img.src = `./${selector}/${i}.png`;
    }
  });
}

const KEYS = ["pikacute", "bulbasuck"];

window.addEventListener("load", () => {
  Promise.all(KEYS.map((key) => preloadImages(key))).then(() => {
    KEYS.forEach((key) => {
      positionImage(key);
    });
    $startButton.classList.add("active");
  });
});

$startButton.addEventListener("click", () => {
  $startButton.classList.remove("active");

  KEYS.forEach((key) => {
    makeItRun(key);
  });
});
