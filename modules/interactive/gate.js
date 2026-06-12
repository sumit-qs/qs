import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

// Content gate for gated articles / downloads.
//
// Shows a `.qs-gate` overlay (blurring `.content-insight` behind it) once the
// reader scrolls past ~1200px, and blocks download buttons until a form is
// submitted. Submitting ANY form on the page permanently hides the gate and
// unlocks the downloads. The dismissed state is persisted in localStorage
// (per-page + site-wide keys) and synced across tabs, so a visitor who has
// already converted never sees the gate again.
//
// Download hooks blocked while gated: the .qs-fixed-button labelled "Download"
// and links inside .qs-article-downlaod-wrapper.
export function functionGate() {
  const storageKey = `qs:gate:hidden:${location.pathname}`; // per-page flag (kept for compatibility)
  const globalKey = 'qs:gate:hidden:*'; // site-wide flag

  const persistHidden = () => {
    try { localStorage.setItem(storageKey, '1'); } catch (_) { /* ignore */ }
  };
  const persistHiddenGlobal = () => {
    try { localStorage.setItem(globalKey, '1'); } catch (_) { /* ignore */ }
  };
  const isHiddenPersisted = () => {
    try { return localStorage.getItem(storageKey) === '1'; } catch (_) { return false; }
  };
  const isHiddenPersistedGlobal = () => {
    try { return localStorage.getItem(globalKey) === '1'; } catch (_) { return false; }
  };

  const hideGateInstant = () => {
    const gate = document.querySelector('.qs-gate');
    if (!gate) return;
    gate.style.visibility = 'hidden';
    gate.style.opacity = '0';
    gate.style.display = 'none';
  };

  const hideGate = () => {
    const gate = document.querySelector('.qs-gate');
    if (!gate || gate.style.display === 'none') return;
    persistHidden();
    persistHiddenGlobal();
    gate.dataset.qsGateVisible = 'false';
    document.body.style.userSelect = '';
    const content = document.querySelector('.content-insight');
    if (content) {
      gsap.to(content, { duration: 0.5, opacity: 1, filter: 'blur(0px)', ease: myEase });
    }
    const fixedLink = document.querySelector('.qs-article-fixed-link-wrapper');
    if (fixedLink) {
      gsap.to(fixedLink, { duration: 0.5, opacity: 1, ease: myEase });
    }
    try {
      gsap.to(gate, {
        duration: 0.5,
        autoAlpha: 0,
        yPercent: 100,
        ease: myEase,
        onComplete: () => {
          gate.style.display = 'none';
          gate.style.visibility = 'hidden';
        }
      });
    } catch (_) {
      gate.style.display = 'none';
    }
  };

  const showGate = (gate) => {
    if (gateSubmitted) return; // form already submitted — never show gate again
    if (!gate || gate.dataset.qsGateVisible === 'true') return;
    gate.dataset.qsGateVisible = 'true';
    gate.style.display = '';
    gsap.fromTo(gate,
      { autoAlpha: 0, yPercent: 100 },
      { duration: 0.5, autoAlpha: 1, yPercent: 0, ease: myEase }
    );
    const content = document.querySelector('.content-insight');
    if (content) {
      gsap.to(content, { duration: 0.5, opacity: 0.2, filter: 'blur(6px)', ease: myEase });
    }
    const fixedLink = document.querySelector('.qs-article-fixed-link-wrapper');
    if (fixedLink) {
      gsap.to(fixedLink, { duration: 0.5, opacity: 0, ease: myEase });
    }
    document.body.style.userSelect = 'none';
  };

  let gateLocked = false; // true when gate was forced open via download click
  let gateSubmitted = false; // true after form has been submitted — gate must never reappear

  const hideGateSmooth = (gate) => {
    if (!gate || gate.dataset.qsGateVisible !== 'true') return;
    if (gateLocked) return; // keep gate visible when triggered by download click
    gate.dataset.qsGateVisible = 'false';
    gsap.to(gate, {
      duration: 0.5,
      autoAlpha: 0,
      yPercent: 100,
      ease: myEase,
    });
    const content = document.querySelector('.content-insight');
    if (content) {
      gsap.to(content, { duration: 0.5, opacity: 1, filter: 'blur(0px)', ease: myEase });
    }
    const fixedLink = document.querySelector('.qs-article-fixed-link-wrapper');
    if (fixedLink) {
      gsap.to(fixedLink, { duration: 0.5, opacity: 1, ease: myEase });
    }
    document.body.style.userSelect = '';
  };

  // --- Block download buttons while the gate is active ---
  const getDownloadLinks = () => {
    const links = [];
    // Fixed sidebar download button (the one with "Download" caption)
    document.querySelectorAll('.qs-fixed-button-wrapper .qs-fixed-button').forEach((btn) => {
      const caption = btn.querySelector('.caption');
      if (caption && caption.textContent.trim().toLowerCase() === 'download') {
        links.push(btn);
      }
    });
    // Article body download link
    document.querySelectorAll('.qs-article-downlaod-wrapper a').forEach((a) => links.push(a));
    return links;
  };

  const blockClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const gate = document.querySelector('.qs-gate');
    if (gate) {
      gateLocked = true; // prevent scroll-up from hiding the gate
      showGate(gate);
      gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const lockDownloads = () => {
    getDownloadLinks().forEach((link) => {
      link.addEventListener('click', blockClick, { capture: true });
      link.style.opacity = '0.4';
      link.style.pointerEvents = 'auto';    // keep clickable so we can intercept
      link.style.cursor = 'not-allowed';
    });
  };

  const unlockDownloads = () => {
    getDownloadLinks().forEach((link) => {
      link.removeEventListener('click', blockClick, { capture: true });
      link.style.opacity = '';
      link.style.cursor = '';
    });
  };

  // Delegate so dynamically added forms are covered too
  if (!document.documentElement.dataset.qsGateSubmitBound) {
    document.documentElement.dataset.qsGateSubmitBound = 'true';
    document.addEventListener('submit', (e) => {
      gateLocked = false;
      gateSubmitted = true;
      hideGate();
      unlockDownloads();
    }, { capture: true, once: true });
  }

  // Restore hidden state on load and on back/forward cache navigation (global takes precedence)
  if (isHiddenPersistedGlobal() || isHiddenPersisted()) {
    hideGateInstant();
  } else {
    // Start hidden, show at 1000px, hide when scrolling back up
    const gate = document.querySelector('.qs-gate');
    if (gate) {
      // Lock downloads while the gate hasn't been submitted
      lockDownloads();

      gate.style.visibility = 'hidden';
      gate.style.opacity = '0';
      const onScroll = () => {
        if (window.scrollY >= 1200) {
          showGate(gate);
        } else {
          hideGateSmooth(gate);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }
  window.addEventListener('pageshow', () => { if (isHiddenPersistedGlobal() || isHiddenPersisted()) hideGateInstant(); });

  // Keep multiple tabs/windows in sync
  window.addEventListener('storage', (e) => {
    if (!e) return;
    if ((e.key === globalKey || e.key === storageKey) && e.newValue === '1') {
      hideGateInstant();
    }
  });
}