const $winner = document.querySelector("#winner");

const CUBE_SIZE = 300; // sync with CSS!!

const Z_START = -(CUBE_SIZE / 2);
const Z_END = CUBE_SIZE / 2;
const IMG_OFFSET = 30;
const FPS = 10;
const MAX_ADVANCE = 100;

const GOAL = MAX_ADVANCE * 500;

const $frames = {
  pikacute: 0,
  bulbasuck: 0,
};

const $xOffsets = {
  pikacute: -IMG_OFFSET,
  bulbasuck: IMG_OFFSET,
};

const $images = {
  pikacute: document.querySelector("#pikacute-img"),
  bulbasuck: document.querySelector("#bulbasuck-img"),
};

const $position = {
  pikacute: 0,
  bulbasuck: 0,
};

const $progress = {
  pikacute: document.querySelector("#pikacute-tracker .subtracker"),
  bulbasuck: document.querySelector("#bulbasuck-tracker .subtracker"),
};

let winner = null;

function makeItRun(selector) {
  requestAnimationFrame(() => {
    const advanceBy = Math.floor(Math.random() * MAX_ADVANCE);
    $position[selector] = Math.min(GOAL, $position[selector] + advanceBy);

    $frames[selector] = ($frames[selector] + 1) % 10;
    $images[selector].src = `./${selector}/${$frames[selector]}.gif`;

    const ratio = Math.min(1, $position[selector] / GOAL);
    $progress[selector].style.transform = `translateX(-${(1 - ratio) * 100}%)`;

    const z = Z_START + (Z_END - Z_START) * ratio;
    $images[selector].style.transform = `translate3d(${
      CUBE_SIZE / 2 + $xOffsets[selector]
    }px, ${CUBE_SIZE}px, ${z}px)`;

    if ($position[selector] >= GOAL) {
      $position[selector] = GOAL;
      $images[selector].src = `./${selector}/win.gif`;

      if (!winner) {
        winner = selector;
        $winner.textContent = `${selector} won!`;
        $winner.classList.add(`${selector}-color`);
      }
      return;
    }

    setTimeout(() => {
      makeItRun(selector);
    }, FPS);
  });
}

function preload(selector) {
  for (let i = 0; i < 10; i++) {
    const img = new Image();
    img.src = `./${selector}/${i}.gif`;
  }
}

preload("pikacute");
preload("bulbasuck");

window.addEventListener("load", () => {
  makeItRun("pikacute");
  makeItRun("bulbasuck");
});
