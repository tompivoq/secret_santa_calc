import { useState, type SubmitEvent } from "react";
import { useAskMutation } from "../../../store/messagesApi";
import { Button } from "../../shared";
import { fieldClassName, MAX_MESSAGE_LENGTH } from "./shared";

/** Asking your recipient, or their partner, something without saying who's asking. */
export const AskForm = ({ canAsk }: { canAsk: { id: number; name: string }[] }) => {
	const [ask, { data: result, error, isLoading, reset }] = useAskMutation();
	const [recipientId, setRecipientId] = useState(canAsk[0]!.id);
	const [question, setQuestion] = useState("");

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		try {
			await ask({ recipientId, question: question.trim() }).unwrap();
			setQuestion("");
		} catch {
			// Shown below from the mutation's own error state.
		}
	};

	return (
		<form onSubmit={submit} className="flex flex-col gap-3">
			<h3 className="text-base">Stil et anonymt spørgsmål</h3>
			<p className="text-text-muted text-sm">
				Spørg f.eks. hvornår de har tid, hvis du overvejer at give en oplevelse. Den du spørger kan
				ikke se hvem spørgsmålet kommer fra.
			</p>

			{canAsk.length > 1 && (
				<label className="flex flex-col gap-1 text-sm">
					Til
					<select
						value={recipientId}
						onChange={(event) => setRecipientId(Number(event.target.value))}
						className={fieldClassName}
					>
						{canAsk.map((person) => (
							<option key={person.id} value={person.id}>
								{person.name}
							</option>
						))}
					</select>
				</label>
			)}

			<label className="flex flex-col gap-1 text-sm">
				{canAsk.length > 1 ? "Spørgsmål" : `Spørgsmål til ${canAsk[0]!.name}`}
				<textarea
					value={question}
					onChange={(event) => {
						setQuestion(event.target.value);
						// A new question shouldn't sit under the last one's "sent".
						if (result) reset();
					}}
					maxLength={MAX_MESSAGE_LENGTH}
					rows={3}
					className={fieldClassName}
				/>
			</label>

			<div className="flex flex-row flex-wrap items-center justify-end gap-3">
				{result && <p className="text-sm">Spørgsmålet er sendt.</p>}
				{error && <p className="text-error text-sm">Kunne ikke sende spørgsmålet. Prøv igen.</p>}
				<Button
					type="submit"
					behaviour="action"
					disabled={isLoading || question.trim().length === 0}
				>
					{isLoading ? "Sender…" : "Send spørgsmål"}
				</Button>
			</div>
		</form>
	);
};
