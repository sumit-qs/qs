/**
 * Dynamically offsets the footer/body bottom padding to prevent
 * the fixed countdown bar (.conference-info) from covering footer
 * content on tablet/mobile. No-ops on pages without the component.
 */

let resizeTimer = null;

function getCountdownBar() {
  return document.querySelector('.conference-info');
}

function applyCountdownFooterOffset() {
  const bar = getCountdownBar();

  if (!bar) {
    document.body.style.paddingBottom = '';
    return;
  }

  const isFixed = window.getComputedStyle(bar).position === 'fixed';

  if (!isFixed) {
    document.body.style.paddingBottom = '';
    return;
  }

  const barHeight = bar.offsetHeight;
  document.body.style.paddingBottom = `${barHeight}px`;
}

function debouncedApply() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applyCountdownFooterOffset, 150);
}

export function initCountdownFooterOffset() {
  const bar = getCountdownBar();
  if (!bar) return; // page has no countdown component, skip entirely

  applyCountdownFooterOffset();

  window.addEventListener('resize', debouncedApply);

  // Re-measure if bar content changes size (e.g. text wraps differently,
  // CTA swaps, sold-out state, etc.)
  const resizeObserver = new ResizeObserver(() => applyCountdownFooterOffset());
  resizeObserver.observe(bar);
}