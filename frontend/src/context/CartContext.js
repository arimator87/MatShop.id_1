import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CartCtx = createContext(null);
const EMPTY = { items: [], total: 0, savings: 0, count: 0, lines: 0 };

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(EMPTY);

  const refresh = useCallback(async () => {
    if (!user) return setCart(EMPTY);
    const { data } = await api.get("/cart");
    setCart(data);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const call = async (fn) => {
    try {
      const { data } = await fn();
      setCart(data);
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    }
  };

  const add = async (listing_id, qty = 1) => {
    if (!user) {
      toast("Masuk dulu untuk menambahkan ke keranjang");
      navigate("/login");
      return false;
    }
    const ok = await call(() => api.post("/cart/items", { listing_id, qty }));
    if (ok) toast.success("Ditambahkan ke keranjang");
    return ok;
  };
  const update = (id, qty) => call(() => api.put(`/cart/items/${id}`, { qty }));
  const remove = (id) => call(() => api.delete(`/cart/items/${id}`));

  return (
    <CartCtx.Provider value={{ cart, refresh, add, update, remove, setCart }}>{children}</CartCtx.Provider>
  );
};

export const useCart = () => useContext(CartCtx);
