/**
 * Search overlay open/close animation.
 * Hooks: .qs-search-open / .qs-search-close (buttons), .qs-search-wrapper
 * (scales in horizontally), .qs-search-container (slides up), .qs-search-input
 * (auto-focused on open). Escape closes. Returns { openSearch, closeSearch }.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

// Exportable function to handle search open/close animations
export function functionToggleSearch() {
	if (typeof gsap === "undefined") return;

	const openButtons = document.querySelectorAll(".qs-search-open");
	const closeButtons = document.querySelectorAll(".qs-search-close");
	const wrapper = document.querySelector(".qs-search-wrapper");
	const container = document.querySelector(".qs-search-container");

	if (!wrapper || !container) return;

	// Initial state
	gsap.set(wrapper, { scaleX: 0 });
	gsap.set(container, { yPercent: 0 });

	function openSearch(e) {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}

		gsap.killTweensOf([wrapper, container]);

		const tl = gsap.timeline();
		tl.set(wrapper, { display: "block" })
			.to(wrapper, {
				scaleX: 1,
				duration: 0.3,
				ease: myEase,
			})
			.fromTo(
				container,
				{ yPercent: 100 },
				{ yPercent: 0, duration: 0.28, ease: myEase }
			)
			.add(() => {
				const input = wrapper.querySelector(".qs-search-input") || document.querySelector(".qs-search-input");
				if (input) {
					try {
						input.focus({ preventScroll: true });
						if (typeof input.select === "function") input.select();
					} catch (_) {
						input.focus();
					}
				}
			});
	}

	function closeSearch(e) {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}

		gsap.killTweensOf([wrapper, container]);

		// Blur input if present (helps dismiss mobile keyboard)
		const input = wrapper.querySelector(".qs-search-input") || document.querySelector(".qs-search-input");
		if (input && typeof input.blur === "function") input.blur();

		const tl = gsap.timeline({
			onComplete: () => {
				gsap.set(wrapper, { display: "none" });
			},
		});

		tl.to(container, {
			yPercent: 100,
			duration: 0.25,
			ease: myEase,
		}).to(wrapper, {
			scaleX: 0,
			duration: 0.28,
			ease: myEase,
		});
	}

	openButtons.forEach((btn) => btn.addEventListener("click", openSearch));
	closeButtons.forEach((btn) => btn.addEventListener("click", closeSearch));

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeSearch();
		}
	});

	return { openSearch, closeSearch };
}

