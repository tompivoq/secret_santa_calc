import clsx from "clsx";
import {
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { Button } from "../components/shared/Button";

/*
 * Every class below is written out in full, never assembled from parts:
 * Tailwind only generates the utilities it finds literally in the source,
 * so a class built at runtime would silently render as nothing.
 */

/**
 * Bumped whenever the theme class on <html> changes, so the resolved values
 * shown under each sample follow the light/dark toggle in the top bar.
 */
const ThemeVersion = createContext(0);

const useThemeVersion = () => {
	const [version, setVersion] = useState(0);
	useEffect(() => {
		const observer = new MutationObserver(() => setVersion((v) => v + 1));
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);
	return version;
};

type StyleProperty =
	| "backgroundColor"
	| "borderTopColor"
	| "color"
	| "backgroundImage"
	| "boxShadow";

/** Values a property falls back to when its utility doesn't exist, i.e. the token is broken. */
const UNSET = new Set(["rgba(0, 0, 0, 0)", "none", ""]);

/**
 * What the browser actually resolved `property` to on the referenced
 * element — or null when it fell back to nothing, which is how a class
 * whose token doesn't exist shows up.
 */
const useResolved = (property: StyleProperty) => {
	const ref = useRef<HTMLDivElement>(null);
	const version = useContext(ThemeVersion);
	const [value, setValue] = useState<string | null>(null);

	useLayoutEffect(() => {
		if (!ref.current) return;
		const resolved = getComputedStyle(ref.current)[property];
		setValue(UNSET.has(resolved) ? null : resolved);
	}, [property, version]);

	return { ref, value };
};

/** The resolved value, or a warning when the class produced nothing. */
const Resolved = ({ value, showValue = true }: { value: string | null; showValue?: boolean }) =>
	value === null ? (
		<span className="text-error text-xs font-medium">Ikke defineret</span>
	) : showValue ? (
		<span className="text-text-muted text-xs break-all">{value}</span>
	) : null;

const Section = ({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) => (
	<section className="flex flex-col gap-3">
		<div>
			<h2 className="text-xl">{title}</h2>
			{description && <p className="text-text-muted text-sm">{description}</p>}
		</div>
		<div className="flex flex-wrap gap-4">{children}</div>
	</section>
);

const ColorSwatch = ({ className }: { className: string }) => {
	const { ref, value } = useResolved("backgroundColor");
	return (
		<div className="flex w-32 flex-col gap-1">
			<div ref={ref} className={clsx("border-border-subtle h-16 rounded-md border", className)} />
			<code className="text-xs">{className}</code>
			<Resolved value={value} />
		</div>
	);
};

const BorderSwatch = ({ className }: { className: string }) => {
	const { ref, value } = useResolved("borderTopColor");
	return (
		<div className="flex w-32 flex-col gap-1">
			<div ref={ref} className={clsx("bg-bg-surface h-16 rounded-md border-4", className)} />
			<code className="text-xs">{className}</code>
			<Resolved value={value} />
		</div>
	);
};

const TextSample = ({ className, background }: { className: string; background?: string }) => {
	const { ref, value } = useResolved("color");
	return (
		<div className="flex w-full flex-col gap-1 sm:w-64">
			<div ref={ref} className={clsx("rounded-md p-3", background, className)}>
				Nisserne trækker lod
			</div>
			<code className="text-xs">
				{className}
				{background && ` på ${background}`}
			</code>
			<Resolved value={value} />
		</div>
	);
};

/** For the topbar gradient and shadows, where the resolved value is too long to be worth showing. */
const EffectSample = ({
	className,
	property,
	boxClassName,
}: {
	className: string;
	property: "backgroundImage" | "boxShadow";
	boxClassName?: string;
}) => {
	const { ref, value } = useResolved(property);
	return (
		<div className="flex w-40 flex-col gap-1">
			<div ref={ref} className={clsx("h-20 rounded-lg", boxClassName, className)} />
			<code className="text-xs">{className}</code>
			<Resolved value={value} showValue={false} />
		</div>
	);
};

const BRAND = [
	"bg-brand",
	"bg-brand-dark",
	"bg-brand-light",
	"bg-brand-subtle",
	"bg-brand-foreground",
];

const BRAND_SHADES = [
	"bg-brand-50",
	"bg-brand-100",
	"bg-brand-200",
	"bg-brand-300",
	"bg-brand-400",
	"bg-brand-500",
	"bg-brand-600",
	"bg-brand-700",
	"bg-brand-800",
	"bg-brand-900",
	"bg-brand-950",
];

const ACCENT = [
	"bg-accent",
	"bg-accent-dark",
	"bg-accent-light",
	"bg-accent-subtle",
	"bg-accent-foreground",
];

const NEUTRAL = [
	"bg-neutral-50",
	"bg-neutral-100",
	"bg-neutral-200",
	"bg-neutral-300",
	"bg-neutral-400",
	"bg-neutral-500",
	"bg-neutral-600",
	"bg-neutral-700",
	"bg-neutral-800",
	"bg-neutral-900",
];

const BACKGROUNDS = [
	"bg-bg-page",
	"bg-bg-surface",
	"bg-bg-elevated",
	"bg-bg-sunken",
	"bg-bg-topbar-start",
	"bg-bg-topbar-end",
];

const STATUS = [
	"bg-success",
	"bg-success-light",
	"bg-warning",
	"bg-warning-light",
	"bg-error",
	"bg-error-light",
	"bg-info",
	"bg-info-light",
];

const COMPONENT_COLORS = [
	"bg-button-primary",
	"bg-button-primary-hover",
	"bg-button-primary-text",
	"bg-card-bg",
	"bg-card-border",
	"bg-input-bg",
	"bg-input-border",
	"bg-input-focus",
];

const BORDERS = [
	"border-border",
	"border-border-strong",
	"border-border-subtle",
	"border-border-focus",
];

const SHADOWS = ["shadow-sm", "shadow-md", "shadow-lg", "shadow-xl", "shadow-brand"];

const RADII = [
	"rounded-sm",
	"rounded-md",
	"rounded-lg",
	"rounded-xl",
	"rounded-2xl",
	"rounded-3xl",
	"rounded-full",
];

const FONT_SIZES = [
	"text-xs",
	"text-sm",
	"text-base",
	"text-lg",
	"text-xl",
	"text-2xl",
	"text-3xl",
	"text-4xl",
];

const FONT_WEIGHTS = ["font-normal", "font-medium", "font-bold", "font-black"];

/**
 * Every token the theme in index.css defines, rendered with the utility
 * class that uses it. Values are read back from the browser, so switching
 * theme in the top bar shows the dark values, and a token that doesn't
 * resolve to anything is flagged rather than quietly showing a blank box.
 */
export const StyleGuide = () => {
	const version = useThemeVersion();

	return (
		<ThemeVersion.Provider value={version}>
			<div className="mt-8 flex w-full flex-col gap-10 text-left">
				<div>
					<h1 className="text-3xl">Style guide</h1>
					<p className="text-text-muted text-sm">
						Alle farver og tokens fra temaet i <code>index.css</code>. Skift mellem lyst og mørkt
						tema i topbaren for at se begge sæt værdier.
					</p>
				</div>

				<Section title="Brand">
					{BRAND.map((className) => (
						<ColorSwatch key={className} className={className} />
					))}
				</Section>

				<Section title="Brand-nuancer" description="Samme i begge temaer.">
					{BRAND_SHADES.map((className) => (
						<ColorSwatch key={className} className={className} />
					))}
				</Section>

				<Section title="Accent">
					{ACCENT.map((className) => (
						<ColorSwatch key={className} className={className} />
					))}
				</Section>

				<Section title="Neutral">
					{NEUTRAL.map((className) => (
						<ColorSwatch key={className} className={className} />
					))}
				</Section>

				<Section title="Baggrunde">
					{BACKGROUNDS.map((className) => (
						<ColorSwatch key={className} className={className} />
					))}
				</Section>

				<Section title="Tekst">
					<TextSample className="text-text-heading" />
					<TextSample className="text-text-body" />
					<TextSample className="text-text-muted" />
					<TextSample className="text-text-inverse" background="bg-text-body" />
					<TextSample className="text-text-link" />
					<TextSample className="text-brand-foreground" background="bg-brand" />
					<TextSample className="text-accent-foreground" background="bg-accent" />
				</Section>

				<Section title="Kanter">
					{BORDERS.map((className) => (
						<BorderSwatch key={className} className={className} />
					))}
				</Section>

				<Section title="Status">
					{STATUS.map((className) => (
						<ColorSwatch key={className} className={className} />
					))}
				</Section>

				<Section
					title="Komponent-tokens"
					description="Semantiske aliaser for knapper, kort og inputfelter."
				>
					{COMPONENT_COLORS.map((className) => (
						<ColorSwatch key={className} className={className} />
					))}
				</Section>

				<Section title="Topbar-gradient" description="Bygget af de to topbar-baggrundsfarver.">
					<EffectSample
						className="from-bg-topbar-start to-bg-topbar-end bg-linear-to-r"
						property="backgroundImage"
					/>
				</Section>

				<Section title="Skygger">
					{SHADOWS.map((className) => (
						<EffectSample
							key={className}
							className={className}
							property="boxShadow"
							boxClassName="bg-bg-surface"
						/>
					))}
				</Section>

				<Section title="Hjørner">
					{RADII.map((className) => (
						<div key={className} className="flex w-24 flex-col gap-1">
							<div className={clsx("bg-accent-light h-16 w-16", className)} />
							<code className="text-xs">{className}</code>
						</div>
					))}
				</Section>

				<section className="flex flex-col gap-3">
					<h2 className="text-xl">Typografi</h2>
					<div className="flex flex-col gap-2">
						{FONT_SIZES.map((className) => (
							<p key={className} className={clsx("flex items-baseline gap-4", className)}>
								<code className="text-text-muted w-20 shrink-0 text-xs">{className}</code>
								God jul fra nisserne
							</p>
						))}
					</div>
					<div className="flex flex-col gap-2">
						{FONT_WEIGHTS.map((className) => (
							<p key={className} className={clsx("flex items-baseline gap-4 text-lg", className)}>
								<code className="text-text-muted w-20 shrink-0 text-xs font-normal">
									{className}
								</code>
								God jul fra nisserne
							</p>
						))}
					</div>
					<div className="flex flex-col gap-1">
						<h1 className="text-3xl">Overskrift h1</h1>
						<h2 className="text-xl">Overskrift h2</h2>
						<h3 className="text-lg">Overskrift h3</h3>
						<p>
							Brødtekst med et <a href="#">link</a> i.
						</p>
					</div>
				</section>

				<Section title="Knapper">
					<Button behaviour="neutral">Neutral</Button>
					<Button behaviour="action">Action</Button>
					<Button behaviour="destructive">Destructive</Button>
					<Button behaviour="neutral" disabled>
						Neutral (deaktiveret)
					</Button>
					<Button behaviour="action" disabled>
						Action (deaktiveret)
					</Button>
					<Button behaviour="destructive" disabled>
						Destructive (deaktiveret)
					</Button>
				</Section>

				<Section title="Kort og felter">
					<div className="bg-card-bg border-card-border flex w-full flex-col gap-3 rounded-xl border p-5 shadow-sm sm:w-80">
						<h3 className="text-lg">Et kort</h3>
						<label className="flex flex-col gap-1 text-sm">
							Navn
							<input
								type="text"
								placeholder="Julenissen"
								className="bg-input-bg border-input-border focus:border-input-focus rounded-md border px-3 py-1.5 outline-none"
							/>
						</label>
						<p className="text-text-muted text-sm">Hjælpetekst under et felt.</p>
						<p className="text-error text-sm">En fejlbesked.</p>
						<div className="flex justify-end gap-2">
							<Button behaviour="neutral">Fortryd</Button>
							<Button behaviour="action">Gem</Button>
						</div>
					</div>
				</Section>
			</div>
		</ThemeVersion.Provider>
	);
};
