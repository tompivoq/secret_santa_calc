import clsx from "clsx";
import { useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa6";

interface ThemeToggleProps {
	className?: string;
}

export const ThemeToggle = ({ className }: ThemeToggleProps) => {
	// Read straight from <html> on first render: the inline script in
	// index.html has already set the class before React starts, and there's
	// no server render to mismatch — so no effect, and no placeholder frame.
	const [theme, setTheme] = useState<"light" | "dark">(() =>
		document.documentElement.classList.contains("dark") ? "dark" : "light",
	);

	const isDarkMode = theme === "dark";

	const toggleTheme = () => {
		const nextTheme = theme === "light" ? "dark" : "light";
		const root = document.documentElement;

		if (nextTheme === "dark") {
			root.classList.add("dark");
			localStorage.theme = "dark";
			setTheme("dark");
		} else {
			root.classList.remove("dark");
			localStorage.theme = "light";
			setTheme("light");
		}
	};

	return (
		<button
			onClick={toggleTheme}
			aria-label="Toggle Theme"
			title={isDarkMode ? "Lightmode" : "Darkmode"}
			className={clsx(
				"p-2.5 rounded-xl text-brand-foreground hover:scale-105 transition-all shadow-sm cursor-pointer",
				className,
			)}
		>
			{isDarkMode ? <FaSun className="size-4" /> : <FaMoon className="size-4" />}
		</button>
	);
};
