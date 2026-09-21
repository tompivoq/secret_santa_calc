import type { SentQuestion } from "../../../store/messagesApi";
import { Answer } from "./Answer";
import { formatDate } from "./shared";

export const SentItem = ({ message }: { message: SentQuestion }) => (
	<li className="bg-bg-elevated flex flex-col gap-2 rounded-xl border p-4 text-sm">
		<p className="text-text-muted text-xs">
			Til {message.to.name} d. {formatDate(message.askedAt)}
		</p>
		<p className="whitespace-pre-wrap">{message.question}</p>
		{message.answer !== null ? (
			<Answer answer={message.answer} answeredAt={message.answeredAt} />
		) : (
			<p className="text-text-muted text-xs">Venter på svar</p>
		)}
	</li>
);
