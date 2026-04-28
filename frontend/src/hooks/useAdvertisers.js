import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function useAdvertisers() {
  const [advertisers, setAdvertisers] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/advertisers");
      setAdvertisers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { advertisers, loading, refresh };
}
