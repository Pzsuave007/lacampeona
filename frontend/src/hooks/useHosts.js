import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function useHosts() {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/hosts");
      setHosts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { hosts, loading, refresh };
}
