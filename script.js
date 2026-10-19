// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Light/dark toggle
const root = document.documentElement;
document.getElementById("theme-toggle").addEventListener("click", () => {
  const current = root.getAttribute("data-theme") ||
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const next = current === "light" ? "dark" : "light";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch (e) {}
});

// Mobile menu
const menuBtn = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
menuBtn.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", open);
});
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", false);
  });
});

// Project filters
const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".card");
filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    const type = button.dataset.filter;
    cards.forEach((card) => {
      card.classList.toggle("hidden", type !== "all" && card.dataset.category !== type);
    });
  });
});

// Fade sections in as you scroll
const revealTargets = document.querySelectorAll(".section-title, .about-grid > *, .card, .skill-group, .timeline li, .contact p");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add("visible");
        // Once it has faded in, drop the animation classes so hover effects work normally
        el.addEventListener("transitionend", () => el.classList.remove("reveal", "visible"), { once: true });
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.1 });
  revealTargets.forEach((el) => {
    el.classList.add("reveal");
    observer.observe(el);
  });
}
