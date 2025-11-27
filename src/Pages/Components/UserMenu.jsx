import { useState, useEffect } from "react";
import toast from "react-hot-toast";

function UserMenu({ socket, username, userId, roomID, roomName }) {
  const [users, setUsers] = useState([]);
  const [adminId, setAdminId] = useState(null);
  const [showTransferMenu, setShowTransferMenu] = useState(null);
  const [serverRoomName, setServerRoomName] = useState("");

  const isAdmin = adminId === userId;

  useEffect(() => {
    socket.on("room_users", ({ users, adminId, roomName }) => {
      setUsers(users);
      setAdminId(adminId);
      if (roomName != null) setServerRoomName(roomName);
    });

    // Request current users list on mount to avoid race where server emitted before mount
    if (roomID) {
      socket.emit("request_room_users", { roomID }, (res) => {
        if (res && res.users) {
          setUsers(res.users);
          setAdminId(res.adminId || null);
          if (res.roomName) setServerRoomName(res.roomName);
        }
      });
    }

    socket.on("admin_transferred", ({ newAdminId }) => {
      setAdminId(newAdminId);
      if (newAdminId === userId) {
        // Show notification that you're now admin
        toast.success("You are now the room admin!");
      }
    });

    // Chat handles kicked_from_room to show a detailed toast and reset UI; avoid duplicate toast/action here
    socket.on("kicked_from_room", ({ roomID }) => {
      // Optionally we can do any reserved UI cleanup for userlist but avoid toasting here
      // e.g. close menus or reset selection - but do not call setShowChat here
    });

    socket.on("user_kicked", ({ username, kickedBy }) => {
      // Show notification
      console.log(`${username} was kicked by ${kickedBy}`);
    });

    return () => {
      socket.off("room_users");
      socket.off("admin_transferred");
      socket.off("kicked_from_room");
      socket.off("user_kicked");
    };
  }, [socket, userId]);

  const handleTransferAdmin = (newAdminId) => {
    socket.emit("transfer_admin", { roomID, newAdminId });
    setShowTransferMenu(null);
  };

  const handleKickUser = (kickedUserId) => {
    if (window.confirm("Are you sure you want to kick this user?")) {
      socket.emit("kick_user", { roomID, kickedUserId });
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg">
      <div className="mb-2">
        <div className="text-xs text-gray-500">Room</div>
        <div className="text-sm font-semibold text-gray-700">
          {roomName || serverRoomName || "Unnamed room"}
        </div>
      </div>
      <h4 className="text-[14px] font-bold mb-3 text-gray-700">
        People ({users.length})
      </h4>
      <ul className="space-y-1">
        {users.map((user) => (
          <li
            key={user.userId}
            className={`flex cursor-default items-center justify-between text-[12px] bg-white border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 transition ${
              user.userId === userId ? "font-medium border-emerald-500" : ""
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Username */}
              <span className="truncate">
                {user.username === username
                  ? `${user.username} (You)`
                  : user.username}
              </span>

              {/* Admin Badge */}
              {user.userId === adminId && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                  ADMIN
                </span>
              )}

              {/* Typing Indicator */}
              {user.isTyping && user.userId !== userId && (
                <span className="text-[10px] text-emerald-600 italic">
                  typing...
                </span>
              )}
            </div>

            {/* Action Buttons (only show if you're admin) */}
            {isAdmin && user.userId !== userId && (
              <div className="flex gap-1 items-center">
                {/* Transfer Admin Button */}
                <button
                  onClick={() =>
                    setShowTransferMenu(
                      showTransferMenu === user.userId ? null : user.userId
                    )
                  }
                  title="Transfer Admin"
                  className="p-1 text-emerald-500 hover:text-emerald-700 cursor-pointer transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                    />
                  </svg>
                </button>

                {/* Kick Button */}
                <button
                  onClick={() => handleKickUser(user.userId)}
                  title="Kick User Out"
                  className="p-1 text-red-500 hover:text-red-700 cursor-pointer transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18 18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Transfer Admin Confirmation */}
            {showTransferMenu === user.userId && (
              <div className="absolute right-0 mt-8 bg-white border border-gray-300 rounded shadow-lg p-2 z-10">
                <p className="text-xs mb-2 text-gray-700">
                  Transfer admin to {user.username}?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTransferAdmin(user.userId)}
                    className="text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowTransferMenu(null)}
                    className="text-xs bg-gray-300 px-2 py-1 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserMenu;
