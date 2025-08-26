import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import GamePage from "./pages/GamePage";
import LocationsPage from "./pages/LocationsPage";
import PlayerPage from "./pages/PlayerPage";
import SettingsPage from "./pages/SettingsPage";
import DevPage from "./pages/DevPage";
import { SocketProvider } from "./store/socketContext";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <SocketProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<GamePage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/dev" element={<DevPage />} />
          </Routes>
        </Layout>
      </SocketProvider>
    </BrowserRouter>
  );
};

export default App;
