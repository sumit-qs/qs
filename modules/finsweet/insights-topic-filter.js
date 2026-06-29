/**
 * URL-based topic filter sync for the Insights page.
 *
 * On filter select → appends ?topic=<slug> to the URL via pushState.
 * On direct URL load with ?topic= → opens Topics accordion and pre-selects the matching checkbox.
 *
 * Hooks: input[fs-list-field="topic"], .qs-accordion-head-filters
 */

export function functionInsightsTopicFilter() {
  function slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  function getTopicFromURL() {
    return new URLSearchParams(window.location.search).get('topic');
  }

  function updateURL(topicSlug) {
    const url = new URL(window.location.href);
    if (topicSlug) {
      url.searchParams.set('topic', topicSlug);
    } else {
      url.searchParams.delete('topic');
    }
    history.pushState({}, '', url.toString());
  }

  function getTopicInputs() {
    return document.querySelectorAll('input[fs-list-field="topic"]');
  }

  function openTopicsAccordion() {
    document.querySelectorAll('.qs-accordion-head-filters').forEach((trigger) => {
      if (trigger.textContent.trim().includes('Topics')) {
        trigger.click();
        console.log('[QS Topic Filter] Opened Topics accordion');
      }
    });
  }

  function applyTopicFromURL() {
    const topicSlug = getTopicFromURL();
    if (!topicSlug) return;

    getTopicInputs().forEach((input) => {
      const value = input.getAttribute('fs-list-value') || '';
      if (slugify(value) === topicSlug && !input.checked) {
        input.click();
        console.log('[QS Topic Filter] Auto-selected:', value);
      }
    });
  }

  function bindFilterChangeListener() {
    const inputs = getTopicInputs();
    console.log('[QS Topic Filter] Binding to inputs:', inputs.length);

    inputs.forEach((input) => {
      input.addEventListener('change', () => {
        setTimeout(() => {
          const checked = document.querySelector('input[fs-list-field="topic"]:checked');
          if (checked) {
            const slug = slugify(checked.getAttribute('fs-list-value') || '');
            updateURL(slug);
            console.log('[QS Topic Filter] URL →', slug);
          } else {
            updateURL(null);
            console.log('[QS Topic Filter] Cleared');
          }
        }, 50);
      });
    });
  }

  function init() {
    const inputs = getTopicInputs();
    if (inputs.length === 0) {
      setTimeout(init, 300);
      return;
    }
    bindFilterChangeListener();
    if (getTopicFromURL()) {
      openTopicsAccordion();
      setTimeout(applyTopicFromURL, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }
}