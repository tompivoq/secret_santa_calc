import { useState } from "react";
import PersonForm from "../components/PersonForm";
import PersonList from "../components/PersonList";
import { FaChevronDown } from "react-icons/fa6";

function AdminPage() {
	const [formOpen, setFormOpen] = useState(false);

	return (
		<>
			<p>Enter a list of people and randomly assign each one a secret santa.</p>

			<div className="flex flex-col h-fit rounded-xl border border-gray-400 p-5 transition-[height] duration-300 ease-in-out">
				<div className="flex flex-row items-center" onClick={() => setFormOpen((prev) => !prev)}>
					<h3 className="flex text-lg grow">Add people</h3>
					<FaChevronDown data-active={formOpen} className="size-5 transition-transform duration-300 ease-in-out data-[active=true]:rotate-180"/>
				</div>
				{
					formOpen &&
						<PersonForm />
				}
			</div>

			<PersonList />
		</>
	);
}

export default AdminPage;
