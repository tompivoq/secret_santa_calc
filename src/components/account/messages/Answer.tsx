import { formatDate } from "./shared";

export const Answer = ({ answer, answeredAt }: { answer: string; answeredAt: string | null }) => (
	<div className="border-l-2 pl-3">
		<p className="text-text-muted text-xs">Svar{answeredAt && ` d. ${formatDate(answeredAt)}`}</p>
		<p className="whitespace-pre-wrap">{answer}</p>
	</div>
);
