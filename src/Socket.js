import io from "socket.io-client";

// Use VITE_SERVER_URL (set in Vercel / local .env) so we can point to the backend regardless of host
const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const socket = io(serverUrl, { autoConnect: false });

export default socket;
