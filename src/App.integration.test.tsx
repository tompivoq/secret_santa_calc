/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vite-plus/test";
import App from "./App";
import { createStore } from "./store/store";

const renderApp = () =>
  render(
    <Provider store={createStore([])}>
      <App />
    </Provider>,
  );

const addPerson = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  email: string,
  phone: string,
  partnerName?: string,
) => {
  // The form fields are reused across successive calls in the same test.
  // React's DOM value tracker doesn't observe react-hook-form's reset()
  // (it sets the input's value directly, bypassing React), so a stale
  // tracker would make the next userEvent.type() append to the old value
  // instead of the field's actual (visually empty) content. Clearing first
  // sidesteps that — this is a jsdom/testing-library quirk, not something a
  // real browser hits, since genuine keystrokes always dispatch trusted
  // native events the tracker observes correctly.
  await user.clear(screen.getByLabelText("Name"));
  await user.clear(screen.getByLabelText("Email"));
  await user.clear(screen.getByLabelText("Phone"));
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Phone"), phone);
  if (partnerName) {
    await user.selectOptions(
      screen.getByLabelText("Partner", { selector: "#partner" }),
      partnerName,
    );
  }
  await user.click(screen.getByRole("button", { name: "Add Person" }));
};

describe("App: partner selection reciprocity", () => {
  it("shows the partner selected when creating a new person on the existing person too", async () => {
    const user = userEvent.setup();
    renderApp();

    await addPerson(user, "Bjørn", "bjorn@example.com", "11223344");
    await addPerson(user, "Anna", "anna@example.com", "22334455", "Bjørn");

    const bjornPartnerSelect = screen.getByLabelText("Partner", {
      selector: "#partner-0",
    }) as HTMLSelectElement;
    expect(bjornPartnerSelect.value).toBe("1");

    const annaPartnerSelect = screen.getByLabelText("Partner", {
      selector: "#partner-1",
    }) as HTMLSelectElement;
    expect(annaPartnerSelect.value).toBe("0");
  });
});
