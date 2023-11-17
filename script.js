const $winner = document.querySelector("#winner");
const $startButton = document.querySelector("#start-button");

const CUBE_SIZE = 300; // sync with CSS!!

const Z_START = -(CUBE_SIZE / 2);
const Z_END = CUBE_SIZE / 2;
const IMG_OFFSET = 30;
const FPS = 1000 / 60;
const MAX_ADVANCE = 250;

const GOAL = MAX_ADVANCE * 500;

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

const $position = {
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
  const ratio = Math.min(1, $position[selector] / GOAL);
  const z = Z_START + (Z_END - Z_START) * ratio;
  $images[selector].src = `./${selector}/${1 + $frames[selector]}.png`;
  $images[
    selector
  ].style.transform = `translate3d(${$xOffsets[selector]}px, ${CUBE_SIZE}px, ${z}px)`;
  $progress[selector].style.transform = `translateX(-${(1 - ratio) * 100}%)`;
}

function makeItRun(selector) {
  requestAnimationFrame(() => {
    const advanceBy = Math.floor(Math.random() * MAX_ADVANCE);
    $position[selector] = Math.min(GOAL, $position[selector] + advanceBy);
    $frames[selector] = ($frames[selector] + 1) % $maxFrames[selector];

    positionImage(selector);

    if ($position[selector] === GOAL) {
      $images[selector].src = `./${selector}/win.gif`;

      if (!winner) {
        declareWinner(selector);
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
  $winner.textContent = `${selector} won!`;
  $winner.classList.add(`${selector}-color`);
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
  KEYS.forEach((key) => {
    makeItRun(key);
  });
});
