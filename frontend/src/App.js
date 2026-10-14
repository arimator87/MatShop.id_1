import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AuthCallback } from "@/components/AuthCallback";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import ListingDetail from "@/pages/ListingDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Payment from "@/pages/Payment";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import CustomProject from "@/pages/CustomProject";
import CustomProjectRequest from "@/pages/CustomProjectRequest";
import CustomProjectDetail from "@/pages/CustomProjectDetail";
import VendorProfile from "@/pages/VendorProfile";
import Portfolio from "@/pages/Portfolio";

const guard = (el) => <ProtectedRoute>{el}</ProtectedRoute>;

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/katalog" element={<Catalog />} />
          <Route path="/item/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/keranjang" element={guard(<Cart />)} />
          <Route path="/checkout" element={guard(<Checkout />)} />
          <Route path="/bayar/:paymentId" element={guard(<Payment />)} />
          <Route path="/pesanan" element={guard(<Orders />)} />
          <Route path="/pesanan/:orderId" element={guard(<OrderDetail />)} />
          <Route path="/dashboard" element={guard(<Dashboard />)} />
          <Route path="/admin" element={guard(<Admin />)} />
          <Route path="/vendor/:id" element={<VendorProfile />} />
          <Route path="/portofolio" element={<Portfolio />} />
          <Route path="/custom-project" element={<CustomProject />} />
          <Route path="/custom-project/ajukan" element={guard(<CustomProjectRequest />)} />
          <Route path="/custom-project/:projectId" element={guard(<CustomProjectDetail />)} />
        </Routes>
      </main>
      <Footer />
      <OnboardingModal />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
