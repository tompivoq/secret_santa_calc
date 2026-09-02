import PersonForm from "./components/PersonForm";
import PersonList from "./components/PersonList";

function App() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-center">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">
        Secret Santa Calculator
      </h1>
      <p>Enter a list of people and randomly assign each one a secret santa.</p>

      <PersonForm />

      <PersonList />
    </main>
  );
}

export default App;
