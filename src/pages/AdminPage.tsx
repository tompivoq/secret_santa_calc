import PersonForm from "../components/PersonForm";
import PersonList from "../components/PersonList";

function AdminPage() {
	return (
		<>
			<p>Enter a list of people and randomly assign each one a secret santa.</p>

			<PersonForm />

			<PersonList />
		</>
	);
}

export default AdminPage;
