/* ============================================================
   Portfolio motion
   The page works without this file. It adds smooth scrolling,
   scroll animations, the dot field, the menu, the research
   accordion and the demo video player.
   ============================================================ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const editMode = new URLSearchParams(location.search).has("edit"); // visual editor, see editor.js
const motion = !!(window.gsap && window.ScrollTrigger) && !reduceMotion && !editMode;

let lenis = null;

$("#year").textContent = new Date().getFullYear();

setupMenu();
setupResearch();
setupDemos();
if (editMode) loadEditor();
else setupHeroField();

if (motion) {
  gsap.registerPlugin(ScrollTrigger);
  setupSmoothScroll();
  setupIntro();
  setupWork();
  setupReveals();
  setupMarquee();
  setupNav();
  if (finePointer) {
    setupCursor();
    setupMagnetic();
  }
  ScrollTrigger.sort();
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
} else {
  $(".hero-name").style.visibility = "visible";
}

/* ---------- Helpers ---------- */

// The editor only loads for ?edit, so visitors never download it
function loadEditor() {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "editor.css";
  document.head.appendChild(css);
  const js = document.createElement("script");
  js.src = "editor.js";
  document.body.appendChild(js);
}

// Wrap each letter in a span so it can move on its own
function splitChars(el) {
  const text = el.textContent;
  el.textContent = "";
  for (const ch of text) {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = ch;
    el.appendChild(span);
  }
}

// Wrap each word in a span, keeping tags like <em> intact
function splitWords(el) {
  const words = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            return;
          }
          const span = document.createElement("span");
          span.className = "w";
          span.textContent = part;
          frag.appendChild(span);
          words.push(span);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(el);
  return words;
}

/* ---------- Phone menu ---------- */

function setupMenu() {
  const button = $(".menu-btn");
  const menu = $("#menu");

  const setOpen = (open) => {
    button.setAttribute("aria-expanded", open);
    button.textContent = open ? "Close" : "Menu";
    document.body.classList.toggle("menu-open", open);
    menu.hidden = !open;
    if (open) {
      lenis?.stop();
      $(".nav").classList.remove("is-hidden");
      if (motion) {
        gsap.fromTo($$("#menu a, .menu-foot"),
          { yPercent: 60, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.05 });
      }
    } else {
      lenis?.start();
    }
  };

  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
  $$("#menu a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) setOpen(false);
  });
}

/* ---------- Research accordion ---------- */

