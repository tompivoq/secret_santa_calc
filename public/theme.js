// Sets the light/dark theme class before the app renders, so the page never
// flashes the wrong theme. A plain (non-module) script loaded from <head>,
// so it runs before first paint.
//
// Its own file rather than inline in index.html: the Content-Security-Policy
// only allows the app's own script files, and an inline script would need a
// hash that breaks the moment its whitespace changes.
(function () {
	var dark = false;
	try {
		dark =
			localStorage.theme === "dark" ||
			(!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
	} catch {
		// Storage blocked (some private modes): fall back to the system setting.
		dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	}
	document.documentElement.classList.toggle("dark", dark);
})();
