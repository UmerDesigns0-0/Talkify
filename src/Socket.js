import io from "socket.io-client";

const socket = io("https://your-vercel-project.vercel.app", {
    autoConnect: false
});

export default socket;