import { useEffect, useState } from "react";
import { fetchDevState } from "../api/api";

export default function DevPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchDevState().then(setData);
  }, []);

  if (!data) return <div>Загрузка...</div>;

  return (
    <div>
      <h1>Dev State</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
