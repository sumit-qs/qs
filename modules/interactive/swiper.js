/**
 * Initialises Swiper.js sliders — one instance per `.swiper` element.
 * Controls are scoped to the nearest `.swiper-wrap` (or the parent): `.nav.next`
 * / `.nav.prev`, `.swiper-pagination`, `.swiper-scrollbar` — each optional and
 * only wired up when found. Every Swiper module is bundled in; defaults are
 * loop, slidesPerView:'auto', autoplay. Swiper's CSS is imported here and ends
 * up in scripts.min.css (see also the standalone swiper.min.css).
 */
import { Swiper } from 'swiper'
import {
  Navigation, Pagination, Scrollbar, Autoplay, Keyboard, Mousewheel, Parallax,
  EffectFade, EffectCube, EffectFlip, EffectCoverflow, EffectCards, Thumbs,
  FreeMode, Grid, Manipulation, Zoom, Controller, A11y, History, HashNavigation, Virtual
} from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/scrollbar'

export function functionSwiper() {
  const swiperElements = document.querySelectorAll('.swiper')
  if (!swiperElements.length) return

  swiperElements.forEach((swiperElement) => {
  // Scope controls to the instance wrapper/element only (no global fallbacks)
  const wrap = swiperElement.closest('.swiper-wrap') || swiperElement.parentElement
  const nextEl = wrap ? wrap.querySelector('.nav.next') : swiperElement.querySelector('.nav.next')
  const prevEl = wrap ? wrap.querySelector('.nav.prev') : swiperElement.querySelector('.nav.prev')
  const paginationEl = wrap ? wrap.querySelector('.swiper-pagination') : swiperElement.querySelector('.swiper-pagination')
  const scrollbarEl  = wrap ? wrap.querySelector('.swiper-scrollbar')  : swiperElement.querySelector('.swiper-scrollbar')

    new Swiper(swiperElement, {
      modules: [
        Navigation, Pagination, Scrollbar, Autoplay, Keyboard, Mousewheel, Parallax,
        EffectFade, EffectCube, EffectFlip, EffectCoverflow, EffectCards, Thumbs,
        FreeMode, Grid, Manipulation, Zoom, Controller, A11y, History, HashNavigation, Virtual
      ],
      direction: 'horizontal',
      loop: true,
      slidesPerView: 'auto',
      watchSlidesProgress: true,
      grabCursor: true,
      keyboard: { enabled: true, onlyInViewport: true },
      mousewheel: { enabled: true, forceToAxis: true },
      parallax: true,
      effect: 'slide',
      speed: 600,
      autoplay: { delay: 3000, pauseOnMouseEnter: true, disableOnInteraction: false },
      pagination: paginationEl ? { el: paginationEl, clickable: true, type: 'bullets', dynamicBullets: true } : undefined,
      navigation: (prevEl && nextEl) ? { prevEl, nextEl } : undefined,
      scrollbar: scrollbarEl ? { el: scrollbarEl, draggable: true } : undefined,
      on: {
        init() { this.slides.forEach(slide => (slide.style.display = 'flex')) },
        slideChangeTransitionEnd() { this.slides.forEach(slide => (slide.style.display = 'flex')) }
      }
    })
  })
}