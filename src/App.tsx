import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BottomNav } from "./components/BottomNav";
import { SplashScreen } from "./components/SplashScreen";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Card from "./pages/Card";
import Transactions from "./pages/Transactions";
import Goals from "./pages/Goals";
import AI from "./pages/AI";
import Planner from "./pages/Planner";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const SPLASH_SHOWN_KEY = 'inovabank_splash_shown';

function AppRoutes() {
  const location = useLocation();
  const { user } = useAuth();
  const showNav = user && location.pathname !== '/login';

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Index />} />
        <Route path="/card" element={<Card />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/ai" element={<AI />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {showNav && <BottomNav />}
    </>
  );
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Check if splash was shown in this session
    const splashShown = sessionStorage.getItem(SPLASH_SHOWN_KEY);
    if (!splashShown) {
      setShowSplash(true);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    setShowSplash(false);
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      {!showSplash && <AppRoutes />}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
