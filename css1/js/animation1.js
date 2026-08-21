// ============================================================
// animations.js — Star canvas, scroll reveal, FAQ, countdown
// ============================================================

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
  initStarfield(document.getElementById('starCanvas'), { density: 0.00012, twinkle: true });
  document.querySelectorAll('[data-stars]').forEach((canvas) => {
    initStarfield(canvas, { density: 0.00006, twinkle: false });
  });
  initScrollReveal();
  initAccordion();
  initCountdown();
  initScrollProgress();
  initActiveNavLink();
  initHeroParallax();
  initMagneticButtons();
  initZenithReveal();
});

/**
 * Applies the same reveal-on-scroll treatment used elsewhere on the page
 * to the hackathon feature photo and CSI team cards, without requiring
 * any data-reveal attributes in the markup itself.
 */
function initZenithReveal() {
  const targets = document.querySelectorAll('.zenith-feature-photo, .zenith-team-card, .zenith-section-heading');
  if (!targets.length) return;

  if (prefersReducedMotion) {
    targets.forEach((el) => el.classList.add('zenith-reveal', 'is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('is-visible'), i * 50);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  targets.forEach((el) => {
    el.classList.add('zenith-reveal');
    observer.observe(el);
  });
}

/**
 * Thin gradient progress bar pinned to the very top of the viewport,
 * tracking how far the page has been scrolled. Purely decorative — adds
 * no elements the rest of the app depends on.
 */
function initScrollProgress() {
  if (prefersReducedMotion) return;
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  let ticking = false;
  function update() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    bar.style.width = pct + '%';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}

/**
 * Highlights the primary nav link matching whichever section is currently
 * in view. Purely additive — falls back silently if sections/links are
 * missing or ids collide.
 */
function initActiveNavLink() {
  const links = document.querySelectorAll('#navLinks a[href^="#"]');
  if (!links.length) return;

  const map = new Map();
  links.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    const section = id ? document.getElementById(id) : null;
    if (section) map.set(section, link);
  });
  if (!map.size) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = map.get(entry.target);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('is-active'));
          link.classList.add('is-active');
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );

  map.forEach((_link, section) => observer.observe(section));
}

/**
 * Gentle scroll-linked parallax on the hero's orbit rings — subtle depth,
 * disabled entirely under reduced motion.
 */
function initHeroParallax() {
  if (prefersReducedMotion) return;
  const orbits = document.querySelector('.hero__orbits');
  const hero = document.getElementById('home');
  if (!orbits || !hero) return;

  let ticking = false;
  function update() {
    const rect = hero.getBoundingClientRect();
    const progress = Math.min(Math.max(-rect.top / (rect.height || 1), 0), 1);
    orbits.style.transform = `translateY(${progress * 60}px)`;
    orbits.style.opacity = String(1 - progress * 0.6);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}

/**
 * Subtle magnetic pull toward the cursor for primary call-to-action
 * buttons. No-ops on touch/reduced-motion; never changes button content.
 */
function initMagneticButtons() {
  if (prefersReducedMotion || window.matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('.btn--primary, .btn--cta').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.35 - 2}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
}

/**
 * Lightweight canvas starfield. Static (non-animated dots) when the user
 * prefers reduced motion; otherwise a slow twinkle.
 */
function initStarfield(canvas, { density, twinkle }) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  let width, height, dpr;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.floor(width * height * density);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.4 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.8,
    }));
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f4f3fb';
    stars.forEach((s) => {
      const alpha = twinkle && !prefersReducedMotion
        ? 0.4 + 0.6 * Math.abs(Math.sin(time * 0.001 * 0.3 * s.speed + s.phase))
        : 0.7;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (twinkle && !prefersReducedMotion) requestAnimationFrame(draw);
  }

  resize();
  requestAnimationFrame(draw);
  window.addEventListener('resize', resize, { passive: true });
}

/**
 * IntersectionObserver-based scroll reveal for elements marked [data-reveal].
 */
function initScrollReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (prefersReducedMotion) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('is-visible'), i * 60);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  targets.forEach((el) => observer.observe(el));
}

/**
 * Accessible accordion for the FAQ section — single-open behaviour,
 * max-height transition, aria-expanded state.
 */
function initAccordion() {
  const accordion = document.getElementById('accordion');
  if (!accordion) return;

  const triggers = accordion.querySelectorAll('.accordion__trigger');

  triggers.forEach((trigger) => {
    const panel = trigger.nextElementSibling;
    panel.style.maxHeight = '0px';

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      // Close all
      triggers.forEach((t) => {
        t.setAttribute('aria-expanded', 'false');
        t.nextElementSibling.style.maxHeight = '0px';
      });

      // Open this one if it was closed
      if (!isOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });
}

/**
 * Configurable countdown timer for the 12-hour hackathon section.
 * Set TARGET_DATE below once the official event date is confirmed.
 * Until then the display stays at 00:00:00:00.
 */
function initCountdown() {
  const el = document.getElementById('countdownDisplay');
  if (!el) return;

  // TODO: set the real event date here, e.g. '2026-11-14T09:00:00+05:30'
  const TARGET_DATE = null;

  if (!TARGET_DATE) return; // stays at 00 until a date is configured

  const target = new Date(TARGET_DATE).getTime();
  const daysEl = document.getElementById('cdDays');
  const hoursEl = document.getElementById('cdHours');
  const minutesEl = document.getElementById('cdMinutes');
  const secondsEl = document.getElementById('cdSeconds');

  function tick() {
    const diff = Math.max(0, target - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minutesEl.textContent = String(minutes).padStart(2, '0');
    secondsEl.textContent = String(seconds).padStart(2, '0');

    if (diff > 0) requestAnimationFrame(() => setTimeout(tick, 1000));
  }

  tick();
}
