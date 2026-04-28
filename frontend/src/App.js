import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { StationProvider } from "@/contexts/StationContext";
import Navbar from "@/components/Navbar";
import RadioPlayer from "@/components/RadioPlayer";
import SmartCTA from "@/components/SmartCTA";
import Home from "@/pages/Home";
import AdvertisersList from "@/pages/AdvertisersList";
import AdvertiserDetail from "@/pages/AdvertiserDetail";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/AdminDashboard";
import Mundial from "@/pages/Mundial";
import Anuncia from "@/pages/Anuncia";
import Eventos from "@/pages/Eventos";
import EventoLanding from "@/pages/EventoLanding";
import ReportePublic from "@/pages/ReportePublic";

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <StationProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-orange-50">
              <Navbar />
              <main className="flex-1 app-bottom-pad">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/mundial" element={<Mundial />} />
                  <Route path="/anuncia" element={<Anuncia />} />
                  <Route path="/eventos" element={<Eventos />} />
                  <Route path="/eventos/:slug" element={<EventoLanding />} />
                  <Route path="/reporte/:token" element={<ReportePublic />} />
                  <Route path="/advertisers" element={<AdvertisersList />} />
                  <Route path="/a/:slug" element={<AdvertiserDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                </Routes>
              </main>
              <SmartCTA />
              <RadioPlayer />
              <Toaster position="top-center" richColors />
            </div>
          </BrowserRouter>
        </StationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
