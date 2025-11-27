const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// Configure CORS to allow frontend origin
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: FRONTEND_URL }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
  path: "/socket.io",
});

// Server-side state maps
const typingUsers = new Map();
const roomUsers = new Map();
const roomMeta = new Map();
const roomAdmins = new Map();
const roomBans = new Map();
const userSockets = new Map();
const adminTransferTimeouts = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("register_user", ({ userId, username }, callback) => {
    socket.userId = userId;
    socket.username = username;

    const roomID = socket.data?.currentRoom;
    if (roomID) {
      let users = roomUsers.get(roomID) || [];
      users = users.map((u) =>
        u.userId === userId ? { ...u, username, socketId: socket.id } : u
      );

      roomUsers.set(roomID, users);
      const currentAdmin = roomAdmins.get(roomID);
      const roomName = roomMeta.get(roomID)?.roomName || "";
      io.to(roomID).emit("room_users", {
        users,
        adminId: currentAdmin,
        roomName,
      });
    }

    if (callback) callback({ ok: true });
    if (userId) {
      const set = userSockets.get(userId) || new Set();
      set.add(socket.id);
      userSockets.set(userId, set);
    }
  });

  socket.on("join_room", ({ roomID, username }, callback) => {
    try {
      const bans = roomBans.get(roomID) || new Set();
      if (socket.userId && bans.has(socket.userId)) {
        console.log(
          `join_room denied - userId ${socket.userId} is banned from room ${roomID}`
        );
        if (callback)
          callback({
            ok: false,
            reason: "You are banned from this room.",
            reasonType: "banned",
          });
        socket.emit("join_denied", {
          reason: "You are banned from this room.",
          reasonType: "banned",
        });
        return;
      }

      if (!roomMeta.has(roomID)) {
        if (callback)
          callback({
            ok: false,
            reason: "Room does not exist.",
            reasonType: "room_not_exists",
          });
        socket.emit("join_denied", {
          reason: "Room does not exist.",
          reasonType: "room_not_exists",
        });
        return;
      }

      console.log(
        `join_room attempt - socketId=${socket.id}, userId=${socket.userId}, room=${roomID}, username=${username}`
      );

      const prev = socket.data && socket.data.currentRoom;
      if (prev && prev !== roomID) {
        let prevUsers = roomUsers.get(prev) || [];
        prevUsers = prevUsers.filter((u) => u.userId !== socket.userId);
        roomUsers.set(prev, prevUsers);
        io.to(prev).emit("room_users", prevUsers);

        socket.leave(prev);
        console.log(`Socket ${socket.id} left previous room: ${prev}`);

        if (prevUsers.length === 0) {
          roomUsers.delete(prev);
          roomAdmins.delete(prev);
          typingUsers.delete(prev);
          roomMeta.delete(prev);
          roomBans.delete(prev);
          if (adminTransferTimeouts.has(prev)) {
            clearTimeout(adminTransferTimeouts.get(prev));
            adminTransferTimeouts.delete(prev);
          }
          console.log(`Room ${prev} deleted as no users remain.`);
        }
      }

      socket.join(roomID);
      socket.data = socket.data || {};
      socket.data.currentRoom = roomID;
      socket.data.username = username;

      console.log(`User: ${username} (${socket.id}) joined room: ${roomID}`);

      let users = roomUsers.get(roomID) || [];

      if (
        users.some((u) => u.username === username && u.userId !== socket.userId)
      ) {
        if (callback)
          callback({
            ok: false,
            reason: "Username already taken.",
            reasonType: "username_taken",
          });
        socket.emit("join_denied", {
          reason: "Username already taken.",
          reasonType: "username_taken",
        });
        return;
      }

      users = users.filter((u) => !!u.userId);

      if (socket.userId) {
        if (!users.some((u) => u.userId === socket.userId)) {
          users.push({
            userId: socket.userId,
            username,
            socketId: socket.id,
            isTyping: false,
          });
        }
      }

      roomUsers.set(roomID, users);

      if (!roomAdmins.has(roomID) && socket.userId) {
        roomAdmins.set(roomID, socket.userId);
        console.log(`${username} is now admin of room ${roomID}`);
      }

      const currentAdmin = roomAdmins.get(roomID);
      const roomName = roomMeta.get(roomID)?.roomName || "";
      io.to(roomID).emit("room_users", {
        users,
        adminId: currentAdmin,
        roomName,
      });
      socket.emit("room_users", { users, adminId: currentAdmin, roomName });
      if (callback)
        callback({ ok: true, users, adminId: currentAdmin, roomName });

      if (
        adminTransferTimeouts.has(roomID) &&
        socket.userId &&
        roomAdmins.get(roomID) === socket.userId
      ) {
        clearTimeout(adminTransferTimeouts.get(roomID));
        adminTransferTimeouts.delete(roomID);
      }

      socket.to(roomID).emit("user_joined", {
        username: username,
        userId: socket.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error handling join_room:", err);
    }
  });

  socket.on(
    "create_room",
    ({ roomID, roomName, username, isCreate = false }, callback) => {
      try {
        const bans = roomBans.get(roomID) || new Set();
        if (socket.userId && bans.has(socket.userId)) {
          if (callback)
            callback({
              ok: false,
              reason: "You are banned from this room.",
            });
          socket.emit("create_room_failed", {
            reason: "You are banned from this room.",
          });
          return;
        }

        if (!isCreate) {
          if (callback)
            callback({
              ok: false,
              reason: "Creation is not allowed from this endpoint.",
              reasonType: "not_allowed",
            });
          socket.emit("create_room_failed", {
            reason: "Creation is not allowed.",
          });
          return;
        }

        if (roomMeta.has(roomID)) {
          if (callback)
            callback({ ok: false, reason: "Room ID already exists." });
          socket.emit("create_room_failed", {
            reason: "Room ID already exists.",
          });
          return;
        }

        roomMeta.set(roomID, { roomName });

        let users = roomUsers.get(roomID) || [];
        users = users.filter((u) => !!u.userId);

        if (socket.userId) {
          if (!users.some((u) => u.userId === socket.userId)) {
            users.push({
              userId: socket.userId,
              username,
              socketId: socket.id,
              isTyping: false,
            });
          }
        }
        roomUsers.set(roomID, users);

        if (!roomAdmins.has(roomID) && socket.userId) {
          roomAdmins.set(roomID, socket.userId);
        }

        socket.join(roomID);
        socket.data = socket.data || {};
        socket.data.currentRoom = roomID;
        socket.data.username = username;

        const currentAdmin = roomAdmins.get(roomID);
        io.to(roomID).emit("room_users", {
          users,
          adminId: currentAdmin,
          roomName,
        });
        socket.emit("room_users", {
          users,
          adminId: currentAdmin,
          roomName,
        });

        if (callback)
          callback({ ok: true, users, adminId: currentAdmin, roomName });

        if (
          adminTransferTimeouts.has(roomID) &&
          socket.userId &&
          roomAdmins.get(roomID) === socket.userId
        ) {
          clearTimeout(adminTransferTimeouts.get(roomID));
          adminTransferTimeouts.delete(roomID);
        }

        socket.to(roomID).emit("user_joined", {
          username,
          userId: socket.userId,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Error creating room:", err);
        if (callback)
          callback({ ok: false, reason: "Server error creating room" });
      }
    }
  );

  socket.on("send_message", (data) => {
    console.log("Message data received:", data);

    const roomID = data.room;
    if (roomID) {
      const currentTypers = typingUsers.get(roomID) || new Map();
      currentTypers.delete(socket.id);

      if (currentTypers.size === 0) {
        typingUsers.delete(roomID);
      } else {
        typingUsers.set(roomID, currentTypers);
      }

      let users = roomUsers.get(roomID) || [];
      users = users.map((u) =>
        u.socketId === socket.id ? { ...u, isTyping: false } : u
      );
      roomUsers.set(roomID, users);
      const currentAdmin = roomAdmins.get(roomID);
      const roomName = roomMeta.get(roomID)?.roomName || "";
      io.to(roomID).emit("room_users", {
        users,
        adminId: currentAdmin,
        roomName,
      });

      const typers = Array.from(currentTypers.values());
      socket.to(roomID).emit("user_stopped_typing", { typers });
    }

    io.to(data.room).emit("receive_message", data);
  });

  socket.on("delete_message", (message) => {
    io.to(message.room).emit("message_deleted", message);
  });

  socket.on("typing", ({ roomID, username }) => {
    const currentTypers = typingUsers.get(roomID) || new Map();
    currentTypers.set(socket.id, { username, socketId: socket.id });
    typingUsers.set(roomID, currentTypers);

    let users = roomUsers.get(roomID) || [];
    users = users.map((u) =>
      u.socketId === socket.id ? { ...u, isTyping: true } : u
    );
    roomUsers.set(roomID, users);
    const currentAdmin = roomAdmins.get(roomID);
    const roomName = roomMeta.get(roomID)?.roomName || "";
    io.to(roomID).emit("room_users", {
      users,
      adminId: currentAdmin,
      roomName,
    });

    const typers = Array.from(currentTypers.values());
    socket.to(roomID).emit("user_typing", { typers });
  });

  socket.on("stop_typing", ({ roomID, username }) => {
    const currentTypers = typingUsers.get(roomID) || new Map();
    currentTypers.delete(socket.id);

    if (currentTypers.size === 0) {
      typingUsers.delete(roomID);
    } else {
      typingUsers.set(roomID, currentTypers);
    }

    let users = roomUsers.get(roomID) || [];
    users = users.map((u) =>
      u.socketId === socket.id ? { ...u, isTyping: false } : u
    );
    roomUsers.set(roomID, users);
    const currentAdmin = roomAdmins.get(roomID);
    const roomName = roomMeta.get(roomID)?.roomName || "";
    io.to(roomID).emit("room_users", {
      users,
      adminId: currentAdmin,
      roomName,
    });

    const typers = Array.from(currentTypers.values());
    socket.to(roomID).emit("user_stopped_typing", { typers });
  });

  socket.on("mark_seen", ({ messageId, userId, room, username }) => {
    io.to(room).emit("mark_seen", { messageId, userId, room, username });
  });

  socket.on("request_room_users", ({ roomID }, callback) => {
    const users = roomUsers.get(roomID) || [];
    const adminId = roomAdmins.get(roomID) || null;
    if (callback) callback({ users, adminId });
    socket.emit("room_users", { users, adminId });
  });

  socket.on("transfer_admin", ({ roomID, newAdminId }) => {
    const currentAdmin = roomAdmins.get(roomID);

    if (currentAdmin === socket.userId) {
      roomAdmins.set(roomID, newAdminId);
      if (adminTransferTimeouts.has(roomID)) {
        clearTimeout(adminTransferTimeouts.get(roomID));
        adminTransferTimeouts.delete(roomID);
      }

      const users = roomUsers.get(roomID) || [];
      io.to(roomID).emit("room_users", { users, adminId: newAdminId });
      io.to(roomID).emit("admin_transferred", { newAdminId });

      console.log(`Admin transferred in room ${roomID} to user ${newAdminId}`);
    }
  });

  socket.on("kick_user", ({ roomID, kickedUserId }) => {
    const currentAdmin = roomAdmins.get(roomID);

    if (currentAdmin === socket.userId) {
      const users = roomUsers.get(roomID) || [];
      const kickedUser = users.find((u) => u.userId === kickedUserId);

      if (kickedUser) {
        const updatedUsers = users.filter((u) => u.userId !== kickedUserId);
        roomUsers.set(roomID, updatedUsers);

        const socketSet = userSockets.get(kickedUserId) || new Set();
        socketSet.forEach((sockId) => {
          try {
            io.to(sockId).emit("kicked_from_room", {
              roomID,
              kickedBy: socket.username,
            });
            const kickSocket = io.sockets.sockets.get(sockId);
            if (kickSocket) {
              kickSocket.leave(roomID);
              if (kickSocket.data) kickSocket.data.currentRoom = null;
            }
          } catch (e) {
            console.error("Error removing kicked socket from room:", e);
          }
        });

        io.to(roomID).emit("user_kicked", {
          username: kickedUser.username,
          kickedBy: socket.username,
          kickedUserId: kickedUser.userId,
        });

        const bans = roomBans.get(roomID) || new Set();
        bans.add(kickedUserId);
        roomBans.set(roomID, bans);

        io.to(roomID).emit("room_users", {
          users: updatedUsers,
          adminId: currentAdmin,
        });

        if (adminTransferTimeouts.has(roomID)) {
          clearTimeout(adminTransferTimeouts.get(roomID));
          adminTransferTimeouts.delete(roomID);
        }

        if (updatedUsers.length === 0) {
          roomUsers.delete(roomID);
          roomAdmins.delete(roomID);
          typingUsers.delete(roomID);
          roomMeta.delete(roomID);
          roomBans.delete(roomID);
          if (adminTransferTimeouts.has(roomID)) {
            clearTimeout(adminTransferTimeouts.get(roomID));
            adminTransferTimeouts.delete(roomID);
          }
          console.log(`Room ${roomID} deleted after kick; no users remain.`);
        }

        console.log(`User ${kickedUser.username} kicked from room ${roomID}`);
      }
    }
  });

  socket.on("disconnect", () => {
    const currentRoom = socket.data?.currentRoom;
    const username = socket.data?.username;

    if (currentRoom) {
      let users = roomUsers.get(currentRoom) || [];
      users = users.filter((u) => u.userId !== socket.userId);
      roomUsers.set(currentRoom, users);

      const currentAdmin = roomAdmins.get(currentRoom);
      if (currentAdmin === socket.userId && users.length > 0) {
        const delay = 3000;
        if (adminTransferTimeouts.has(currentRoom)) {
          clearTimeout(adminTransferTimeouts.get(currentRoom));
          adminTransferTimeouts.delete(currentRoom);
        }

        const originalAdminId = currentAdmin;
        const timeout = setTimeout(() => {
          const updatedUsers = roomUsers.get(currentRoom) || [];
          if (updatedUsers.some((u) => u.userId === originalAdminId)) {
            adminTransferTimeouts.delete(currentRoom);
            return;
          }
          if (
            updatedUsers.length > 0 &&
            roomAdmins.get(currentRoom) === originalAdminId
          ) {
            const newAdminId = updatedUsers[0].userId;
            roomAdmins.set(currentRoom, newAdminId);
            io.to(currentRoom).emit("admin_transferred", { newAdminId });
            console.log(
              `Admin auto-transferred to ${updatedUsers[0].username} in room ${currentRoom}`
            );
          }
          adminTransferTimeouts.delete(currentRoom);
        }, delay);

        adminTransferTimeouts.set(currentRoom, timeout);
      } else if (users.length === 0) {
        roomAdmins.delete(currentRoom);
        roomUsers.delete(currentRoom);
        typingUsers.delete(currentRoom);
        roomMeta.delete(currentRoom);
        roomBans.delete(currentRoom);
        if (adminTransferTimeouts.has(currentRoom)) {
          clearTimeout(adminTransferTimeouts.get(currentRoom));
          adminTransferTimeouts.delete(currentRoom);
        }
        console.log(`Room ${currentRoom} deleted after last user left.`);
      }

      const newAdmin = roomAdmins.get(currentRoom);
      io.to(currentRoom).emit("room_users", { users, adminId: newAdmin });
    }

    if (socket.userId) {
      const set = userSockets.get(socket.userId) || new Set();
      set.delete(socket.id);
      if (set.size === 0) {
        userSockets.delete(socket.userId);
      } else {
        userSockets.set(socket.userId, set);
      }
    }

    if (currentRoom && username) {
      const currentTypers = typingUsers.get(currentRoom) || new Map();
      currentTypers.delete(socket.id);

      if (currentTypers.size === 0) {
        typingUsers.delete(currentRoom);
      } else {
        typingUsers.set(currentRoom, currentTypers);
      }

      socket.to(currentRoom).emit("user_left", {
        username: username,
        userId: socket.userId,
      });

      const typers = Array.from(currentTypers.values());
      socket.to(currentRoom).emit("user_stopped_typing", { typers });

      console.log(`User ${username} left room ${currentRoom}`);
    }

    console.log(`User disconnected: ${socket.id}`);
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}`);
});

app.get("/", (req, res) => res.send("Talkify Socket Server is running"));

module.exports = { app, server, io };
