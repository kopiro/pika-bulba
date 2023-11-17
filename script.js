const GOAL = 500;
const $winner = document.querySelector("#winner");

const $frames = {
  pikacute: 0,
  bulbasuck: 0,
};

const $selectors = {
  pikacute: document.querySelector("#pikacute"),
  bulbasuck: document.querySelector("#bulbasuck"),
};

const $track = {
  pikacute: 0,
  bulbasuck: 0,
};

const $trackers = {
  pikacute: document.querySelector("#pikacute-tracker > span"),
  bulbasuck: document.querySelector("#bulbasuck-tracker > span"),
};

let winner = null;

function makeItRun(selector) {
  requestAnimationFrame(() => {
    $track[selector]++;
    $frames[selector] = ($frames[selector] + 1) % 10;
    $selectors[selector].src = `/${selector}/${$frames[selector]}.gif`;

    const percent = Math.min(100, ($track[selector] / GOAL) * 100);
    $trackers[selector].style.transform = `translateX(-${100 - percent}%)`;

    if (percent >= 100) {
      $selectors[selector].src = `/${selector}/0.gif`;

      if (!winner) {
        winner = selector;
        $winner.textContent = `${selector} won!`;
        $winner.classList.add(`${selector}-color`);
      }
      return;
    }

    setTimeout(() => {
      makeItRun(selector);
    }, 10 + Math.random() * 20);
  });
}

makeItRun("pikacute");
makeItRun("bulbasuck");
