const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
app.use(cors());

const server = http.createServer(app);

export default function handler(req, res) {
  if (!res.socket.server.io) {
    console.log("Initializing Socket.IO server...");

    const io = new Server(res.socket.server, {
      path: "/api/socket_io",
      cors: {
        origin: "*", // allow your frontend URL
        methods: ["GET", "POST"],
      },
    });
    // Store typing users per room with their socket IDs
    const typingUsers = new Map();
    // Keep track of users per room across connections
    const roomUsers = new Map();
    // Keep track of room metadata (e.g., name)
    const roomMeta = new Map();
    // Track admin for each room
    const roomAdmins = new Map();
    // Track banned users per room (Set of userIds)
    const roomBans = new Map();
    // Map userId => Set of socketIds to handle multi-tab sessions
    const userSockets = new Map();
    // Keep a mapping for scheduled admin transfer timeouts to avoid immediate transfer on small disconnects (e.g., refresh)
    const adminTransferTimeouts = new Map();

    io.on("connection", (socket) => {
      console.log(`User connected: ${socket.id}`);

      socket.on("join_room", ({ roomID, username }, callback) => {
        try {
          // If user is banned from this room, reject the join first
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
          // If room doesn't exist, reject (server-only created rooms)
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
            // If the previous room is now empty, delete its metadata and other records (but keep bans)
            if (prevUsers.length === 0) {
              roomUsers.delete(prev);
              roomAdmins.delete(prev);
              typingUsers.delete(prev);
              roomMeta.delete(prev);
              // Remove bans as well when the whole room is gone
              roomBans.delete(prev);
              // clear any scheduled admin transfer timeout for this room
              if (adminTransferTimeouts.has(prev)) {
                clearTimeout(adminTransferTimeouts.get(prev));
                adminTransferTimeouts.delete(prev);
              }
              console.log(`Room ${prev} deleted as no users remain.`);
            }
          }

          // (ban check done earlier)

          // roomMeta guaranteed to exist here (server-created rooms only)

          socket.join(roomID);
          socket.data = socket.data || {};
          socket.data.currentRoom = roomID;
          socket.data.username = username;

          console.log(
            `User: ${username} (${socket.id}) joined room: ${roomID}`
          );

          // --- Manage room users list ---
          let users = roomUsers.get(roomID) || [];
          // Check if the username is already taken by another user in the room
          if (
            users.some(
              (u) => u.username === username && u.userId !== socket.userId
            )
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
                socketId: socket.id, // ✅ Store socket ID for typing indicator
                isTyping: false, // ✅ Track typing status
              });
            }
          }

          roomUsers.set(roomID, users);

          // ✅ Assign admin if no admin exists (first user becomes admin)
          if (!roomAdmins.has(roomID) && socket.userId) {
            roomAdmins.set(roomID, socket.userId);
            console.log(`${username} is now admin of room ${roomID}`);
          }

          // Broadcast updated user list to all in room
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

          // Cancel any pending admin transfer timeout for this room if the admin rejoined
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

          // Cancel any pending admin transfer timeout for this room if the admin rejoined
          if (
            adminTransferTimeouts.has(roomID) &&
            socket.userId &&
            roomAdmins.get(roomID) === socket.userId
          ) {
            clearTimeout(adminTransferTimeouts.get(roomID));
            adminTransferTimeouts.delete(roomID);
          }
        } catch (err) {
          console.error("Error handling join_room:", err);
        }
      });

      // Create a new room with a unique roomID
      socket.on(
        "create_room",
        ({ roomID, roomName, username, isCreate = false }, callback) => {
          try {
            // Prevent a banned user from recreating a room with a ban
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
            // Only accept creation when client explicitly requests creation (avoid accidental 'creation' from join)
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

            // Set metadata
            roomMeta.set(roomID, { roomName });

            // Ensure roomUsers map exists
            let users = roomUsers.get(roomID) || [];
            users = users.filter((u) => !!u.userId);

            if (socket.userId) {
              // Add creator as user if not present
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

            // Assign admin to creator if no admin
            if (!roomAdmins.has(roomID) && socket.userId) {
              roomAdmins.set(roomID, socket.userId);
            }

            // Join the creator to the room
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

            // Cancel any pending admin transfer if the user who created/joined is now the admin
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

        console.log(`${username} reconnected with same userId: ${userId}`);
        if (callback) callback({ ok: true });
        // Track user sockets for multi-tab sessions
        if (userId) {
          const set = userSockets.get(userId) || new Set();
          set.add(socket.id);
          userSockets.set(userId, set);
        }
      });

      socket.on("send_message", (data) => {
        console.log("Message data received:", data);

        const roomID = data.room;
        if (roomID) {
          // Clear typing indicator
          const currentTypers = typingUsers.get(roomID) || new Map();
          currentTypers.delete(socket.id);

          if (currentTypers.size === 0) {
            typingUsers.delete(roomID);
          } else {
            typingUsers.set(roomID, currentTypers);
          }

          // ✅ Update user list to show not typing
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

      // ✅ User starts typing
      socket.on("typing", ({ roomID, username }) => {
        const currentTypers = typingUsers.get(roomID) || new Map();
        currentTypers.set(socket.id, { username, socketId: socket.id });
        typingUsers.set(roomID, currentTypers);

        // Update user list
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

      // ✅ User stops typing
      socket.on("stop_typing", ({ roomID, username }) => {
        const currentTypers = typingUsers.get(roomID) || new Map();
        currentTypers.delete(socket.id);

        if (currentTypers.size === 0) {
          typingUsers.delete(roomID);
        } else {
          typingUsers.set(roomID, currentTypers);
        }

        // Update user list
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

      // Client can request room users list explicitly (useful on mount)
      socket.on("request_room_users", ({ roomID }, callback) => {
        const users = roomUsers.get(roomID) || [];
        const adminId = roomAdmins.get(roomID) || null;
        if (callback) callback({ users, adminId });
        socket.emit("room_users", { users, adminId });
      });

      // ✅ Transfer admin
      socket.on("transfer_admin", ({ roomID, newAdminId }) => {
        const currentAdmin = roomAdmins.get(roomID);

        // Only allow current admin to transfer
        if (currentAdmin === socket.userId) {
          roomAdmins.set(roomID, newAdminId);
          // clear any pending admin transfer timeout, since admin was manually transferred
          if (adminTransferTimeouts.has(roomID)) {
            clearTimeout(adminTransferTimeouts.get(roomID));
            adminTransferTimeouts.delete(roomID);
          }

          const users = roomUsers.get(roomID) || [];
          io.to(roomID).emit("room_users", { users, adminId: newAdminId });
          io.to(roomID).emit("admin_transferred", { newAdminId });

          console.log(
            `Admin transferred in room ${roomID} to user ${newAdminId}`
          );
        }
      });

      // ✅ Kick user
      socket.on("kick_user", ({ roomID, kickedUserId }) => {
        const currentAdmin = roomAdmins.get(roomID);

        // Only allow admin to kick
        if (currentAdmin === socket.userId) {
          // Find the socket of the user to kick
          const users = roomUsers.get(roomID) || [];
          const kickedUser = users.find((u) => u.userId === kickedUserId);

          if (kickedUser) {
            // Remove from room users
            const updatedUsers = users.filter((u) => u.userId !== kickedUserId);
            roomUsers.set(roomID, updatedUsers);

            // Remove all sockets of the kicked user from the room
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

            // Broadcast kick event with kicker details for chat
            io.to(roomID).emit("user_kicked", {
              username: kickedUser.username,
              kickedBy: socket.username,
              kickedUserId: kickedUser.userId,
            });

            // Add to banlist so the kicked user cannot rejoin
            const bans = roomBans.get(roomID) || new Set();
            bans.add(kickedUserId);
            roomBans.set(roomID, bans);

            // Send updated user list
            io.to(roomID).emit("room_users", {
              users: updatedUsers,
              adminId: currentAdmin,
            });
            // clear any scheduled admin transfer (we just updated admin state)
            if (adminTransferTimeouts.has(roomID)) {
              clearTimeout(adminTransferTimeouts.get(roomID));
              adminTransferTimeouts.delete(roomID);
            }
            // If the room is now empty after kick, delete its metadata and associated maps
            if (updatedUsers.length === 0) {
              roomUsers.delete(roomID);
              roomAdmins.delete(roomID);
              typingUsers.delete(roomID);
              roomMeta.delete(roomID);
              // remove bans too when room removed
              roomBans.delete(roomID);
              // clear pending admin transfer timeout for this room
              if (adminTransferTimeouts.has(roomID)) {
                clearTimeout(adminTransferTimeouts.get(roomID));
                adminTransferTimeouts.delete(roomID);
              }
              console.log(
                `Room ${roomID} deleted after kick; no users remain.`
              );
            }

            console.log(
              `User ${kickedUser.username} kicked from room ${roomID}`
            );
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

          // ✅ Auto-transfer admin if admin disconnects
          const currentAdmin = roomAdmins.get(currentRoom);
          if (currentAdmin === socket.userId && users.length > 0) {
            // The admin disconnected but users are still in the room. To prevent
            // unintentional admin transfer during a browser refresh, schedule a
            // small delay before transferring admin. If the admin rejoins within
            // that delay, cancel the transfer.
            const delay = 3000; // ms
            // clear any previous timeout
            if (adminTransferTimeouts.has(currentRoom)) {
              clearTimeout(adminTransferTimeouts.get(currentRoom));
              adminTransferTimeouts.delete(currentRoom);
            }

            const originalAdminId = currentAdmin;
            const timeout = setTimeout(() => {
              // If the original admin is back in the room, cancel transfer; otherwise transfer to first available user
              const updatedUsers = roomUsers.get(currentRoom) || [];
              if (updatedUsers.some((u) => u.userId === originalAdminId)) {
                // admin is back; no transfer needed
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
            // No users left: remove admin and delete room metadata, including ban lists
            roomAdmins.delete(currentRoom);
            roomUsers.delete(currentRoom);
            // remove typing users for this room
            typingUsers.delete(currentRoom);
            // Remove room meta so the room is considered deleted
            roomMeta.delete(currentRoom);
            // Remove bans too when room deleted so recreating a room with same ID allows rejoin
            roomBans.delete(currentRoom);
            // clear any admin transfer timeout for this room
            if (adminTransferTimeouts.has(currentRoom)) {
              clearTimeout(adminTransferTimeouts.get(currentRoom));
              adminTransferTimeouts.delete(currentRoom);
            }
            console.log(`Room ${currentRoom} deleted after last user left.`);
          }

          const newAdmin = roomAdmins.get(currentRoom);
          io.to(currentRoom).emit("room_users", { users, adminId: newAdmin });
        }

        // Remove socket from userSockets mapping
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

    server.listen(3001, () => {
      console.log(`Server is running on port 3001`);
    });

    res.end();
  }
}
