(() => {
  const game = document.querySelector("[data-game]");
  const canvas = game.querySelector("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;

  const nameplate = document.querySelector(".nameplate");
  const launch = document.querySelector("[data-game-launch]");
  const exit = game.querySelector("[data-game-exit]");
  const clock = game.querySelector("[data-game-time]");
  const status = game.querySelector("[data-game-status]");
  const ballSpeed = 300;
  const pressed = new Set();
  const paddle = { x: 0, y: 0, width: 78, height: 6 };
  const ball = { x: 0, y: 0, radius: 5, vx: 0, vy: 0 };

  let width, height, origin, startedAt, lastFrame, frameId;
  let targets = [];
  const damaged = new Set();
  let playing = false;
  let pointer;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function textTargets() {
    const result = [];
    const selector = ".wire-caption, h1, [data-role-text], .intro span, .socials a > span:not(.social-icon)";
    const range = document.createRange();
    for (const element of nameplate.querySelectorAll(selector)) {
      const node = element.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      const health = element.matches("h1") ? 2 : 1;
      let offset = 0;
      for (const character of node.data) {
        const start = offset;
        offset += character.length;
        if (!character.trim()) continue;
        range.setStart(node, start);
        range.setEnd(node, offset);
        const { x, y, width, height } = range.getBoundingClientRect();
        if (width && height) result.push({ x, y, width, height, health });
      }
    }
    for (const icon of nameplate.querySelectorAll(".social-icon svg")) {
      const { x, y, width, height } = icon.getBoundingClientRect();
      result.push({ x, y, width, height, health: 2 });
    }
    return result;
  }

  function wireTargets() {
    const result = [];
    for (const path of nameplate.querySelectorAll(".wire path")) {
      const matrix = path.getScreenCTM();
      const scale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
      const length = path.getTotalLength();
      const step = 10 / scale;
      let previous = path.getPointAtLength(0).matrixTransform(matrix);
      for (let distance = step; distance < length + step; distance += step) {
        const point = path.getPointAtLength(Math.min(distance, length)).matrixTransform(matrix);
        const size = Math.hypot(point.x - previous.x, point.y - previous.y);
        // Do not create a target across a jump to another SVG subpath.
        if (size > 0 && size <= 11) result.push({ wire: true, from: previous, to: point, health: 1 });
        previous = point;
      }
    }
    return result;
  }

  function paintDamage() {
    const marks = Array.from(damaged, (target) => {
      if (target.wire) {
        const { from, to } = target;
        return `<path d="M${from.x - origin.x} ${from.y - origin.y}L${to.x - origin.x} ${to.y - origin.y}" stroke="black" stroke-width="3"/>`;
      }
      const shade = target.health ? "#b3b3b3" : "black";
      return `<rect x="${target.x - origin.x}" y="${target.y - origin.y}" width="${target.width}" height="${target.height}" fill="${shade}"/>`;
    }).join("");
    const mask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${origin.width} ${origin.height}"><rect width="100%" height="100%" fill="white"/>${marks}</svg>`;
    nameplate.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(mask)}")`;
    nameplate.style.maskSize = "100% 100%";
    nameplate.style.maskMode = "luminance";
  }

  function restoreNameplate() {
    nameplate.style.removeProperty("mask-image");
    nameplate.style.removeProperty("mask-size");
    nameplate.style.removeProperty("mask-mode");
    damaged.clear();
  }

  function movePaddle(center) {
    paddle.x = clamp(center - paddle.width / 2, 0, width - paddle.width);
  }

  function dockBall() {
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 1;
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#293b47";
    context.beginPath();
    context.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 3);
    context.fill();
    context.fillStyle = "#376772";
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();
  }

  function nearestPoint(target) {
    if (!target.wire) {
      return {
        x: clamp(ball.x, target.x, target.x + target.width),
        y: clamp(ball.y, target.y, target.y + target.height),
      };
    }
    const { from, to } = target;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const t = clamp(((ball.x - from.x) * dx + (ball.y - from.y) * dy) / (dx * dx + dy * dy), 0, 1);
    return { x: from.x + t * dx, y: from.y + t * dy };
  }

  function advance(dt) {
    const oldY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < ball.radius || ball.x > width - ball.radius) {
      ball.x = clamp(ball.x, ball.radius, width - ball.radius);
      ball.vx *= -1;
    }
    if (ball.y < ball.radius) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    const atPaddle = oldY + ball.radius <= paddle.y && ball.y + ball.radius >= paddle.y;
    if (ball.vy > 0 && atPaddle && ball.x + ball.radius >= paddle.x &&
        ball.x - ball.radius <= paddle.x + paddle.width) {
      const offset = clamp((ball.x - paddle.x) / paddle.width * 2 - 1, -1, 1);
      const angle = offset * 0.98;
      ball.y = paddle.y - ball.radius;
      ball.vx = Math.sin(angle) * ballSpeed;
      ball.vy = -Math.cos(angle) * ballSpeed;
    }

    for (const target of targets) {
      if (target.health === 0) continue;
      const point = nearestPoint(target);
      const dx = ball.x - point.x;
      const dy = ball.y - point.y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0 || distance > ball.radius) continue;
      const nx = dx / distance;
      const ny = dy / distance;
      const approach = ball.vx * nx + ball.vy * ny;
      if (approach >= 0) continue;

      // Separate the ball from this surface before the next physics step.
      ball.x = point.x + nx * (ball.radius + 0.05);
      ball.y = point.y + ny * (ball.radius + 0.05);
      ball.vx -= 2 * approach * nx;
      ball.vy -= 2 * approach * ny;
      target.health--;
      damaged.add(target);
      return true;
    }
    return false;
  }

  function waitForServe() {
    playing = false;
    game.dataset.phase = "ready";
    status.textContent = game.dataset.ready;
    dockBall();
  }

  function serve() {
    dockBall();
    const aim = targets.filter((target) => !target.wire && target.health > 0 &&
      target.y < ball.y && Math.abs(target.x + target.width / 2 - ball.x) < 32)
      .sort((a, b) => b.y - a.y)[0];
    const angle = aim
      ? Math.atan2(aim.x + aim.width / 2 - ball.x, ball.y - aim.y)
      : (ball.x > width / 2 ? -0.32 : 0.32);
    ball.vx = Math.sin(angle) * ballSpeed;
    ball.vy = -Math.cos(angle) * ballSpeed;
    startedAt ??= performance.now();
    playing = true;
    game.dataset.phase = "playing";
    status.textContent = game.dataset.playing;
  }

  function tick(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.032);
    lastFrame = now;
    const direction = Number(pressed.has("ArrowRight")) - Number(pressed.has("ArrowLeft"));
    if (direction) movePaddle(paddle.x + paddle.width / 2 + direction * 470 * dt);

    if (playing) {
      let hit = false;
      const steps = Math.max(1, Math.ceil(dt * 240));
      for (let i = 0; i < steps; i++) {
        if (advance(dt / steps)) hit = true;
      }
      if (hit) paintDamage();
      if (hit && targets.every((target) => target.health === 0)) {
        playing = false;
        game.dataset.phase = "complete";
        status.textContent = game.dataset.won;
      } else if (ball.y - ball.radius > height) {
        waitForServe();
      }
    } else {
      dockBall();
    }
    draw();

    if (startedAt !== undefined) {
      const centiseconds = Math.floor(Math.max(0, now - startedAt) / 10);
      const fields = [Math.floor(centiseconds / 6000), Math.floor(centiseconds / 100) % 60, centiseconds % 100];
      clock.textContent = fields.map((field) => String(field).padStart(2, "0")).join(":");
    }

    if (game.dataset.phase !== "complete") frameId = requestAnimationFrame(tick);
  }

  function openGame() {
    cancelAnimationFrame(frameId);
    restoreNameplate();
    pressed.clear();
    pointer = undefined;
    document.body.classList.add("game-active");
    document.dispatchEvent(new Event("inlinegamechange"));
    game.hidden = false;

    const view = canvas.getBoundingClientRect();
    width = view.width;
    height = view.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    origin = nameplate.getBoundingClientRect();
    targets = [...wireTargets(), ...textTargets()];
    const footerButton = launch.getBoundingClientRect();
    paddle.y = clamp(footerButton.top + footerButton.height / 2 + 3, height - 72, height - 28);
    movePaddle(width / 2);
    waitForServe();
    clock.textContent = "00:00:00";
    canvas.focus({ preventScroll: true });
    startedAt = undefined;
    lastFrame = performance.now();
    draw();
    frameId = requestAnimationFrame(tick);
  }

  function stop(returnFocus = false) {
    if (game.hidden) return;
    cancelAnimationFrame(frameId);
    playing = false;
    pressed.clear();
    pointer = undefined;
    game.hidden = true;
    restoreNameplate();
    document.body.classList.remove("game-active");
    document.dispatchEvent(new Event("inlinegamechange"));
    if (returnFocus) launch.focus({ preventScroll: true });
  }

  function startGesture(event) {
    if (event.button !== 0 || !event.isPrimary || pointer || game.dataset.phase === "complete") return;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ready: game.dataset.phase === "ready",
      dragged: false,
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function moveGesture(event) {
    if (pointer?.id !== event.pointerId) {
      if (playing && event.pointerType === "mouse" && !pointer) movePaddle(event.clientX);
      return;
    }
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.dragged = true;
    if (pointer.dragged) movePaddle(event.clientX);
  }

  launch.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary || !game.hidden) return;
    openGame();
    startGesture(event);
  });
  launch.addEventListener("click", (event) => {
    // Keyboard and assistive activation do not generate pointer events.
    if (event.detail === 0 && game.hidden) {
      openGame();
      serve();
    }
  });
  exit.addEventListener("click", () => stop(true));
  canvas.addEventListener("pointermove", moveGesture);
  canvas.addEventListener("pointerdown", startGesture);
  canvas.addEventListener("pointerup", (event) => {
    if (pointer?.id !== event.pointerId) return;
    moveGesture(event);
    if (pointer.ready && !pointer.dragged && game.dataset.phase === "ready") serve();
    pointer = undefined;
  });
  function clearGesture(event) {
    if (pointer?.id === event.pointerId) pointer = undefined;
  }
  canvas.addEventListener("pointercancel", clearGesture);
  canvas.addEventListener("lostpointercapture", clearGesture);
  document.addEventListener("keydown", (event) => {
    if (game.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      stop(true);
    } else if (game.dataset.phase !== "complete" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      pressed.add(event.key);
    } else if (event.target === canvas && game.dataset.phase === "ready" &&
               (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      if (!event.repeat) serve();
    }
  });
  document.addEventListener("keyup", (event) => pressed.delete(event.key));
  window.addEventListener("blur", () => pressed.clear());
  window.addEventListener("resize", () => stop());
  window.addEventListener("scroll", () => stop(), { passive: true });

  launch.hidden = false;
})();
