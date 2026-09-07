import clsx from "clsx";

interface ColorSampleProps {
    step: string;
    darkText: boolean;
    colorClassName: string;
}

const ColorSample = ({step, darkText, colorClassName}: ColorSampleProps) => {
    return (
        <div className={clsx("w-20 h-20", colorClassName, {
            "text-black": darkText,
            "text-white": !darkText
        })}>
            <span className="text-sm">{step}</span>
        </div>
    );
};

export const StyleGuide = () => {
    return (
		<>
            <div className="flex flex-col w-full gap-5">
                <div className="flex flex-row w-full gap-2">
                    <span>Oxblood</span>
                    <ColorSample step="50" darkText={true} colorClassName="bg-oxblood-50" />
                    <ColorSample step="100" darkText={true} colorClassName="bg-oxblood-100" />
                    <ColorSample step="200" darkText={true} colorClassName="bg-oxblood-200" />
                    <ColorSample step="300" darkText={true} colorClassName="bg-oxblood-300" />
                    <ColorSample step="400" darkText={true} colorClassName="bg-oxblood-400" />
                    <ColorSample step="500" darkText={false} colorClassName="bg-oxblood-500" />
                    <ColorSample step="600" darkText={false} colorClassName="bg-oxblood-600" />
                    <ColorSample step="700" darkText={false} colorClassName="bg-oxblood-700" />
                    <ColorSample step="800" darkText={false} colorClassName="bg-oxblood-800" />
                    <ColorSample step="900" darkText={false} colorClassName="bg-oxblood-900" />
                    <ColorSample step="950" darkText={false} colorClassName="bg-oxblood-950" />
                </div>
                <div className="flex flex-row gap-2">
                    <span>blue-spruce</span>
                    <ColorSample step="50" darkText={true} colorClassName="bg-blue-spruce-50" />
                    <ColorSample step="100" darkText={true} colorClassName="bg-blue-spruce-100" />
                    <ColorSample step="200" darkText={true} colorClassName="bg-blue-spruce-200" />
                    <ColorSample step="300" darkText={true} colorClassName="bg-blue-spruce-300" />
                    <ColorSample step="400" darkText={true} colorClassName="bg-blue-spruce-400" />
                    <ColorSample step="500" darkText={false} colorClassName="bg-blue-spruce-500" />
                    <ColorSample step="600" darkText={false} colorClassName="bg-blue-spruce-600" />
                    <ColorSample step="700" darkText={false} colorClassName="bg-blue-spruce-700" />
                    <ColorSample step="800" darkText={false} colorClassName="bg-blue-spruce-800" />
                    <ColorSample step="900" darkText={false} colorClassName="bg-blue-spruce-900" />
                    <ColorSample step="950" darkText={false} colorClassName="bg-blue-spruce-950" />
                </div>
                <div className="flex flex-row gap-2">
                    <span>pearl-aqua</span>
                    <ColorSample step="50" darkText={true} colorClassName="bg-pearl-aqua-50" />
                    <ColorSample step="100" darkText={true} colorClassName="bg-pearl-aqua-100" />
                    <ColorSample step="200" darkText={true} colorClassName="bg-pearl-aqua-200" />
                    <ColorSample step="300" darkText={true} colorClassName="bg-pearl-aqua-300" />
                    <ColorSample step="400" darkText={true} colorClassName="bg-pearl-aqua-400" />
                    <ColorSample step="500" darkText={false} colorClassName="bg-pearl-aqua-500" />
                    <ColorSample step="600" darkText={false} colorClassName="bg-pearl-aqua-600" />
                    <ColorSample step="700" darkText={false} colorClassName="bg-pearl-aqua-700" />
                    <ColorSample step="800" darkText={false} colorClassName="bg-pearl-aqua-800" />
                    <ColorSample step="900" darkText={false} colorClassName="bg-pearl-aqua-900" />
                    <ColorSample step="950" darkText={false} colorClassName="bg-pearl-aqua-950" />
                </div>
                <div className="flex flex-row gap-2">
                    <span>metallic-gold</span>
                    <ColorSample step="50" darkText={true} colorClassName="bg-metallic-gold-50" />
                    <ColorSample step="100" darkText={true} colorClassName="bg-metallic-gold-100" />
                    <ColorSample step="200" darkText={true} colorClassName="bg-metallic-gold-200" />
                    <ColorSample step="300" darkText={true} colorClassName="bg-metallic-gold-300" />
                    <ColorSample step="400" darkText={true} colorClassName="bg-metallic-gold-400" />
                    <ColorSample step="500" darkText={false} colorClassName="bg-metallic-gold-500" />
                    <ColorSample step="600" darkText={false} colorClassName="bg-metallic-gold-600" />
                    <ColorSample step="700" darkText={false} colorClassName="bg-metallic-gold-700" />
                    <ColorSample step="800" darkText={false} colorClassName="bg-metallic-gold-800" />
                    <ColorSample step="900" darkText={false} colorClassName="bg-metallic-gold-900" />
                    <ColorSample step="950" darkText={false} colorClassName="bg-metallic-gold-950" />
                </div>
                <div className="flex flex-row gap-2">
                    <span>ink-black</span>
                    <ColorSample step="50" darkText={true} colorClassName="bg-ink-black-50" />
                    <ColorSample step="100" darkText={true} colorClassName="bg-ink-black-100" />
                    <ColorSample step="200" darkText={true} colorClassName="bg-ink-black-200" />
                    <ColorSample step="300" darkText={true} colorClassName="bg-ink-black-300" />
                    <ColorSample step="400" darkText={true} colorClassName="bg-ink-black-400" />
                    <ColorSample step="500" darkText={false} colorClassName="bg-ink-black-500" />
                    <ColorSample step="600" darkText={false} colorClassName="bg-ink-black-600" />
                    <ColorSample step="700" darkText={false} colorClassName="bg-ink-black-700" />
                    <ColorSample step="800" darkText={false} colorClassName="bg-ink-black-800" />
                    <ColorSample step="900" darkText={false} colorClassName="bg-ink-black-900" />
                    <ColorSample step="950" darkText={false} colorClassName="bg-ink-black-950" />
                </div>
            </div>
		</>
	);
}