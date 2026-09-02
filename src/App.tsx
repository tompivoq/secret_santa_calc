import { useState } from 'react';
import PersonForm from './components/PersonForm';
import PersonList from './components/PersonList';
import type { Person } from './models/person';
import { removePerson, setPartner } from './utils/person_utils';

function App() {
  const [people, setPeople] = useState<Person[]>([]);

  const handleAddPerson = (person: Person) => {
    const withNewPerson = [...people, person];
    setPeople(person.partnerId === undefined ? withNewPerson : setPartner(withNewPerson, person.id, person.partnerId));
  };

  const handleRemovePerson = (personId: number) => {
    setPeople(removePerson(people, personId));
  };

  const handleSetPartner = (personId: number, partnerId: number | null) => {
    setPeople(setPartner(people, personId, partnerId));
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-center">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">
        Secret Santa Calculator
      </h1>
      <p>Enter a list of people and randomly assign each one a secret santa.</p>

      <PersonForm people={people} onAddPerson={handleAddPerson} />

      <PersonList people={people} onRemovePerson={handleRemovePerson} onSetPartner={handleSetPartner} />
    </main>
  );
}

export default App;
