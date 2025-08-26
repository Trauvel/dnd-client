// src/api/api.ts
export async function fetchDevState() {
  const res = await fetch("http://localhost:3000/dev/state");
  return res.json();
}

export async function fetchDevPublicState() {
  const res = await fetch("http://localhost:3000/dev/publicState");
  return res.json();
}

export async function fetchDevMasterState() {
  const res = await fetch("http://localhost:3000/dev/masterState");
  return res.json();
}