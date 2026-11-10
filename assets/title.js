const role = document.querySelector("[data-titles]");
const roleText = role.querySelector("[data-role-text]");
const roleToggle = role.querySelector("[data-role-toggle]");
const titles = role.dataset.titles.split("|");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let current = 0;
let length = titles[0].length;
let deleting = true;
let paused = false;
let timer;

function advance() {
  const title = titles[current];
  length += deleting ? -1 : 1;
  roleText.textContent = title.slice(0, length);

  if (deleting && length === 0) {
    current = (current + 1) % titles.length;
    deleting = false;
    timer = window.setTimeout(advance, 220);
  } else if (!deleting && length === title.length) {
    deleting = true;
    timer = window.setTimeout(advance, 2300);
  } else {
    timer = window.setTimeout(advance, deleting ? 44 : 82);
  }
}

function syncAnimation() {
  window.clearTimeout(timer);
  const canAnimate = !reducedMotion.matches;
  const opening = document.documentElement.matches(".entrance-pending, .entrance-active");
  const running = canAnimate && !paused && !opening && !document.hidden &&
    !document.body.classList.contains("game-active");

  roleToggle.hidden = !canAnimate;
  role.dataset.running = String(running);
  role.dataset.paused = String(paused);
  const action = paused ? roleToggle.dataset.resume : roleToggle.dataset.pause;
  roleToggle.setAttribute("aria-label", action);
  roleToggle.title = action;

  if (!running) {
    roleText.textContent = titles[current];
    length = titles[current].length;
    deleting = true;
    return;
  }

  timer = window.setTimeout(advance, 2300);
}

roleToggle.addEventListener("click", () => {
  paused = !paused;
  syncAnimation();
});
document.addEventListener("visibilitychange", syncAnimation);
document.addEventListener("inlinegamechange", syncAnimation);
document.addEventListener("siteentranceend", syncAnimation);
reducedMotion.addEventListener("change", syncAnimation);
syncAnimation();

