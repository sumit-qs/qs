/**
 * Makes the conference inner-nav sticky and marks the current-page link active.
 *
 * Re-parents .qs-inner-nav-wrapper / .qs-conference-header to <body> and pins it
 * to the top (position:fixed) — done in JS because ScrollSmoother's transformed
 * content breaks CSS position:fixed. On mobile (<=991px) it also pins
 * .conference-info to the bottom. A MutationObserver waits for the nav in case
 * Webflow renders it late. setActiveLink() adds Webflow's w--current /
 * aria-current to the link whose href matches the current path (and handles
 * Webflow's href="#" self-links inside CMS nav components).
 */
export function functionConference() {

	function applySticky(nav) {
		if (nav.parentElement !== document.body) {
			document.body.appendChild(nav);
		}

		nav.style.cssText = 'position:fixed !important; top:0 !important; left:0 !important; width:100% !important; z-index:9999 !important; transform:none !important;';

		function setActiveLink() {
			const currentPath = window.location.pathname.replace(/\/$/, '');
			const navLinks = nav.querySelectorAll('.qs-inner-nav-link');
			const exactMatches = Array.from(navLinks).filter(link => {
				const href = link.getAttribute('href');
				if (!href || href === '#') {
					return false;
				}

				const normalizedLinkPath = new URL(href, window.location.origin).pathname.replace(/\/$/, '');
				return normalizedLinkPath === currentPath;
			});

			navLinks.forEach(link => {
				const linkPath = link.getAttribute('href')?.replace(/\/$/, '') ?? '';
				// Webflow sets href="#" on the current-page link inside CMS components
				// (to avoid navigating to the same page). Only use "#" as a fallback
				// when there is no real pathname match in the navigation.
				const normalizedLinkPath = linkPath && linkPath !== '#'
					? new URL(linkPath, window.location.origin).pathname.replace(/\/$/, '')
					: linkPath;
				const isActive = normalizedLinkPath === '#'
					? exactMatches.length === 0
					: Boolean(normalizedLinkPath) && currentPath === normalizedLinkPath;

				if (isActive) {
					link.classList.add('w--current');
					link.setAttribute('aria-current', 'page');
				} else {
					link.classList.remove('w--current');
					link.removeAttribute('aria-current');
				}
			});
		}

		setActiveLink();
		setTimeout(setActiveLink, 300);
	}

	function applyConferenceInfoSticky(el) {
		if (el.parentElement !== document.body) {
			document.body.appendChild(el);
		}

		el.style.cssText = 'position:fixed !important; bottom:0 !important; left:0 !important; width:100% !important; z-index:9998 !important; transform:none !important;';
	}

	// Sticky top nav — all breakpoints
	const nav = document.querySelector('.qs-inner-nav-wrapper, .qs-conference-header');

	if (nav) {
		applySticky(nav);
	} else {
		const navObserver = new MutationObserver(() => {
			const el = document.querySelector('.qs-inner-nav-wrapper, .qs-conference-header');
			if (el) {
				navObserver.disconnect();
				applySticky(el);
			}
		});
		navObserver.observe(document.body, { childList: true, subtree: true });
	}

	// Sticky bottom .conference-info — mobile only (≤991px)
	if (window.innerWidth <= 991) {
		const info = document.querySelector('.conference-info');

		if (info) {
			applyConferenceInfoSticky(info);
		} else {
			const infoObserver = new MutationObserver(() => {
				const el = document.querySelector('.conference-info');
				if (el) {
					infoObserver.disconnect();
					applyConferenceInfoSticky(el);
				}
			});
			infoObserver.observe(document.body, { childList: true, subtree: true });
		}
	}
}



