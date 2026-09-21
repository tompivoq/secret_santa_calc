import { useState, type SubmitEvent } from "react";
import { useAnswerMutation, type ReceivedQuestion } from "../../../store/messagesApi";
import { Button } from "../../shared";
import { fieldClassName, formatDate, MAX_MESSAGE_LENGTH } from "./shared";
import { Answer } from "./Answer";

interface AnswerFormProps {
	message: ReceivedQuestion;
}

const AnswerForm = ({ message }: AnswerFormProps) => {
	const [answerQuestion, { error, isLoading }] = useAnswerMutation();
	const [answer, setAnswer] = useState("");

	const [formOpen, setFormOpen] = useState(false);

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		void answerQuestion({ id: message.id, answer: answer.trim() });
	};

	return formOpen ? (
		<form onSubmit={submit} className="flex flex-col gap-2">
			<label className="flex flex-col gap-1">
				Dit svar
				<textarea
					value={answer}
					onChange={(event) => setAnswer(event.target.value)}
					maxLength={MAX_MESSAGE_LENGTH}
					rows={2}
					className={fieldClassName}
				/>
			</label>
			<div className="flex flex-row flex-wrap items-center justify-end gap-3">
				<span className="text-text-muted text-xs">Du kan kun svare én gang.</span>
				{error && <p className="text-error text-sm">Kunne ikke sende svaret. Prøv igen.</p>}
				<Button behaviour="neutral" onClick={() => setFormOpen(!formOpen)}>
					Annuller
				</Button>
				<Button type="submit" behaviour="action" disabled={isLoading || answer.trim().length === 0}>
					{isLoading ? "Sender…" : "Send svar"}
				</Button>
			</div>
		</form>
	) : (
		<Button behaviour="neutral" onClick={() => setFormOpen(!formOpen)}>
			Skriv svar
		</Button>
	);
};

/**
 * A question you were asked, and the one answer you can give. Deliberately
 * shows nothing about who asked — there's nothing to show; the server
 * never sends it.
 */
export const ReceivedItem = ({ message }: { message: ReceivedQuestion }) => (
	<li className="bg-bg-elevated flex flex-col gap-2 rounded-xl border p-4 text-sm">
		<p className="text-text-muted text-xs">Anonymt spørgsmål d. {formatDate(message.askedAt)}</p>
		<p className="whitespace-pre-wrap">{message.question}</p>
		{message.answer !== null ? (
			<Answer answer={message.answer} answeredAt={message.answeredAt} />
		) : (
			<AnswerForm message={message} />
		)}
	</li>
);
