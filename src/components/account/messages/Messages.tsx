import { useInboxQuery } from "../../../store/messagesApi";
import { AskForm } from "./AskForm";
import { ReceivedItem } from "./ReceivedItem";
import { SentItem } from "./SentItem";

/**
 * Anonymous questions between a giver and their recipient, or the
 * recipient's partner. Hidden entirely until the draw is locked in.
 */
export const Messages = () => {
	const { data: inbox } = useInboxQuery();

	if (!inbox?.open) {
		return null;
	}

	const nothingHere =
		inbox.canAsk.length === 0 && inbox.sent.length === 0 && inbox.received.length === 0;
	if (nothingHere) {
		return null;
	}

	return (
		<section
			aria-labelledby="messages-heading"
			className="flex flex-col gap-4 rounded-xl border p-5"
		>
			<h2 id="messages-heading" className="text-lg">
				Beskeder
			</h2>

			{inbox.received.length > 0 && (
				<div className="flex flex-col gap-2">
					<h3 className="text-base">Spørgsmål til dig</h3>
					<ul className="flex flex-col gap-2">
						{inbox.received.map((message) => (
							<ReceivedItem key={message.id} message={message} />
						))}
					</ul>
				</div>
			)}

			{inbox.canAsk.length > 0 && <AskForm canAsk={inbox.canAsk} />}

			{inbox.sent.length > 0 && (
				<div className="flex flex-col gap-2">
					<h3 className="text-base">Dine spørgsmål</h3>
					<ul className="flex flex-col gap-2">
						{inbox.sent.map((message) => (
							<SentItem key={message.id} message={message} />
						))}
					</ul>
				</div>
			)}
		</section>
	);
};
