const playerKeys = Object.keys(config.players);
const $ = document.querySelector.bind(document);

// DOM elements
const $winner = $("#winner");
const $startAutorace = $("#start-autorace");
const $startCoop = $("#start-coop");
const $scene = $("#scene");
const $trackers = $("#trackers");
const $resetButton = $("#reset-button");
const $start = $("#start");
const $overlay = $("#overlay");

// Static values from CSS so we can keep them in sync
const $css = getComputedStyle(document.documentElement);
const kTrackWidth = getCSSVar("--track-width");
const kImgSize = getCSSVar("--img-size");
const kInfiniteTrackLength = getCSSVar("--infinite-track-length");
const kBushSize = getCSSVar("--bush-size");

// Main game object
const game = {
  $: { rocks: [], bushes: [], players: {}, progress: {} },
};

// Constants

// Fixed FPS to prevent the game from running too fast
const kFPS = 60;
// Frames per second we want to render
const framesPerSecond = 1000 / kFPS;
// PX per frame we want to advance when game is running in auto mode, minimum and maximum
const kAutoMinAdvance = 0.5;
const kAutoMaxAdvance = 8;
// Overshoot for the player to move along the X axis when game is running in auto mode
const kXNoiseMax = 100;
// PX per frame to apply to the player is falling
const kGravity = (30 * 9.81) / kFPS;

// PX per frame we want to advance when game is running in coop mode
const kCoopBoost = kAutoMaxAdvance;
// PX decay to remove every frame to slow down the player in coop mode
const kCoopDecay = 0.05;
// Maximum value for the boost even if key is pressed very fast
const kMaxCoopBost = 3;
// PX to move the player in the X axis when game is running in coop mode
const kCoopX = 3;

// PX to push the player in the X axis when colliding with another player
const kPlayerCollisionPushX = 60;

// Epsilon to consider the player has reached the target X
const kReachedPx = 0.1;

// Offset to consider for the final flag
const kGoalZOffset = 100;

// Density of bushes and rocks
const kRockDensity = 20;
const kBushDensity = 30;

// Camera distance from player
const kCameraZOffset = 600;
// Maximum value for the camera Z, to make sure we stop when goal is reached
const kMaxCameraZ = -480;
// Camera X and Y offsets
const kCameraX = kTrackWidth / 4;
const kCameraY = 400;

// If player is losing for this T, they will advance faster
const kLosingTimeout = 2000;

// Track width half
const kTrackWidthHalf = kTrackWidth / 2;

/**
 * Read dynamic options and loads the game object
 */
function loadGame() {
  game.started = false;
  game.mode = null;
  game.winner = null;
  game.loser = null;
  game.trackLength = $("#opt-track-length").value;

  game.$.players = playerKeys.reduce((acc, key) => {
    const z = game.trackLength - (config.players[key].zOffset || 0);
    acc[key] = {
      ...acc[key],
      key: key,
      config: config.players[key],
      x: config.players[key].xOffset,
      y: 0,
      z: z,
      frame: 0,
      coopValue: 0,
      next: null,
      jumpingT: null,
      wonT: null,
      fell: false,
    };
    return acc;
  }, game.$.players || {});
}

/**
 * Returns a random number between kAutoMinAdvance and kAutoMaxAdvance
 * to be used as the advance for the player in auto mode
 */
function getAdvanceBy(p) {
  // Compare p to second player
  const otherPlayer = playerKeys.find((key) => key !== p.key);
  const diff = Math.abs(p.z - game.$.players[otherPlayer].z);

  if (p.z > game.$.players[otherPlayer].z) {
    p.losingSince = p.losingSince || now;
  } else {
    p.losingSince = null;
  }

  if (p.losingSince && now - p.losingSince > kLosingTimeout) {
    return kAutoMaxAdvance;
  }

  return (
    kAutoMinAdvance +
    Math.floor(Math.random() * (kAutoMaxAdvance - kAutoMinAdvance))
  );
}

/**
 * Add the bushes to the scene
 */
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

/**
 * Add the rocks to the scene
 */
