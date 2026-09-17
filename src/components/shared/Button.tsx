import clsx from "clsx";
import type { ComponentProps } from "react";

type Behavior = "neutral" | "action" | "destructive";

const getClassNamesForBehaviour = (behaviour: Behavior, disabled: boolean = false) => {
	switch (behaviour) {
		case "neutral":
			return clsx("border-metallic-gold-600 text-white", {
				"hover:border-metallic-gold-400": !disabled,
			});
		case "action":
			return clsx("border-metallic-gold-600 bg-metallic-gold-800 text-white", {
				"hover:bg-metallic-gold-400": !disabled,
			});
		case "destructive":
			return clsx("border-oxblood-600 bg-oxblood-700 text-blue-spruce-200", {
				"hover:bg-oxblood-500": !disabled,
			});
		default:
			break;
	}
};

interface ButtonProps extends ComponentProps<"button"> {
	behaviour: Behavior;
}

export const Button = ({ className, behaviour = "neutral", ...props }: ButtonProps) => {
	return (
		<button
			type="button"
			className={clsx(
				"flex flex-row items-center gap-2",
				"w-fit cursor-pointer rounded-md border",
				getClassNamesForBehaviour(behaviour, props.disabled),
				"px-3 py-1.5 text-sm",
				"disabled:cursor-default disabled:opacity-60",
				className,
			)}
			{...props}
		/>
	);
};

interface SaveButtonProps {
	isLoading: boolean;
	isFormValid: boolean;
}
export const SaveButton = ({ isLoading, isFormValid }: SaveButtonProps) => (
	<Button type="submit" behaviour="action" disabled={!isFormValid || isLoading}>
		{isLoading ? "Gemmer..." : "Gem ændringer"}
	</Button>
);

interface CancelButtonProps {
	onCancel: () => void;
}
export const CancelButton = ({ onCancel }: CancelButtonProps) => (
	<Button type="button" behaviour="neutral" onClick={onCancel}>
		Fortryd
	</Button>
);

type FormActionButtonsProps = SaveButtonProps & CancelButtonProps;

export const FormActionButtons = ({ onCancel, isFormValid, isLoading }: FormActionButtonsProps) => (
	<div className="flex flex-row justify-end gap-2">
		<CancelButton onCancel={onCancel} />
		<SaveButton isLoading={isLoading} isFormValid={isFormValid} />
	</div>
);
