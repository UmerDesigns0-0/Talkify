import { useState, useEffect } from "react";

import toast from "react-hot-toast";

function Room({
  socket,
  username,
  setUsername,
  roomName,
  setRoomName,
  roomID,
  setRoomID,
  setShowChat,
  setMessageList,
  userId,
  setCurrentMessage,
  kickedNotice,
  setKickedNotice,
}) {
  const [activeTab, setActiveTab] = useState("join");
  const [copied, setCopied] = useState(false);
  // We keep only name-specific inline errors; all other errors are shown as toast
  const [nameError, setNameError] = useState("");

  const handleJoinRoom = () => {
    if (username.trim() !== "" && roomID !== "") {
      if (activeTab === "create") {
        // CREATE ROOM flow
        const tryCreate = () => {
          socket.emit("register_user", { userId, username }, (res) => {
            // After registration ack, now create room
            socket.emit(
              "create_room",
              { roomID, roomName, username, isCreate: true },
              (response) => {
                if (response && response.ok) {
                  setShowChat(true);
                  if (response.roomName) setRoomName(response.roomName);
                  try {
                    localStorage.removeItem(`messages_${roomID}`);
                  } catch (e) {
                    console.error("Error clearing messages on create:", e);
                  }
                  setMessageList && setMessageList([]);
                } else {
                  const reason =
                    (response && response.reason) || "Unable to create room";
                  // Keep only name collision inline; other create errors use toast
                  if (response && response.reasonType === "username_taken") {
                    setNameError(reason);
                  } else {
                    setNameError("");
                    const toastId = `createErr_${roomID}`;
                    toast.error(reason, { id: toastId });
                  }
                }
              }
            );
          });
        };
        if (!socket.connected) {
          socket.connect();
          socket.once("connect", tryCreate);
        } else {
          tryCreate();
        }
        setCurrentMessage("");
        return;
      }
      // Ensure socket is connected first
      const tryJoin = () => {
        socket.emit("register_user", { userId, username }, (res) => {
          // After registration ack, now join
          socket.emit("join_room", { username, roomID }, (response) => {
            if (response && response.ok) {
              setShowChat(true);
              setNameError("");
              if (response.roomName) setRoomName(response.roomName);
            } else {
              const reason =
                (response && response.reason) || "Unable to join room";
              // set name-specific error for username already taken
              if (response && response.reasonType === "username_taken") {
                setNameError(reason);
              } else {
                setNameError("");
                const toastId = `joinErr_${roomID}`;
                // If the room does not exist, clear the local messages and show a toast (dedupe via id)
                if (response && response.reasonType === "room_not_exists") {
                  try {
                    localStorage.removeItem(`messages_${roomID}`);
                  } catch (e) {
                    console.error("Error clearing messages for room:", e);
                  }
                  setMessageList && setMessageList([]);
                  toast.error(reason || "Room does not exist.", {
                    id: `roomNotExists_${roomID}`,
                  });
                } else {
                  // generic join error - show as toast only (no inline)
                  toast.error(reason, { id: toastId });
                }
              }
            }
          });
        });
      };

      if (!socket.connected) {
        socket.connect();
        socket.once("connect", tryJoin);
      } else {
        tryJoin();
      }
      // setMessageList([]);
      // localStorage.setItem("messageList", JSON.stringify([]));
      setCurrentMessage("");
    }
  };

  // Clear errors when switching tabs or when inputs change
  // clear inline name error when switching tabs
  useEffect(() => {
    setNameError("");
  }, [activeTab]);

  useEffect(() => {
    setNameError("");
  }, [roomID, username]);

  useEffect(() => {
    if (nameError) setNameError("");
  }, [username]);

  useEffect(() => {
    // nothing - create errors are handled as toasts now
  }, [roomID, roomName, username]);

  useEffect(() => {
    const handleJoinDenied = ({ reason, reasonType }) => {
      const msg = reason || "Join denied";
      if (reasonType === "username_taken") {
        setNameError(msg);
        // setJoinError removed; we only manage nameError inline and other errors via toast
      } else {
        // For room_not_exists specifically, just clear message cache; ack flow will show a toast
        if (reasonType === "room_not_exists") {
          try {
            localStorage.removeItem(`messages_${roomID}`);
          } catch (e) {
            console.error("Error clearing messages for room:", e);
          }
          setMessageList && setMessageList([]);
        } else {
          // For all other denial types we show toast (dedupe with a generic id)
          const toastId = `joinDenied_${roomID}_${reasonType}`;
          toast.error(msg, { id: toastId });
        }
        // setJoinError was removed; we only track nameError inline now
        setNameError("");
      }
    };

    socket.on("join_denied", handleJoinDenied);
    return () => socket.off("join_denied", handleJoinDenied);
  }, [socket]);

  // We show a banner for kickedNotice; let the main Chat handle the toast to avoid duplicates
  useEffect(() => {
    if (kickedNotice) {
      const t = setTimeout(() => setKickedNotice && setKickedNotice(""), 4000);
      return () => clearTimeout(t);
    }
  }, [kickedNotice, setKickedNotice]);

  function copyToClipboard() {
    navigator.clipboard.writeText(roomID);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-4 flex flex-col items-center mt-6 max-h-[80vh]">
      {/* Kicked notice banner */}
      {kickedNotice && (
        <div className="mb-3 w-80 xl:w-96 2xl:w-md p-2 bg-red-50 border border-red-200 rounded text-red-700 text-[13px]">
          {kickedNotice}
        </div>
      )}
      {/* Tabs */}
      <div className="flex mb-4 justify-center">
        <button
          onClick={() => {
            setActiveTab("join");
            setUsername("");
            setRoomID("");
          }}
          className={`p-3.5 border w-40 xl:w-48 2xl:w-56 rounded-l-md transition-colors duration-300 ease-in-out 
                      ${
                        activeTab === "join"
                          ? "text-white bg-emerald-600 border-emerald-600 font-medium hover:text-white"
                          : "text-gray-600 border-gray-400 hover:border-emerald-500 hover:text-emerald-600"
                      }`}
        >
          Join a Room
        </button>

        <button
          onClick={() => {
            setActiveTab("create");
            setUsername("");
            setRoomID("");
          }}
          className={`p-3.5 border w-40 xl:w-48 2xl:w-56 rounded-r-md transition-colors duration-300 ease-in-out 
                      ${
                        activeTab === "create"
                          ? "text-white bg-emerald-600 border-emerald-600 font-medium hover:text-white"
                          : "text-gray-600 border-gray-400 hover:border-emerald-500 hover:text-emerald-600"
                      }`}
        >
          Create a Room
        </button>
      </div>

      {/* Title */}
      <h1 className="text-2xl text-gray-700 font-semibold mb-6">
        {activeTab === "join" ? "Join a Room" : "Create a Room"}
      </h1>

      {/* Username Input */}
      <div className="mb-2">
        <input
          className="text-black mb-2 p-3 border border-gray-300 rounded-md shadow-sm 
                   focus:border-emerald-600 focus:ring focus:ring-emerald-400 focus:outline-none 
                   w-80 xl:w-96 2xl:w-md"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username..."
        />
        {/* Username Error (join tab only) */}
        {activeTab === "join" && nameError && (
          <p className="pl-2 text-red-500 text-sm mb-2 text-[12px]">
            {nameError}
          </p>
        )}
      </div>

      {/* Room Name (only for Create tab) */}
      {activeTab === "create" && (
        <>
          <input
            className="text-black mb-4 p-3 border border-gray-300 rounded-md shadow-sm 
                       focus:border-emerald-600 focus:ring focus:ring-emerald-400 focus:outline-none 
                       w-80 xl:w-96 2xl:w-md"
            type="text"
            placeholder="Room Name..."
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          {/* createError is shown via toast; not rendered inline */}
        </>
      )}

      {/* Room ID with Copy */}
      <div className="flex relative items-center">
        <input
          className="text-black mb-4 p-3 border border-gray-300 rounded-md shadow-sm 
                     focus:border-emerald-600 focus:ring focus:ring-emerald-400 focus:outline-none 
                     w-80 pr-10 xl:w-96 2xl:w-md"
          type="text"
          placeholder="Room ID..."
          value={roomID}
          onChange={(e) => setRoomID(e.target.value)}
        />
        {/* Copy Button */}
        {activeTab === "create" && (
          <>
            <button
              disabled={roomID.length === 0}
              onClick={copyToClipboard}
              className="absolute right-3 top-6 -translate-y-1/2 text-gray-500 hover:text-emerald-600"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 
                  1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 
                  10.376h3.375c.621 0 1.125-.504 
                  1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 
                  9.06 0 0 0-1.5-.124H9.375c-.621 
                  0-1.125.504-1.125 1.125v3.5m7.5 
                  10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 
                  6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 
                  1.125 0 0 1-1.125-1.125v-1.5a3.375 
                  3.375 0 0 0-3.375-3.375H9.75"
                />
              </svg>
            </button>
            {copied && roomID.length > 0 && (
              <span
                aria-readonly
                role="status"
                draggable="false"
                className="absolute select-none cursor-default right-12 top-6 -translate-y-1/2 text-emerald-600 text-sm animate-fade"
              >
                Copied!
              </span>
            )}
          </>
        )}
        {/* show join/create error under Room ID */}
        {/* We only render nameError inline; other errors are shown via toast */}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        onClick={handleJoinRoom}
        className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-6 rounded shadow-sm transition-all duration-200"
      >
        {activeTab === "join" ? "Join Room" : "Create Room"}
      </button>
    </div>
  );
}

export default Room;
