(() => {
  const root = document.documentElement;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches || !CSS.supports("clip-path", 'path("M0 0H1V1Z")')) return;

  const svgNamespace = "http://www.w3.org/2000/svg";
  const ripple = new URLSearchParams(location.search).get("entrance") === "b";
  const outlineDuration = 1050;
  const revealDuration = ripple ? 700 : 850;
  const waveDuration = ripple ? 560 : 0;
  let frameId;
  let cleanUp = () => {};

  root.classList.add("entrance-pending");
  const fallback = setTimeout(finish, 4000);
  document.addEventListener("keydown", finish);
  window.addEventListener("resize", finish);
  motion.addEventListener("change", finish);

  function finish() {
    if (!root.matches(".entrance-pending, .entrance-active")) return;
    clearTimeout(fallback);
    cancelAnimationFrame(frameId);
    cleanUp();
    root.classList.remove("entrance-pending", "entrance-active");
    document.removeEventListener("keydown", finish);
    window.removeEventListener("resize", finish);
    motion.removeEventListener("change", finish);
    document.dispatchEvent(new Event("siteentranceend"));
  }

  function readingOrder(tiles) {
    const rows = [];
    for (const tile of tiles.sort((a, b) => a.y - b.y)) {
      const row = rows.at(-1);
      if (!row || tile.y - row[0].y > 8) rows.push([tile]);
      else row.push(tile);
    }
    return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
  }

  function collectTiles(elements) {
    const tiles = [];
    const range = document.createRange();
    for (const element of elements) {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const group = { element, paths: [], remaining: 0 };
      const addTile = (rect) => {
        if (!rect.width || !rect.height) return;
        const x = rect.left - box.left;
        const y = rect.top - box.top - 1;
        const height = rect.height + 2;
        tiles.push({
          group,
          x: rect.left,
          y: rect.top + rect.height / 2,
          path: `M${x} ${y}h${rect.width}v${height}h${-rect.width}Z`,
        });
        group.remaining++;
      };

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        let offset = 0;
        for (const character of node.data) {
          const start = offset;
          offset += character.length;
          if (!character.trim()) continue;
          range.setStart(node, start);
          range.setEnd(node, offset);
          addTile(range.getBoundingClientRect());
        }
      }
      if (!group.remaining) addTile(box);
      element.style.clipPath = "inset(0 100% 0 0)";
    }
    return readingOrder(tiles);
  }

  function start() {
    if (!root.classList.contains("entrance-pending")) return;
    const wire = document.querySelector(".wire");
    const paths = Array.from(wire.children).filter((element) => element.matches("path"));
    const launchDot = document.querySelector("[data-game-launch] circle");
    const inner = ".wire-caption, .nameplate h1, .role-display, .role-toggle, .intro span, .socials a > span";
    const outer = ".wordmark, .site-nav a, .language > *, .home-footer > span";
    const elements = document.querySelectorAll(ripple ? inner : `${inner}, ${outer}`);
    const bands = ripple ? Array.from(document.querySelectorAll(".site-header, .home-footer"), (element) => {
      const box = element.getBoundingClientRect();
      return { element, radiusX: box.width / 2, radiusY: box.height * 1.5 };
    }) : [];
    const mask = document.createElementNS(svgNamespace, "mask");
    const trace = document.createElementNS(svgNamespace, "path");
    const ball = document.createElement("span");

    cleanUp = () => {
      for (const element of elements) element.style.removeProperty("clip-path");
      for (const { element } of bands) element.style.removeProperty("mask-image");
      for (const path of paths) path.removeAttribute("mask");
      mask.remove();
      ball.remove();
    };

    mask.id = "entrance-wire-mask";
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    mask.setAttribute("x", "0");
    mask.setAttribute("y", "0");
    mask.setAttribute("width", "660");
    mask.setAttribute("height", "460");
    trace.setAttribute("d", wire.dataset.trace);
    trace.setAttribute("fill", "none");
    trace.setAttribute("stroke", "white");
    trace.setAttribute("stroke-width", "9");
    trace.setAttribute("stroke-linecap", "round");
    trace.setAttribute("stroke-linejoin", "round");
    mask.append(trace);
    wire.append(mask);

    const length = trace.getTotalLength();
    trace.setAttribute("stroke-dasharray", `${length} ${length}`);
    trace.setAttribute("stroke-dashoffset", String(length));
    for (const path of paths) path.setAttribute("mask", "url(#entrance-wire-mask)");

    const tiles = collectTiles(elements);
    for (const { element } of bands) element.style.maskImage = "linear-gradient(transparent, transparent)";
    const matrix = wire.getScreenCTM();
    const last = trace.getPointAtLength(length).matrixTransform(matrix);
    const dot = launchDot.getBoundingClientRect();
    const landing = { x: dot.left + dot.width / 2, y: dot.top + dot.height / 2 };
    let shown = 0;
    let startedAt;
    ball.className = "entrance-ball";
    ball.setAttribute("aria-hidden", "true");
    document.body.append(ball);
    root.classList.replace("entrance-pending", "entrance-active");

    function tick(now) {
      startedAt ??= now;
      const elapsed = now - startedAt;
      let x, y;
      if (elapsed < outlineDuration) {
        const distance = length * elapsed / outlineDuration;
        trace.setAttribute("stroke-dashoffset", String(length - distance));
        ({ x, y } = trace.getPointAtLength(distance).matrixTransform(matrix));
      } else {
        if (mask.isConnected) {
          for (const path of paths) path.removeAttribute("mask");
          mask.remove();
        }
        const sinceOutline = elapsed - outlineDuration;
        const reveal = Math.min(1, sinceOutline / revealDuration);
        const count = Math.floor(reveal * tiles.length);
        while (shown < count) {
          const { group, path } = tiles[shown++];
          group.paths.push(path);
          group.remaining--;
          if (group.remaining) group.element.style.clipPath = `path("${group.paths.join(" ")}")`;
          else group.element.style.removeProperty("clip-path");
        }
        if (ripple && sinceOutline >= revealDuration) {
          const progress = Math.min(1, (sinceOutline - revealDuration) / waveDuration);
          const edge = progress * 120;
          const solid = Math.max(0, edge - 13);
          for (const { element, radiusX, radiusY } of bands) {
            element.style.maskImage = `radial-gradient(ellipse ${radiusX}px ${radiusY}px at center, black ${solid}%, transparent ${edge}%)`;
          }
        }
        const descent = Math.min(1, sinceOutline / (revealDuration + waveDuration));
        x = last.x + (landing.x - last.x) * descent;
        y = last.y + (landing.y - last.y) * descent ** 2;
        if (descent === 1) {
          finish();
          return;
        }
      }

      ball.style.transform = `translate(${x}px, ${y}px)`;
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
  }

  document.addEventListener("DOMContentLoaded", () => {
    function whenVisible() {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", whenVisible);
      requestAnimationFrame(() => {
        try {
          start();
        } catch (error) {
          finish();
          console.error("Homepage entrance could not start", error);
        }
      });
    }
    document.addEventListener("visibilitychange", whenVisible);
    whenVisible();
  }, { once: true });
})();
