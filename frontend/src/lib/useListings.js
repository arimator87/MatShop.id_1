import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export const useListings = (params) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get("/listings", { params: JSON.parse(key) }).then(({ data }) => {
      if (alive) { setItems(data); setLoading(false); }
    });
    return () => { alive = false; };
  }, [key]);
  return { items, loading };
};