function setupResearch() {
  $$(".study").forEach((study) => {
    const head = $(".study-head", study);
    const body = $(".study-body", study);
    body.inert = !study.classList.contains("open");

    head.addEventListener("click", () => {
      const open = !study.classList.contains("open");
      study.classList.toggle("open", open);
      head.setAttribute("aria-expanded", open);
      body.inert = !open;
    });

    // The page got taller or shorter, so re-measure the scroll animations
    body.addEventListener("transitionend", (e) => {
      if (e.target === body && window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });
}

/* ---------- Demo tiles and video player ---------- */

function setupDemos() {
  const dialog = $(".lightbox");
  const frame = $(".lightbox-frame");

  // Demos that link to their own page (<a class="demo">) just navigate
  $$("button.demo").forEach((demo) => {
    const src = demo.dataset.video;

    // Silent preview on hover when the demo has a video file
    if (src && finePointer) {
      const video = document.createElement("video");
      video.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      $(".demo-zoom", demo).appendChild(video);
      demo.addEventListener("mouseenter", () => {
        video.play().catch(() => {});
        demo.classList.add("playing");
      });
      demo.addEventListener("mouseleave", () => {
        video.pause();
        demo.classList.remove("playing");
      });
    }

    demo.addEventListener("click", () => openDemo(demo));
  });

  function openDemo(demo) {
    const { video, youtube } = demo.dataset;
    frame.replaceChildren();

    if (youtube) {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtube)}?autoplay=1&rel=0`;
      iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      iframe.title = $(".demo-title", demo).textContent;
      frame.appendChild(iframe);
    } else if (video) {
      const player = document.createElement("video");
      player.src = video;
      player.controls = true;
      player.autoplay = true;
      player.playsInline = true;
      frame.appendChild(player);
    } else {
      const note = document.createElement("p");
      note.className = "mono lightbox-empty";
      note.innerHTML = 'No video yet.<br>Add data-video="videos/demo.mp4" or data-youtube="VIDEO_ID" to this demo.';
      frame.appendChild(note);
    }

    dialog.showModal();
    lenis?.stop();
    if (motion) {
      gsap.fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" });
      gsap.fromTo(frame, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.7, ease: "expo.out" });
    }
  }

  // Stop the video and give scrolling back. Runs for every way of closing.
  function cleanUp() {
    frame.replaceChildren();
    lenis?.start();
  }
  function closeDemo() {
    if (dialog.open) dialog.close();
    cleanUp();
  }

  $(".lightbox-close").addEventListener("click", closeDemo);
  // Anything that isn't the video itself closes the player
  dialog.addEventListener("click", (e) => {
    if (!frame.contains(e.target)) closeDemo();
  });
  // Esc closes it natively; "cancel" fires right away, "close" as a backup.
  // The open check stops a late "close" from wiping a demo that was just reopened.
  dialog.addEventListener("cancel", cleanUp);
  dialog.addEventListener("close", () => {
    if (!dialog.open) cleanUp();
  });
}

/* ---------- Dot field in the hero ---------- */

function setupHeroField() {
  const canvas = $(".hero-field");
  const hero = $(".hero");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const GAP = 28;
  const RADIUS = 180;
  const PUSH = 24;
  const mouse = { x: -9999, y: -9999 };
  let width = 0;
  let height = 0;
  let dots = [];
  let visible = true;
  let frameId = 0;

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    for (let y = GAP / 2; y < height; y += GAP) {
      for (let x = GAP / 2; x < width; x += GAP) dots.push({ x, y, ox: 0, oy: 0 });
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    for (const d of dots) {
      const dx = d.x - mouse.x;
      const dy = d.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = Math.max(0, 1 - dist / RADIUS);
      const wave = reduceMotion ? 0 : Math.sin(time * 0.0006 + d.x * 0.01 + d.y * 0.014) * 1.8;

      d.ox += ((dx / dist) * force * PUSH - d.ox) * 0.1;
      d.oy += ((dy / dist) * force * PUSH + wave - d.oy) * 0.1;

      ctx.fillStyle = force > 0.45
        ? `rgba(255, 91, 31, ${0.35 + force * 0.55})`
        : `rgba(236, 235, 230, ${0.12 + force * 0.5})`;
      const size = 1.5 + force * 1.6;
      ctx.fillRect(d.x + d.ox - size / 2, d.y + d.oy - size / 2, size, size);
    }
    if (!reduceMotion && visible) frameId = requestAnimationFrame(draw);
  }

  function start() {
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(draw);
  }

  hero.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  hero.addEventListener("pointerleave", () => {
    mouse.x = mouse.y = -9999;
  });

  // Only animate while the hero is on screen
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }).observe(hero);

  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      build();
      start();
    }, 150);
  });

  build();
  start();
}

/* ---------- Smooth scrolling ---------- */

function setupSmoothScroll() {
  if (!window.Lenis) return;

  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Safety net: if scrolling is paused but nothing is open, turn it back on
  const unstick = () => {
    if (lenis.isStopped && !$(".lightbox").open && $("#menu").hidden) lenis.start();
  };
  addEventListener("wheel", unstick, { passive: true });
  addEventListener("touchstart", unstick, { passive: true });
  addEventListener("keydown", unstick);

  // In-page links glide instead of jumping
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute("href");
    const target = hash === "#top" ? 0 : document.querySelector(hash);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.6 });
  });
}

/* ---------- Hero intro ---------- */

function setupIntro() {
  const name = $(".hero-name");
  const lines = $$(".hero-line");
  lines.forEach(splitChars);
  gsap.set(name, { visibility: "visible" });

  // Letters rise into place on load
  const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
  lines.forEach((line, i) => {
    intro.from($$(".char", line), { yPercent: 115, duration: 1.6, stagger: 0.035 }, 0.1 + i * 0.12);
  });
  intro
    .from(".nav", { opacity: 0, duration: 1.2 }, 0.5)
    .from([".hero-top > *", ".hero-bottom > *"], { opacity: 0, y: 16, duration: 1.2, stagger: 0.06 }, 0.55)
    .from(".hero-field", { opacity: 0, duration: 2.4, ease: "power2.out" }, 0.3);

  // As you scroll away, the three lines drift apart
  gsap.timeline({
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  })
    .to(lines[0], { xPercent: -16, ease: "none" }, 0)
    .to(lines[1], { xPercent: 12, ease: "none" }, 0)
    .to(lines[2], { xPercent: 16, ease: "none" }, 0)
    .to(name, { yPercent: 30, ease: "none" }, 0)
    .to([".hero-top", ".hero-bottom"], { opacity: 0, ease: "power1.in" }, 0);
}

/* ---------- Projects: sideways scroll on desktop ---------- */

function setupWork() {
  const work = $(".work");
  const pin = $(".work-pin");
  const track = $(".work-track");
  const projects = $$(".project");
  const current = $(".work-current");
  const bar = $(".work-bar span");
  $(".work-total").textContent = String(projects.length).padStart(2, "0");

  const mm = gsap.matchMedia();

  mm.add("(min-width: 900px)", () => {
    work.classList.add("is-horizontal");
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    const slide = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => "+=" + distance(),
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          bar.style.transform = `scaleX(${self.progress})`;
          const index = Math.round(self.progress * (projects.length - 1));
          current.textContent = String(index + 1).padStart(2, "0");
        },
      },
    });

    // Screenshots drift inside their frames
    projects.forEach((project) => {
      gsap.fromTo($(".media-inner", project), { xPercent: -6 }, {
        xPercent: 6,
        ease: "none",
        scrollTrigger: { trigger: project, containerAnimation: slide, start: "left right", end: "right left", scrub: true },
      });
    });

    // The track rises in as the section arrives
    gsap.from(track, {
      y: 80,
      opacity: 0,
      duration: 1.4,
      ease: "expo.out",
      scrollTrigger: { trigger: pin, start: "top 75%", once: true },
    });

    return () => work.classList.remove("is-horizontal");
  });

  mm.add("(max-width: 899px)", () => {
    projects.forEach((project) => {
      gsap.fromTo($(".project-media", project), { clipPath: "inset(10% 6% 10% 6%)" }, {
        clipPath: "inset(0% 0% 0% 0%)",
        ease: "none",
        scrollTrigger: { trigger: project, start: "top 95%", end: "top 45%", scrub: true },
      });
      gsap.from($(".project-info", project), {
        y: 30,
        opacity: 0,
        duration: 1.2,
        ease: "expo.out",
        scrollTrigger: { trigger: $(".project-info", project), start: "top 90%", once: true },
      });
    });
  });
}

/* ---------- Scroll reveals ---------- */

function setupReveals() {
  // Fade up
  $$("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 1.3,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  // Big titles slide up out of a mask
  $$(".section-title").forEach((title) => {
    title.innerHTML = `<span class="line"><span class="line-inner">${title.innerHTML}</span></span>`;
    gsap.from($(".line-inner", title), {
      yPercent: 110,
      duration: 1.5,
      ease: "expo.out",
      scrollTrigger: { trigger: title, start: "top 88%", once: true },
    });
  });

  gsap.from(".contact-title .line-inner", {
    yPercent: 110,
    duration: 1.6,
    ease: "expo.out",
    stagger: 0.12,
    scrollTrigger: { trigger: ".contact-title", start: "top 85%", once: true },
  });

  // About statement: words light up as you scroll through it
  const words = splitWords($("[data-split-words]"));
  gsap.fromTo(words, { opacity: 0.14 }, {
    opacity: 1,
    stagger: 0.08,
    ease: "none",
    scrollTrigger: { trigger: ".statement", start: "top 80%", end: "bottom 50%", scrub: true },
  });

  // Research entries
  $$(".study").forEach((study) => {
    gsap.from(study, {
      y: 30,
      opacity: 0,
      duration: 1.2,
      ease: "expo.out",
      scrollTrigger: { trigger: study, start: "top 92%", once: true },
    });
  });

  // Résumé rows: the line draws across, then the text rises
  $$(".row").forEach((row) => {
    gsap.timeline({ scrollTrigger: { trigger: row, start: "top 90%", once: true } })
      .fromTo(row, { "--line-scale": 0 }, { "--line-scale": 1, duration: 1.4, ease: "expo.inOut" })
      .from(row.children, { y: 24, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.08 }, 0.3);
  });

  // Demos: frame opens up, image drifts inside
  $$(".demo").forEach((demo) => {
    gsap.fromTo($(".demo-media", demo), { clipPath: "inset(14% 10% 14% 10%)" }, {
      clipPath: "inset(0% 0% 0% 0%)",
      ease: "none",
      scrollTrigger: { trigger: demo, start: "top 95%", end: "top 40%", scrub: true },
    });
    gsap.fromTo($(".media-inner", demo), { yPercent: -6 }, {
      yPercent: 6,
      ease: "none",
      scrollTrigger: { trigger: demo, start: "top bottom", end: "bottom top", scrub: true },
    });
    gsap.from($(".demo-info", demo), {
      y: 20,
      opacity: 0,
      duration: 1.1,
      ease: "expo.out",
      scrollTrigger: { trigger: demo, start: "top 70%", once: true },
    });
  });
}

/* ---------- Skills marquee: speeds up and flips with your scrolling ---------- */

function setupMarquee() {
  const loops = $$(".marquee-track").map((track, i) => {
    $$(":scope > *", track).forEach((item) => {
      const copy = item.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      track.appendChild(copy);
    });
    const loop = i % 2 === 0
      ? gsap.fromTo(track, { xPercent: 0 }, { xPercent: -50, duration: 40, ease: "none", repeat: -1 })
      : gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration: 46, ease: "none", repeat: -1 });
    loop.totalTime(loop.duration() * 100); // room to run backwards
    return loop;
  });

  let direction = 1;
  let boost = 0;
  let speed = 1;
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      direction = self.direction;
      boost = Math.min(Math.abs(self.getVelocity()) / 300, 6);
    },
  });
  gsap.ticker.add(() => {
    boost *= 0.94;
    speed += (direction * (1 + boost) - speed) * 0.08;
    loops.forEach((loop) => loop.timeScale(speed));
  });
}

/* ---------- Nav: hide on the way down, highlight the current section ---------- */

function setupNav() {
  const nav = $(".nav");

  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const hide = self.direction === 1 && self.scroll() > 240 && !document.body.classList.contains("menu-open");
      nav.classList.toggle("is-hidden", hide);
    },
  });

  $$(".nav-links a").forEach((link) => {
    const section = $(link.getAttribute("href"));
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      end: "bottom 50%",
      onToggle: (self) => link.classList.toggle("is-active", self.isActive),
    });
  });

  gsap.to(".progress", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
}

/* ---------- Mouse extras (desktop only) ---------- */

function setupCursor() {
  const cursor = $(".cursor");
  const label = $(".cursor-label");
  gsap.set(cursor, { scale: 0 });
  const xTo = gsap.quickTo(cursor, "x", { duration: 0.5, ease: "power3" });
  const yTo = gsap.quickTo(cursor, "y", { duration: 0.5, ease: "power3" });

  addEventListener("pointermove", (e) => {
    xTo(e.clientX);
    yTo(e.clientY);
  });

  $$("[data-cursor]").forEach((el) => {
    el.addEventListener("pointerenter", () => {
      label.textContent = el.dataset.cursor;
      gsap.to(cursor, { scale: 1, duration: 0.5, ease: "expo.out" });
    });
    el.addEventListener("pointerleave", () => gsap.to(cursor, { scale: 0, duration: 0.4, ease: "expo.out" }));
    el.addEventListener("click", () => gsap.to(cursor, { scale: 0, duration: 0.3 }));
  });
}

// Buttons lean toward the mouse
function setupMagnetic() {
  $$("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
    el.addEventListener("pointermove", (e) => {
      const rect = el.getBoundingClientRect();
      xTo((e.clientX - rect.left - rect.width / 2) * 0.3);
      yTo((e.clientY - rect.top - rect.height / 2) * 0.3);
    });
    el.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}
