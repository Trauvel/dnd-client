import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import GamePage from "./pages/GamePage";
import LocationsPage from "./pages/LocationsPage";
import PlayerPage from "./pages/PlayerPage";
import CharactersPage from "./pages/CharactersPage";
import SettingsPage from "./pages/SettingsPage";
import DevPage from "./pages/DevPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RoomHistoryPage from "./pages/RoomHistoryPage";
import { SocketProvider } from "./store/socketContext";
import { AuthProvider } from "./store/authContext";
import { NotificationProvider } from "./components/Notifications/NotificationSystem";
import ProtectedRoute from "./components/ProtectedRoute";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <SocketProvider>
            <Layout>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <GamePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/locations"
                element={
                  <ProtectedRoute>
                    <LocationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/characters"
                element={
                  <ProtectedRoute>
                    <CharactersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/characters/:id"
                element={
                  <ProtectedRoute>
                    <PlayerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/player"
                element={
                  <ProtectedRoute>
                    <PlayerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dev"
                element={
                  <ProtectedRoute>
                    <DevPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/room-history"
                element={
                  <ProtectedRoute>
                    <RoomHistoryPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Layout>
        </SocketProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
