import { useState, useEffect, useRef } from "react";
import socket from "../Socket";

import { v4 as uuidv4 } from "uuid";

import Room from "./Components/Room";
import Chat from "./Components/chat/Chat";
import UserMenu from "./Components/UserMenu";

function ChatPage({ showChat, setShowChat, activeMenu, setActiveMenu }) {
  const [userId, setUserId] = useState(() => {
    const savedId = localStorage.getItem("userId");
    if (savedId) return savedId;
    const newID = uuidv4();
    localStorage.setItem("userId", newID);
    return newID;
  });

  const [username, setUsername] = useState(
    () => localStorage.getItem("username") || ""
  );
  const [roomName, setRoomName] = useState(
    () => localStorage.getItem("roomName") || ""
  );
  const [kickedNotice, setKickedNotice] = useState("");
  const [roomID, setRoomID] = useState(
    () => localStorage.getItem("roomID") || ""
  );

  const [currentMessage, setCurrentMessage] = useState(
    () => localStorage.getItem("currentMessage") || ""
  );

  const prevRoomRef = useRef(roomID);

  useEffect(() => {
    localStorage.setItem("currentMessage", currentMessage);
  }, [currentMessage]);

  const [messageList, setMessageList] = useState(() => {
    const savedMsgs = roomID && localStorage.getItem(`messages_${roomID}`);
    if (savedMsgs) {
      const parsed = JSON.parse(savedMsgs);
      // ✅ Initialize seenBy array for messages loaded from localStorage
      return parsed.map((msg) => ({
        ...msg,
        seenBy:
          msg.seenBy ||
          (msg.type === "message" && msg.id === userId ? [userId] : []),
      }));
    }
    return [];
  });

  // Load messages when roomID changes
  useEffect(() => {
    if (roomID) {
      // If joining a different room, clear the current messages
      if (prevRoomRef.current && prevRoomRef.current !== roomID) {
        setMessageList([]);
      } else {
        // Re-entering same room or first time - load from localStorage
        const savedMsgs = localStorage.getItem(`messages_${roomID}`);
        if (savedMsgs) {
          const parsed = JSON.parse(savedMsgs);
          // ✅ Initialize seenBy for loaded messages
          const initialized = parsed.map((msg) => ({
            ...msg,
            seenBy:
              msg.seenBy ||
              (msg.type === "message" && msg.id === userId ? [userId] : []),
          }));
          setMessageList(initialized);
        } else {
          setMessageList([]);
        }
      }
      prevRoomRef.current = roomID;
    }
  }, [roomID, userId]);

  useEffect(() => {
    const trimmed = messageList.slice(-250);
    if (roomID)
      localStorage.setItem(`messages_${roomID}`, JSON.stringify(trimmed));
  }, [messageList, roomID]);

  // Keep everything in sync
  useEffect(() => {
    localStorage.setItem("username", username);
  }, [username]);

  useEffect(() => {
    localStorage.setItem("roomName", roomName);
  }, [roomName]);

  useEffect(() => {
    localStorage.setItem("roomID", roomID);
  }, [roomID]);

  useEffect(() => {
    if (username && roomID) {
      // Ensure socket is connected before emitting
      if (!socket.connected) socket.connect();

      // Re-register your persistent session id on the server and rejoin on ack
      socket.emit(
        "register_user",
        { userId: userId || sessionStorage.getItem("userId"), username },
        (res) => {
          socket.emit("join_room", { username, roomID }, (response) => {
            if (response && response.ok) {
              setShowChat(true);
              if (response.roomName) setRoomName(response.roomName);
            } else {
              console.warn("Rejoin denied:", response?.reason);
            }
          });
        }
      );
    }
  }, []);

  // Add outside click & Escape handler only when menu is active
  useEffect(() => {
    if (!activeMenu) return;
    const onDocumentClick = (e) => {
      const menu = document.getElementById("user-menu-container");
      const button = document.getElementById("login-button");
      const target = e.target;
      if (menu && menu.contains(target)) return; // clicked inside menu
      if (button && button.contains(target)) return; // clicked button
      // clicked outside menu and button
      setActiveMenu(false);
    };

    const onEscape = (e) => {
      if (e.key === "Escape") {
        setActiveMenu(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [activeMenu]);

  return (
    <>
      <div>
        <div className="max-w-full relative 2xl:max-w-[1600px] 2xl:max-h-[1800px] mx-auto">
          {showChat ? (
            <>
              {activeMenu === true && (
                <div id="user-menu-container" className="-top-6.5 md:-top-4 right-5 absolute p-2 bg-white z-50 rounded-md shadow-lg">
                  <UserMenu
                    {...{
                      socket,
                      username,
                      userId,
                      roomID,
                      roomName,
                      setShowChat,
                    }}
                  />
                </div>
              )}
              <Chat
                {...{
                  socket,
                  username,
                  roomID,
                  messageList,
                  setMessageList,
                  userId,
                  currentMessage,
                  setCurrentMessage,
                  setShowChat,
                  setRoomID,
                  setRoomName,
                  setKickedNotice,
                }}
              />
            </>
          ) : (
            <Room
              {...{
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
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default ChatPage;
