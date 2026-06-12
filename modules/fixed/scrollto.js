/**
 * Smooth in-page scrolling + scroll-spy for the article side navigation.
 *
 * Handles two kinds of links:
 *   a[data-scroll-to="<id>"]           – scroll to the element with that id
 *   a[href^="#"] (not data-scroll-to)  – standard hash links
 * Scrolling routes through ScrollSmoother when present, otherwise GSAP
 * ScrollToPlugin, with a header-height offset auto-measured from the known
 * fixed/sticky nav selectors.
 *
 * setupInnerLinkHighlighting() drives the article table-of-contents:
 * .qs-article-fixed-link-container[data-scroll-to] gets an 'active' class and an
 * animated .qs-article-fixed-highlight as the matching section scrolls into view.
 */
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { myEase } from '../../config/variables.js';

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger, ScrollSmoother);

export function functionLink() {
  function getHeaderOffset() {
    const candidates = [
      '.qs-nav-wrapper',
      '.qs-navbar',
      '.qs-header',
      '.qs-article-topbar',
      '.qs-article-fixed-header'
    ];
    let offset = 0;
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) {
        const styles = window.getComputedStyle(el);
        const isFixedTop = styles.position === 'fixed' && (styles.top === '0px' || styles.top === '0');
        const isStickyTop = styles.position === 'sticky' && (styles.top === '0px' || styles.top === '0');
        if (isFixedTop || isStickyTop) {
          offset = Math.max(offset, el.offsetHeight);
        }
      }
    }
    if (offset === 0) {
      offset = window.innerWidth <= 991 ? 56 : 66;
    }
    return offset;
  }

  function animateScrollTo(target, offsetY = 0, duration = 0.6) {
    const smoother = typeof ScrollSmoother !== 'undefined' && ScrollSmoother.get ? ScrollSmoother.get() : null;
    if (smoother) {
      let y;
      if (typeof target === 'number') {
        y = Math.max(0, target - offsetY);
      } else if (target && target.nodeType === 1) {
        if (typeof smoother.offset === 'function') {
          y = Math.max(0, smoother.offset(target) - offsetY);
        } else {
          const rect = target.getBoundingClientRect();
          y = Math.max(0, rect.top + window.pageYOffset - offsetY);
        }
      } else {
        y = 0;
      }
      smoother.scrollTo(y, duration);
    } else {
      gsap.to(window, {
        duration,
        scrollTo: { y: target, offsetY, autoKill: false },
        ease: myEase
      });
    }
  }

  const scrollLinks = document.querySelectorAll('a[data-scroll-to]');
  
  scrollLinks.forEach(link => {
    const targetId = link.getAttribute('data-scroll-to');
    
    if (!targetId) {
      return;
    }
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const targetElement = document.getElementById(targetId);
      
      if (!targetElement) {
        return;
      }
      animateScrollTo(targetElement, 160, 0.6);
      if (history.pushState) {
        history.pushState(null, null, `#${targetId}`);
      }
    });
  });
  
  const hashLinks = document.querySelectorAll('a[href^="#"]:not([data-scroll-to])');
  
  hashLinks.forEach(link => {
    const href = link.getAttribute('href');
    
    if (!href || href === '#' || href === '') {
      return;
    }
    
    const targetId = href.substring(1);
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const targetElement = document.getElementById(targetId);
      
      if (!targetElement) {
        return;
      }
      animateScrollTo(targetElement, 160, 0.6);
      if (history.pushState) {
        history.pushState(null, null, `#${targetId}`);
      }
    });
  });
  
  function setupInnerLinkHighlighting() {
    const innerLinks = document.querySelectorAll('.qs-article-fixed-link-container[data-scroll-to]');
    
    innerLinks.forEach(link => {
      const targetId = link.getAttribute('data-scroll-to');
      const targetElement = document.getElementById(targetId);
      const highlight = link.querySelector('.qs-article-fixed-highlight');
      
      if (targetElement && highlight) {
        
        link.addEventListener('mouseenter', () => {
          gsap.to(highlight, {
            xPercent: -100,
            duration: 0.4,
            ease: myEase
          });
        });
        
        link.addEventListener('mouseleave', () => {
          const isActive = link.classList.contains('active');
          if (!isActive) {
            gsap.to(highlight, {
              xPercent: 0,
              duration: 0.4,
              ease: myEase
            });
          }
        });
        
        ScrollTrigger.create({
          trigger: targetElement,
          start: "top 180px",
          end: "bottom 100px",
          refreshPriority: -1,
          onEnter: () => {
            document.querySelectorAll('.qs-article-fixed-link-container').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            gsap.to(highlight, {
              xPercent: -100,
              duration: 0.4,
              ease: myEase
            });
          },
          onLeave: () => {
            link.classList.remove('active');
            gsap.to(highlight, {
              xPercent: 0,
              duration: 0.4,
              ease: myEase
            });
          },
          onEnterBack: () => {
            document.querySelectorAll('.qs-article-fixed-link-container').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            gsap.to(highlight, {
              xPercent: -100,
              duration: 0.4,
              ease: myEase
            });
          },
          onLeaveBack: () => {
            link.classList.remove('active');
            gsap.to(highlight, {
              xPercent: 0,
              duration: 0.4,
              ease: myEase
            });
          }
        });
      }
    });
  }

  setTimeout(() => {
    setupInnerLinkHighlighting();
    ScrollTrigger.refresh();
  }, 0);

  return function cleanup() {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  };
}
