import clsx from "clsx";
import type { ComponentProps } from "react";

type Behavior = "neutral" | "action" | "destructive";

const getClassNamesForBehaviour = (behaviour: Behavior) => {
     switch (behaviour) {
        case "neutral":
            return clsx("border-metallic-gold-600 hover:border-metallic-gold-400 text-white");
        case "action":
            return clsx("border-metallic-gold-600 bg-metallic-gold-800 hover:bg-metallic-gold-400 text-white");
        case "destructive":
            return clsx("border-oxblood-600 bg-oxblood-700 hover:bg-oxblood-500 text-blue-spruce-200");
        default:
            break;
    }
}

interface ButtonProps extends ComponentProps<"button"> {
    behaviour: Behavior;
}

export const Button = ({className, behaviour = "neutral", ...props}: ButtonProps) => {
    return (
        <button
            type="button"
            className={clsx(
                "w-fit cursor-pointer rounded-md border",
                getClassNamesForBehaviour(behaviour),
                "px-3 py-1.5 text-sm",
                className
            )}
            {...props}
         />
    )
}