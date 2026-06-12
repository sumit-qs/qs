import gsap from "gsap";
import { myEase } from "./variables.js";

export function functionTransition({
  transitionTriggerSelector = ".s-cover",
  excludedClass = "no-transition",
  introDuration = 500,
  exitDuration = 500,
  disableScrollClass = "no-scroll-transition",
} = {}) {
  const container = document.querySelector('.s-cover');
  const textElement = container?.querySelector('[trigger="loader"]');
  const transitionTrigger = document.querySelector(transitionTriggerSelector);
  
  // Apply theme immediately on function initialization
  const currentTheme = localStorage.getItem("theme") || 
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "theme-dark" : "theme-light");
  document.documentElement.classList.remove("theme-dark", "theme-light");
  document.documentElement.classList.add(currentTheme);
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(currentTheme);
  if (container) {
    container.classList.remove("theme-dark", "theme-light");
    container.classList.add(currentTheme);
    // Set background color inline to prevent flash (use CSS var if available)
    const neutralSurface = getComputedStyle(document.documentElement).getPropertyValue('--neutral-surface-main')?.trim();
    if (neutralSurface) {
      container.style.backgroundColor = neutralSurface;
    } else if (currentTheme === 'theme-dark') {
      container.style.backgroundColor = '#181818'; // fallback dark
    } else {
      container.style.backgroundColor = '#fff'; // fallback light
    }
  }
  
  // Flag to track if custom animation has already run
  let customAnimationPlayed = false;

  if (container) {
    gsap.set(container, { xPercent: 0, display: 'flex' });
    document.body.classList.add(disableScrollClass);

    let progress = 0;
    const duration = 500;
    const intervalTime = 20;
    const increment = 100 / (duration / intervalTime);

    const interval = setInterval(() => {
      if (progress < 100) {
        progress += increment;
      }
      
      if (textElement) {
        textElement.textContent = `${Math.floor(progress)}%`;
      }

      if (progress >= 100) {
        clearInterval(interval);
        
        setTimeout(() => {
          gsap.to(container, {
            xPercent: 100,
            duration: 1,
            ease: myEase,
            onComplete: () => {
              if (textElement) {
                gsap.set(textElement, { display: 'none' });
              }
              gsap.set(container, { display: 'none' });
              
              document.body.classList.remove(disableScrollClass);
              
              gsap.delayedCall(0.1, () => {
                if (window.ScrollTrigger) {
                  window.ScrollTrigger.refresh();
                }
              });
            },
          });
        }, 100);
      }
    }, intervalTime);
  }

  if (transitionTrigger) {
    transitionTrigger.click();
  }
  
  const links = document.querySelectorAll("a");
  
  links.forEach(link => {
    link.addEventListener("click", function(e) {
      const isInternalLink =
        this.hostname === window.location.host &&
        this.getAttribute("href") &&
        this.getAttribute("href").indexOf("#") === -1 &&
        !this.classList.contains(excludedClass) &&
        this.getAttribute("target") !== "_blank";

      if (isInternalLink) {
        e.preventDefault();
        document.body.classList.add(disableScrollClass);
        const transitionURL = this.getAttribute("href");
        
        if (container) {
          // Apply current theme to all elements to prevent white flash
          const currentTheme = localStorage.getItem("theme") || 
            (window.matchMedia("(prefers-color-scheme: dark)").matches ? "theme-dark" : "theme-light");
          // Ensure all elements have the correct theme class immediately
          document.documentElement.classList.remove("theme-dark", "theme-light");
          document.documentElement.classList.add(currentTheme);
          document.body.classList.remove("theme-dark", "theme-light");
          document.body.classList.add(currentTheme);
          container.classList.remove("theme-dark", "theme-light");
          container.classList.add(currentTheme);
          // Set background color inline to prevent flash (use CSS var if available)
          const neutralSurface = getComputedStyle(document.documentElement).getPropertyValue('--neutral-surface-main')?.trim();
          if (neutralSurface) {
            container.style.backgroundColor = neutralSurface;
          } else if (currentTheme === 'theme-dark') {
            container.style.backgroundColor = '#181818';
          } else {
            container.style.backgroundColor = '#fff';
          }
          gsap.set(container, { display: 'flex', xPercent: -100 });
          if (textElement) {
            gsap.set(textElement, { display: 'flex', opacity: 0 });
          }
          gsap.to(container, {
            xPercent: 0,
            duration: 1,
            ease: myEase,
            onComplete: () => {
              if (transitionTrigger) {
                transitionTrigger.click();
              }
              setTimeout(() => {
                window.location = transitionURL;
              }, exitDuration);
            }
          });
        } else {
          if (transitionTrigger) {
            transitionTrigger.click();
          }
          setTimeout(() => {
            window.location = transitionURL;
          }, exitDuration);
        }
      }
    });
  });

  const animationContainer = document.querySelector('.s-container-animation');
  if (animationContainer && !customAnimationPlayed) {
    const logo = document.querySelector('.s-animation-logo');
    const x = document.querySelector('.s-animation-x');
    const gsapEl = document.querySelector('.s-animation-gsap');
    
    if (logo && x && gsapEl) {
      customAnimationPlayed = true;
      gsap.set([logo, gsapEl], {
        yPercent: 100,
        opacity: 0
      });

      gsap.set([x], {
        yPercent: 100,
        opacity: 0,
        rotate: 360,
      });

      
      const loadTl = gsap.timeline({ delay: 1 });
      loadTl.to(logo, {
        yPercent: 0,
        opacity: 1,
        duration: 0.5,
        ease: myEase
      })
      .to(x, {
        yPercent: 0,
        opacity: 1,
        duration: 0.5,
        rotate: 45,
        ease: myEase
      }, "-=0.35")
      .to(gsapEl, {
        yPercent: 0,
        opacity: 1,
        duration: 0.5,
        ease: myEase
      }, "-=0.35");
    }
  }

  window.addEventListener("pageshow", function(event) {
    if (event.persisted) {
      setTimeout(() => {
        window.location.reload();
      }, 10);
    }
  });

  setTimeout(() => {
    window.addEventListener("resize", () => {
      setTimeout(() => {
        const transitionElements = document.querySelectorAll(".transition");
        transitionElements.forEach(element => {
          element.style.display = "none";
        });
      }, 50);
    });
  }, introDuration);
}