function prepareSceneAddRocks() {
  // Put the bushes in the scene
  const maxX = kTrackWidthHalf - kBushSize * 2;
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

/**
 * Quantize the coordinates of the player to the given tresholds
 */
function quantizeCoords({ x, y, z }, tresholds) {
  const c = {
    qx: Math.floor(x / tresholds.x),
    qy: Math.floor(y / tresholds.y),
    qz: Math.floor(z / tresholds.z),
  };
  return { ...c, key: `${c.qx}-${c.qy}-${c.qz}` };
}

const __rockCollisionCache = {};

/**
 * Check if the player is colliding with a rock
 */
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

/**
 * Check if the player is colliding with another player
 * and push them away from each other
 */
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
        p.next = {
          t: now,
          x: p.x + direction * kPlayerCollisionPushX,
          easing: (t) => Math.pow(2, t),
          reason: "player-collision",
        };
        p2.next = {
          t: now,
          x: p2.x + -1 * direction * kPlayerCollisionPushX,
          easing: (t) => Math.pow(2, t),
          reason: "player-collision",
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

function prepareSceneAddPlayers() {
  playerKeys.forEach((key) => {
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

/**
 * Prepare the scene and add game objects to it
 * This should be called only once
 */
async function prepareScene() {
  prepareSceneAddBushes();
  prepareSceneAddRocks();
  prepareSceneAddPlayers();
}

/**
 * Clamp the player coordinates to the track
 */
function clampPlayer(p) {
  // if (game.winner !== p) {
  //   p.x = Math.min(
  //     kTrackWidthHalf - kImgSize,
  //     Math.max(-(kTrackWidthHalf) + kImgSize, p.x)
  //   );
  // }
  // p.y = Math.max(0, p.y);
  // p.z = Math.max(0, p.z);
}

/**
 * Apply the coordinates to a game object by changing the CSS transform
 */
function applyCoordinates(p) {
  const cssX = p.x;
  const cssY = -p.y;
  const cssZ = -p.z;
  p.$.style.transform = `translate3d(${cssX}px, ${cssY}px, ${cssZ}px)`;
}

/**
 * Move the camera to the given Z
 */
function renderCamera() {
  // Find the player with the lowest Z
  const lowestZ = playerKeys.reduce((acc, key) => {
    return Math.min(acc, game.$.players[key].z);
  }, kInfiniteTrackLength);
  const realZ = Math.max(lowestZ - kCameraZOffset, kMaxCameraZ);
  $scene.style.transform = `translate3d(${kCameraX}px, ${kCameraY}px, ${realZ}px)`;
}

/**
 * Apply the given src to a game object
 */
function applySrc(obj, src) {
  if (obj.src !== src) {
    obj.src = src;
    obj.$.src = obj.src;
  }
}

/**
 * Render the player game object
 */
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

    if (p.next && p.next.reason === "player-collision") {
      // Squeeze the player
      p.$.style.transform = `${p.$.style.transform} scaleX(0.85)`;
    }

    game.$.progress[p.key].firstChild.textContent = `${Math.floor(
      ratio * game.trackLength
    )}m`;
  }

  if (p.fell) {
    game.$.progress[p.key].firstChild.textContent = "out of track";
  } else {
    game.$.progress[p.key].firstChild.style.transform = `translateX(-${
      (1 - ratio) * 100
    }%)`;
  }
}

function renderObjects() {
  $start.style.transform = `translate3d(-50%, -100%, ${
    -1 * game.trackLength
  }px)`;
}

let then = null;
let now = null;
let deltaTime = null;
let frameCount = 1;

/**
 * Main rendering loop capped to kFPS
 */
function startRenderingLoop() {
  requestAnimationFrame(startRenderingLoop);

  now = Date.now();
  deltaTime = now - then;

  if (deltaTime <= framesPerSecond) return;
  then = now - (deltaTime % framesPerSecond);
  frameCount++;

  // Move objects
  if (game.started) {
    playerKeys.forEach((key) => {
      movePlayer(game.$.players[key]);
    });
  }

  // Render objects
  renderObjects();
  renderCamera();
  playerKeys.forEach((key) => {
    renderPlayer(game.$.players[key]);
  });
}

/**
 * Equation to move the player when they win
 */
function flyEquation(t) {
  return {
    x: -1 * t,
    y: 130 * t + 5 * Math.sin(20 * t),
  };
}

/**
 * Equation to move the player when they jump
 */
function jumpEquation(t) {
  return {
    z: 0,
    y: 50 * Math.sin(6 * t),
  };
}

/**
 * Check if the player is out of the track and mark them as fell
 */
function checkForPlayerOutOfTrack(p) {
  if (!p.fell && (p.x < -kTrackWidthHalf || p.x > kTrackWidthHalf)) {
    p.fell = true;
    p.next = {
      y: -999,
      t: now,
      reason: "fell",
    };
  }
}

function maybeMovePlayerToNext(p) {
  if (!p.next) return;

  const delta = now - p.next.t;
  let reached = true;

  // Movement towards next based on time
  ["x", "y", "z"].forEach((axis) => {
    if (!p.next[axis]) return;

    const diff = p.next[axis] - p[axis];
    const step = diff / 10;
    p[axis] =
      p[axis] +
      step * (p.next.easing ? p.next.easing(delta / 1000) : delta / 1000);

    if (Math.abs(diff) >= kReachedPx) {
      reached = false;
    }
  });

  if (reached) {
    p.next = null;
  }
}

/**
 * Move the player
 */
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
  checkForPlayerOutOfTrack(p);
  maybeMovePlayerToNext(p);

  if (p.fell) {
    return;
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

    // Add noise if we don't already have a target for X
    if (!p.next) {
      const xNoise = -kXNoiseMax + Math.random() * kXNoiseMax * 2;
      const next = p.x + xNoise;
      p.next = {
        t: now,
        x: Math.min(
          kTrackWidthHalf - kImgSize,
          Math.max(-kTrackWidthHalf + kImgSize, next)
        ),
      };
    }

    // Advance Z
    const advanceBy = getAdvanceBy(p);
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

/**
 * Declare the given player as the winner
 */
function declareWinner(p) {
  if (game.winner) return;

  game.winner = p;
  p.wonT = now;

  game.$.progress[p.key].firstChild.textContent = "finished";
  $winner.textContent = `${p.key} won!`;
  $winner.style.color = p.config.color;

  endGame();
}

/**
 * Declare the given player as the loser
 */
function declareLoser(p) {
  if (game.loser) return;

  game.loser = p;
  game.$.progress[p.key].firstChild.textContent = "finished";
}

/**
 * Returns the value of a CSS variable converted to a number
 */
function getCSSVar(key) {
  return Number($css.getPropertyValue(key).replace("px", ""));
}

/**
 * Preload the images for the given player
 */
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

/**
 * Start the game
 */
function startGame() {
  if (game.started) return;
  document.body.classList.add("game-started");
  game.started = true;

  $("#music-bg").currentTime = 0;
  $("#music-bg").play();
}

/**
 * End the game
 */
function endGame() {
  if (!game.started) return;
  document.body.classList.add("game-ended");

  $("#music-bg").pause();

  $("#music-end").currentTime = 0;
  $("#music-end").play();
}

/**
 * Preload the images for all players
 */
function preloadResources() {
  return Promise.all(playerKeys.map((key) => preloadImages(key)));
}

/**
 * Main function, it will load the game and start the rendering loop
 * and add event listeners to the DOM
 */
function main() {
  loadGame();
  prepareScene();

  $startAutorace.addEventListener("click", () => {
    game.mode = "auto";
    startGame();
  });

  $startCoop.addEventListener("click", () => {
    game.mode = "coop";
    startGame();
  });

  $resetButton.addEventListener("click", () => {
    $("#music-end").pause();
    $("#music-bg").pause();
    document.body.classList.remove("game-ended");
    document.body.classList.remove("game-started");
    loadGame();
  });

  $("#opt-track-length").addEventListener("input", () => {
    loadGame();
  });

  window.addEventListener("keyup", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (game.mode === "coop") {
      playerKeys.forEach((key) => {
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
    }
  });

  startRenderingLoop();

  preloadResources().then(() => {
    document.body.classList.add("game-ready");
  });
}

main();
