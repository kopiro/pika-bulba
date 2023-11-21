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
const $overlay = $("#overlay");

const game = {
  $: { rocks: [], bushes: [], players: {}, progress: {} },
};

// Static values from CSS
const kTrackWidth = getCSSVar("--track-width");
const kImgSize = getCSSVar("--img-size");
const kInfiniteTrackLength = getCSSVar("--infinite-track-length");
const kBushSize = getCSSVar("--bush-size");

// Static values
const kFPS = 60;
const framesPerSecond = 1000 / kFPS;
const kAutoMinAdvance = 1;
const kAutoMaxAdvance = 10;
const kXNoiseMax = 50;

const kCoopMul = 1;
const kCoopBoost = kCoopMul * kAutoMaxAdvance;
const kCoopDecay = kCoopMul * 0.05;
const kMaxCoopBost = 3;
const kCoopX = 2;

const kPlayerCollisionPushX = 35;
const kReachedPx = 0.5;

const kGoalZOffset = 100;
const kRockDensity = 20;
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
      lastZ: game.trackLength,
      playerPushX: null,
      nextX: null,
      jumpingT: null,
      wonT: null,
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
  [-kTrackWidth + kBushSize, kTrackWidth - kBushSize].forEach((_x) => {
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
  const maxX = kBushSize + kTrackWidth / 2 - kBushSize * 2;
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

function quantizeCoords({ x, y, z }, tresholds) {
  const c = {
    qx: Math.floor(x / tresholds.x),
    qy: Math.floor(y, tresholds.y),
    qz: Math.floor(z / tresholds.z),
  };
  return { ...c, key: `${c.qx}-${c.qy}-${c.qz}` };
}

const __rockCollisionCache = {};
function checkForRockCollision(p, tresholds) {
  const strThresholds = JSON.stringify(tresholds);

  __rockCollisionCache[strThresholds] =
    __rockCollisionCache[strThresholds] ||
    game.$.rocks.reduce((acc, rock) => {
      const { qx, qy, qz, key } = quantizeCoords(rock, tresholds);
      acc[key] = { qx, qy, qz };
      return acc;
    }, {});
  const pZPerspective = p.z - kImgSize;

  const { key: keyLeft } = quantizeCoords(
    { x: p.x - kImgSize / 2, y: p.y, z: pZPerspective },
    tresholds
  );
  const { key: keyCenter } = quantizeCoords(
    { x: p.x, y: p.y, z: pZPerspective },
    tresholds
  );
  const { key: keyRight } = quantizeCoords(
    { x: p.x + kImgSize / 2 - 1, y: p.y, z: pZPerspective },
    tresholds
  );
  const collided =
    keyLeft in __rockCollisionCache[strThresholds] ||
    keyRight in __rockCollisionCache[strThresholds] ||
    keyCenter in __rockCollisionCache[strThresholds];
  return collided;
}

function checkForPlayerCollision() {
  // Detect collision between game.$.players
  const kImgSizeBody = kImgSize / 2.5;
  const players = Object.values(game.$.players);
  for (const p of players) {
    for (const p2 of players) {
      if (p === p2) continue;
      if (
        p.x + kImgSizeBody >= p2.x - kImgSizeBody &&
        p.x - kImgSizeBody <= p2.x + kImgSizeBody &&
        p.y + kImgSizeBody >= p2.y - kImgSizeBody &&
        p.y - kImgSizeBody <= p2.y + kImgSizeBody &&
        p.z + kImgSizeBody >= p2.z - kImgSizeBody &&
        p.z - kImgSizeBody <= p2.z + kImgSizeBody
      ) {
        // Push the players away from each other in the X axis
        const direction = p.x < p2.x ? -1 : 1;
        p.playerPushX = {
          t: now,
          x: p.x + direction * kPlayerCollisionPushX,
        };
        p2.playerPushX = {
          t: now,
          x: p2.x + -1 * direction * kPlayerCollisionPushX,
        };

        // Show a quick red overlay
        $overlay.animate(
          [
            { background: "transparent" },
            { background: "rgba(255, 0, 0, 0.5)" },
            { background: "transparent" },
          ],
          {
            duration: 200,
            easing: "ease-in-out",
            fill: "forwards",
          }
        );

        return;
      }
    }
  }
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
  // if (game.winner !== p) {
  //   p.x = Math.min(
  //     kTrackWidth / 2 - kImgSize,
  //     Math.max(-(kTrackWidth / 2) + kImgSize, p.x)
  //   );
  // }
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

    if (p.playerPushX) {
      // Squeeze the player
      p.$.style.transform = `${p.$.style.transform} scaleX(0.85)`;
    }

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
    const delta = now - p.wonT;
    const { x, y } = flyEquation(delta / 1000);
    p.x += x;
    p.y = y;
    return;
  }

  if (game.loser === p) {
    return;
  }

  checkForPlayerCollision();

  if (p.playerPushX) {
    // Exponential movement towards playerPushX based on time
    const diff = p.playerPushX.x - p.x;
    const step = diff / 10;
    const delta = now - p.playerPushX.t;
    p.x = p.x + step * Math.pow(2, delta / 1000);
    if (Math.abs(diff) <= kReachedPx) {
      p.playerPushX = null;
      p.nextX = null;
    }
  } else if (p.nextX) {
    // Linear movement towards nextX based on time
    const diff = p.nextX.x - p.x;
    const step = diff / 10;
    const delta = now - p.nextX.t;
    p.x = p.x + (step * delta) / 1000;
    if (Math.abs(diff) <= kReachedPx) {
      p.nextX = null;
    }
  }

  // Check if player is jumping
  if (p.jumpingT) {
    const delta = now - p.jumpingT;
    const { z, y } = jumpEquation(delta / 1000);
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
      // Double the bush size to make it easier to jump
      const collision = checkForRockCollision(p, {
        x: kBushSize,
        y: 0,
        z: kBushSize,
      });
      if (collision) {
        p.jumpingT = now;
      }
    }

    // Add noise
    if (!p.nextX) {
      const xNoise = -kXNoiseMax + Math.random() * kXNoiseMax * 2;
      const nextX = p.x + xNoise;
      p.nextX = {
        t: now,
        x: Math.min(
          kTrackWidth / 2 - kImgSize,
          Math.max(-kTrackWidth / 2 + kImgSize, nextX)
        ),
      };
    }

    // Advance Z
    const advanceBy = getAdvanceBy(p.key);
    p.z = Math.max(0, p.z - advanceBy);
  } else if (game.mode === "coop") {
    p.coopValue = Math.max(0, p.coopValue - kCoopDecay);

    const collision = checkForRockCollision(p, {
      x: kBushSize,
      y: 0,
      z: kBushSize,
    });
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
    e.preventDefault();
    if (game.mode !== "coop") return;

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
          // case "back":
          //   p.z += 10;
          //   break;
        }
      });
    });
  });

  startRenderingLoop();
}

main();
