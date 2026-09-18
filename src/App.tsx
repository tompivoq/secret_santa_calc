import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import LoginPage from "./pages/LoginPage";
import RequireAuth from "./components/RequireAuth";
import { TopBarNav } from "./components/TopBarNav";
import { StyleGuide } from "./pages/StyleGuide";

function App() {
	return (
		<BrowserRouter>
			<TopBarNav />
			<main className="mx-auto max-w-4xl px-6 pt-2 pb-12 text-center">
				<Routes>
					<Route
						path="/"
						element={
							<RequireAuth adminOnly redirect={<Navigate to="/account" replace />}>
								<AdminPage />
							</RequireAuth>
						}
					/>
					<Route path="/login" element={<LoginPage />} />
					<Route
						path="/account"
						element={
							<RequireAuth>
								<AccountPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/styleguide"
						element={
							<RequireAuth adminOnly>
								<StyleGuide />
							</RequireAuth>
						}
					/>
					{/* Not wrapped in RequireAuth — this is where RequireAuth itself
              redirects to while mustChangePassword is set, and it applies
              its own (inverse) guard: nothing pending means nothing to do
              here, so it bounces onward to /account instead. */}
					<Route path="/change-password" element={<ChangePasswordPage />} />
				</Routes>
			</main>
		</BrowserRouter>
	);
}

export default App;
