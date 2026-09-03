import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";

function App() {
  return (
    <BrowserRouter>
      <main className="mx-auto max-w-2xl px-6 py-12 text-center">
        <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">
          Secret Santa Calculator
        </h1>
        <nav className="mt-4 flex justify-center gap-4 text-sm">
          <Link to="/" className="underline hover:no-underline">
            Manage people
          </Link>
          <Link to="/account" className="underline hover:no-underline">
            My account
          </Link>
        </nav>

        <Routes>
          <Route path="/" element={<AdminPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
