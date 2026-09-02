/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';

const addPerson = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  email: string,
  partnerName?: string,
) => {
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Email'), email);
  if (partnerName) {
    await user.selectOptions(screen.getByLabelText('Partner', { selector: '#partner' }), partnerName);
  }
  await user.click(screen.getByRole('button', { name: 'Add Person' }));
};

describe('App: partner selection reciprocity', () => {
  it('shows the partner selected when creating a new person on the existing person too', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addPerson(user, 'Bjørn', 'bjorn@example.com');
    await addPerson(user, 'Anna', 'anna@example.com', 'Bjørn');

    const bjornPartnerSelect = screen.getByLabelText('Partner', { selector: '#partner-0' }) as HTMLSelectElement;
    expect(bjornPartnerSelect.value).toBe('1');

    const annaPartnerSelect = screen.getByLabelText('Partner', { selector: '#partner-1' }) as HTMLSelectElement;
    expect(annaPartnerSelect.value).toBe('0');
  });
});
