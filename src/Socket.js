import io from "socket.io-client";

const socket = io("https://talkify-sigma.vercel.app/", {
    autoConnect: false
});

export default socket;
