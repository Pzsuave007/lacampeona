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
import Footer from "@/components/Footer";
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
import DjStudio from "@/pages/DjStudio";
import DjComposerPage from "@/pages/DjComposerPage";
import Blog from "@/pages/Blog";
import SuperAdmin from "@/pages/SuperAdmin";
import Post from "@/pages/Post";

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <StationProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-orange-50">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/mundial" element={<Mundial />} />
                  <Route path="/anuncia" element={<Anuncia />} />
                  <Route path="/eventos" element={<Eventos />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/eventos/:slug" element={<EventoLanding />} />
                  <Route path="/reporte/:token" element={<ReportePublic />} />
                  <Route path="/advertisers" element={<AdvertisersList />} />
                  <Route path="/a/:slug" element={<AdvertiserDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/dj" element={<DjStudio />} />
                  <Route path="/dj/nuevo" element={<DjComposerPage mode="new" />} />
                  <Route path="/dj/editar/:id" element={<DjComposerPage mode="edit" />} />
                  <Route path="/super" element={<SuperAdmin />} />
                  <Route path="/p/:slug" element={<Post />} />
                </Routes>
              </main>
              <Footer />
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
