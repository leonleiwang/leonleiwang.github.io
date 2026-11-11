(() => {
  const figure = document.querySelector(".skills-figure");
  const chart = figure.querySelector(".skills-pie");
  const tooltip = figure.querySelector(".skills-tooltip");
  const rows = Array.from(document.querySelectorAll(".skill-row"), (row) => {
    return {
      row,
      color: getComputedStyle(row).getPropertyValue("--skill-color"),
      share: Number(row.dataset.share),
    };
  });
  const svg = "http://www.w3.org/2000/svg";
  const center = 200;
  const radius = 188;
  const fullTurn = Math.PI * 2;
  const total = rows.reduce((sum, { share }) => sum + share, 0);
  let angle = -Math.PI / 2;

  const slices = rows.map(({ row, color, share }) => {
    const name = row.querySelector("h2").textContent;
    const start = angle;
    const sweep = share / total * fullTurn;
    angle += sweep;
    const midpoint = start + sweep / 2;
    const directionX = Math.cos(midpoint);
    const directionY = Math.sin(midpoint);
    const point = (at) => `${center + radius * Math.cos(at)} ${center + radius * Math.sin(at)}`;
    const element = document.createElementNS(svg, "path");
    element.setAttribute("class", "skills-slice");
    element.setAttribute("d", `M${center} ${center} L${point(start)} A${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(angle)} Z`);
    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", name);
    element.style.setProperty("--slice-color", color);
    element.style.setProperty("--slice-x", `${directionX * 5}px`);
    element.style.setProperty("--slice-y", `${directionY * 5}px`);
    chart.append(element);
    return { row, element, name, tooltipY: 50 + directionY * 24 };
  });

  let hovered = null;
  let selected = null;

  function render() {
    const focused = slices.find((slice) => slice.element.matches(":focus-visible"));
    const active = hovered || focused || selected;
    for (const slice of slices) {
      slice.element.classList.toggle("is-active", slice === active);
      slice.element.setAttribute("aria-pressed", String(slice === selected));
      slice.row.classList.toggle("is-active", slice === active);
    }
    tooltip.hidden = !active;
    if (active) {
      tooltip.textContent = active.name;
      tooltip.style.setProperty("--tooltip-y", `${active.tooltipY}%`);
    }
  }

  function select(slice) {
    selected = selected === slice ? null : slice;
    render();
  }

  for (const slice of slices) {
    const { element } = slice;
    element.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      hovered = slice;
      render();
    });
    element.addEventListener("pointerleave", () => {
      if (hovered === slice) hovered = null;
      render();
    });
    element.addEventListener("focus", render);
    element.addEventListener("blur", () => queueMicrotask(render));
    element.addEventListener("click", () => select(slice));
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      select(slice);
    });
  }

  render();
  figure.hidden = false;
})();
