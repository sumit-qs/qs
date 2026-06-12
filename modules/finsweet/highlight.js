/**
 * "Highlight to share" popover. When the user selects text inside
 * .qs-progress-wrapper, a popover (#highlight-share) appears offering share links
 * that deep-link to the exact selection via a URL text fragment (#:~:text=...).
 *
 * Builds per-platform share URLs (X, Facebook, LinkedIn, WhatsApp, Telegram,
 * Reddit, email, …) for every [data-share] / [fs-socialshare-element] inside the
 * popover, plus a copy-link button ([data-copy]) and native navigator.share() on
 * mobile. Hooks: #highlight-share, #hs-url, #hs-content. Set DEBUG=true (below)
 * for verbose logging. (Export name is intentionally "Hightlight" — keep it; it's
 * what scripts.js imports.)
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionFinsweetHightlight() {
  const pop = document.getElementById('highlight-share');
  const urlEl = document.getElementById('hs-url');
  const contentEl = document.getElementById('hs-content');
  const copyBtn = pop?.querySelector('[data-copy]');
  let lastRange = null, hideTO;
  let isVisible = false;
  let lastShowAt = 0;
  let lastText = '';

  // Debug helper
  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.log('[Finsweet Highlight]', ...args); };
  const warn = (...args) => { if (DEBUG) console.warn('[Finsweet Highlight]', ...args); };
  const err = (...args) => { if (DEBUG) console.error('[Finsweet Highlight]', ...args); };

  log('init: starting', { hasPop: !!pop, hasUrlEl: !!urlEl, hasContentEl: !!contentEl });

  // Guard: required elements must exist
  if (!pop || !urlEl || !contentEl) {
    warn('init: required element(s) missing', { pop, urlEl, contentEl });
    return;
  }

  log('init: elements found', {
    popId: pop.id,
    urlElId: urlEl.id,
    contentElId: contentEl.id,
    hasCopyBtn: !!copyBtn
  });

  // Only allow sharing inside this container
  const container = document.querySelector('.qs-progress-wrapper');
  log('init: container', { hasContainer: !!container, selector: '.qs-progress-wrapper' });

  // Ensure popover is an overlay and doesn't affect layout
  try {
    pop.style.position = 'fixed';
    pop.style.zIndex = pop.style.zIndex || '9999';
  } catch(_) {}

  function getSelectionData(){
    const sel = window.getSelection();
    if(!sel){ log('getSelectionData: no selection object'); return null; }
    if(sel.rangeCount===0){ log('getSelectionData: rangeCount = 0'); return null; }
    const text = (sel.toString()||"").trim();
    if(!text){ log('getSelectionData: selection text empty'); return null; }
    const range = sel.getRangeAt(0);
    // Constrain selection to container if present
    if (container) {
      const anc = range.commonAncestorContainer;
      const node = anc?.nodeType === 1 ? anc : anc?.parentNode;
      const aIn = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode);
      const fIn = sel.focusNode && (sel.focusNode.nodeType === 1 ? sel.focusNode : sel.focusNode.parentNode);
      const insideByAncestor = node ? container.contains(node) : false;
      const insideByEndpoints = aIn && fIn ? (container.contains(aIn) && container.contains(fIn)) : false;
      if(!(insideByAncestor || insideByEndpoints)){
        log('getSelectionData: selection outside container -> ignore');
        return null;
      }
    }
    const rect = range.getBoundingClientRect();
    if(!rect){ log('getSelectionData: no rect from range'); return null; }
    if(rect.width===0 && rect.height===0){ log('getSelectionData: rect has zero area', rect); return null; }
    log('getSelectionData: ok', { textLen: text.length, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
    return {text, rect, range};
  }

  function textFragment(q){
    const s = q.replace(/\s+/g,' ').slice(0,150);
    const frag = `#:~:text=${encodeURIComponent(s)}`;
    log('textFragment:', { inputLen: q.length, normalizedLen: s.length, frag });
    return frag;
  }

  function buildShareUrl(q){
    const base = location.href.split('#')[0];
    const url = base + textFragment(q);
    log('buildShareUrl:', { base, url });
    return url;
  }

  function clampForX(q){
    const max = 240;
    const out = q.length>max ? q.slice(0, max-1)+'…' : q;
    if(q.length>max){ log('clampForX: clamped', { inLen: q.length, outLen: out.length }); }
    return out;
  }

  function getOgImage(){
    const sel = (
      document.querySelector('meta[property="og:image"]') ||
      document.querySelector('meta[name="og:image"]') ||
      document.querySelector('meta[property="og:image:url"]')
    );
    return sel?.content || '';
  }

  function buildPlatformUrl(platform, url, text, title, opts = {}){
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(text);
    const ti = encodeURIComponent(title || document.title || '');
    const media = encodeURIComponent(opts.media || getOgImage() || '');
    switch((platform||'').toLowerCase()){
      case 'twitter':
      case 'x':
        return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
      case 'facebook':
        if (opts.fbAppId) {
          const app = encodeURIComponent(opts.fbAppId);
          const redirect = encodeURIComponent(url);
          return `https://www.facebook.com/dialog/share?app_id=${app}&display=popup&href=${u}&quote=${t}&redirect_uri=${redirect}`;
        }
        return `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`;
      case 'linkedin':
        // LinkedIn ignores prefilled text; URL only
        return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
      case 'pinterest':
        // Pinterest requires an image URL (media) to work properly
        return `https://pinterest.com/pin/create/button/?url=${u}&media=${media}&description=${t}`;
      case 'whatsapp':
        return `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
      case 'telegram':
        return `https://t.me/share/url?url=${u}&text=${t}`;
      case 'reddit':
        return `https://www.reddit.com/submit?url=${u}&title=${t}`;
      case 'email':
        return `mailto:?subject=${ti}&body=${encodeURIComponent(text + '\n\n' + url)}`;
      default:
        return url; // fallback
    }
  }

  function setShareLinks(url, text){
    const btns = pop.querySelectorAll('[data-share], [fs-socialshare-element]');
    if(!btns || btns.length===0){ log('setShareLinks: no [data-share] buttons'); return; }
    btns.forEach((el)=>{
      const attr = el.getAttribute('data-share') || el.getAttribute('fs-socialshare-element') || '';
      // Skip internal helper elements if any
      if(/^(url|content)$/i.test(attr)) { return; }
      // Alias mapping
      const aliases = { x: 'twitter', fb: 'facebook', ig: 'instagram' };
      const platform = (aliases[attr?.toLowerCase()] || attr).toLowerCase();
  const media = el.getAttribute('data-media') || '';
  const fbAppId = el.getAttribute('data-fb-app-id') || pop.getAttribute('data-fb-app-id') || '';
  const shareHref = buildPlatformUrl(platform, url, text, document.title, { media, fbAppId });
      if(el.tagName === 'A'){
        el.setAttribute('href', shareHref);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener,noreferrer');
      } else {
        el.dataset.href = shareHref;
      }
      log('setShareLinks: updated', { platform, href: shareHref });
    });

    // Optional: unify click behavior for non-anchor elements
  pop.querySelectorAll('[data-share]:not(a), [fs-socialshare-element]:not(a)').forEach((el)=>{
      el.addEventListener('click', (e)=>{
    e.preventDefault();
    e.stopPropagation();
        const href = el.dataset.href;
        if(href){ window.open(href, '_blank', 'noopener,noreferrer'); }
      }, { once: false });
    });
  }

  function positionPopover(rect){
    // Using fixed positioning relative to viewport
    const x = rect.left + (rect.width/2);
    const y = rect.top; // align to top of selection
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    log('positionPopover:', { rect: { left: rect.left, top: rect.top, w: rect.width, h: rect.height }, x, y });
  }

  function show(){
    clearTimeout(hideTO);
    const wasVisible = isVisible;
    pop.style.display = 'flex';
    pop.style.flexDirection = 'row';
    if (!wasVisible) {
      gsap.killTweensOf(pop);
      gsap.set(pop, { yPercent: 100, opacity: 0 });
      gsap.to(pop, { yPercent: 50, opacity: 1, duration: 0.2, ease: myEase });
    }
    isVisible = true;
    lastShowAt = Date.now();
    log('show: popover visible');
  }

  function hideSoon(delay=200){
    clearTimeout(hideTO);
    log('hideSoon: scheduled', { delay });
    hideTO = setTimeout(()=>{ 
      gsap.killTweensOf(pop);
      gsap.to(pop, { yPercent: 100, opacity: 0, duration: 0.15, ease: myEase, onComplete: () => {
        pop.style.display='none'; 
        isVisible = false;
        log('hideSoon: executed -> popover hidden');
      }});
    }, delay);
  }

  function updateShare(q){
    const shareUrlHighlight = buildShareUrl(q);
    const shareUrlBase = location.href.split('#')[0];
  // Provide values for Finsweet socialshare to read
  urlEl.dataset.urlHighlight = shareUrlHighlight;
  urlEl.dataset.urlBase = shareUrlBase;
  urlEl.textContent = shareUrlBase; // give base URL to social engines
  // Keep the selected text available in DOM for Finsweet
  lastText = q;
  contentEl.textContent = q; // hidden by your HTML/CSS
  // Update per-platform share links so text is included where supported
  setShareLinks(shareUrlBase, q);
  log('updateShare: updated UI', { shareUrlBase, shareUrlHighlight, textLen: lastText.length });
  }

  function handleSelection(){
    log('handleSelection: start');
    const data = getSelectionData();
    if(!data){ log('handleSelection: no data -> hide'); hideSoon(0); return; }
    lastRange = data.range;
    log('handleSelection: range stored');
    updateShare(data.text);
    positionPopover(data.rect);
    show();
  }

  document.addEventListener('mouseup', (e)=> { log('event: mouseup', { target: e.target?.tagName }); setTimeout(handleSelection, 40); });
  document.addEventListener('keyup', (e)=> {
    log('event: keyup', { key: e.key });
    if(e.key==='Escape'){ log('keyup: Escape -> clear selection & hide'); hideSoon(0); window.getSelection()?.removeAllRanges(); return; }
    setTimeout(handleSelection, 40);
  });
  document.addEventListener('scroll', ()=> { 
    log('event: scroll'); 
    const data = getSelectionData();
    if (data) {
      // If selection still exists, keep popover in sync instead of hiding on scroll
      lastRange = data.range;
      // Only refresh UI if visible or recently shown
      const recentlyShown = (Date.now() - lastShowAt) < 600;
      if (isVisible || recentlyShown) {
        updateShare(data.text);
        positionPopover(data.rect);
        show();
      }
    } else {
      hideSoon(0);
    }
  }, {passive:true});
  document.addEventListener('click', (e)=>{
    const inside = pop.contains(e.target);
    log('event: document click', { insidePopover: inside, target: e.target?.tagName });
    if(!inside) hideSoon();
  });

  if(copyBtn){
    log('init: copy button found');
    copyBtn.addEventListener('click', async ()=>{
      log('copyBtn: click');
      try{ 
  const val = urlEl.dataset.urlHighlight || urlEl.dataset.urlBase || urlEl.textContent || location.href; 
        await navigator.clipboard.writeText(val); 
        log('copyBtn: copied to clipboard', { len: val.length });
      }catch(e){ err('copyBtn: failed to copy', e); }
      copyBtn.classList.add('ok');
      setTimeout(()=>copyBtn.classList.remove('ok'),600);
      hideSoon();
    });
  } else {
    warn('init: copy button NOT found');
    // Fallback: allow clicking the URL text to copy
    urlEl.style.cursor = 'copy';
    urlEl.title = 'Click to copy link';
    urlEl.addEventListener('click', async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      log('urlEl: click-to-copy');
      try{
  const val = urlEl.dataset.urlHighlight || urlEl.dataset.urlBase || urlEl.textContent || location.href;
        await navigator.clipboard.writeText(val);
        log('urlEl: copied to clipboard', { len: val.length });
      }catch(e){ err('urlEl: failed to copy', e); }
      hideSoon();
    });
  }

  document.addEventListener('selectionchange', ()=>{
    const ae = document.activeElement;
    const inField = !!(ae && /input|textarea/i.test(ae.tagName));
    log('event: selectionchange', { activeTag: ae?.tagName, inputOrTextarea: inField });
    if(inField) hideSoon(0);
  });

  if(navigator.share){
    log('init: navigator.share available');
    pop.addEventListener('click', async (e)=>{
      if(e.target.closest('.hs-btn')?.classList.contains('cp')) return;
      if(window.innerWidth<768){
        e.preventDefault();
  const q = lastText || contentEl.textContent || '';
  const u = urlEl.dataset.urlBase || urlEl.textContent || location.href;
  log('share: attempting navigator.share', { title: document.title, textLen: q.length, url: u });
  try{ await navigator.share({ title: document.title, text: q, url: u }); log('share: success'); }catch(ex){ warn('share: canceled or failed', ex); }
        hideSoon(0);
      }
    }, true);
  } else {
    warn('init: navigator.share NOT available');
  }
}