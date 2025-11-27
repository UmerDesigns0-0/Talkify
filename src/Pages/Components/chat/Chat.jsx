import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import MyEmojiPicker from "./EmojiPicker";
import TypingIndicator from "./Typing";

import MessageList from "./MessageList";
import ScrollToBottomButton from "./ScrollToBottomButton";
import MessageInput from "./MessageInput";

function Chat({
  socket,
  username,
  roomID,
  setMessageList,
  messageList,
  userId,
  currentMessage,
  setCurrentMessage,
  setShowChat,
  setRoomID,
  setRoomName,
  setKickedNotice,
}) {
  const [typingUsers, setTypingUsers] = useState([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isTall, setIsTall] = useState(false);

  const [replyingTo, setReplyingTo] = useState(null);

  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const messagesRef = useRef({});
  const lastActionRef = useRef("add");
  const markedSeenRef = useRef(new Set());

  // ✅ Track if window/tab is visible
  const [isWindowVisible, setIsWindowVisible] = useState(!document.hidden);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target)
      ) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Track window/tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsWindowVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", () => setIsWindowVisible(true));
    window.addEventListener("blur", () => setIsWindowVisible(false));

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("blur", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    if (el.scrollHeight > el.clientHeight) {
      setIsTall(true);
    } else {
      setIsTall(false);
    }
  }, [currentMessage]);

  const handleEmojiClick = useCallback(
    (emojiData) => {
      console.log("Emoji selected:", emojiData);
      setCurrentMessage((prev) => prev + emojiData.emoji);
      // setEmojiOpen(false);
    },
    [setCurrentMessage]
  );

  const emojiPicker = useMemo(
    () =>
      emojiOpen ? <MyEmojiPicker onEmojiClick={handleEmojiClick} /> : null,
    [emojiOpen, handleEmojiClick]
  );

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const SCROLL_THRESHOLD = 200;

  useEffect(() => {
    if (lastActionRef.current === "add") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastActionRef.current = null;
  }, [messageList]);

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - (el.scrollTop + el.clientHeight);
    setShowScrollBtn(distanceFromBottom > SCROLL_THRESHOLD);
  };

  const scrollToMessage = (messageId) => {
    const el = messagesRef.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const classes = "animate-pulse";
      el.classList.add(classes);
      setTimeout(() => {
        el.classList.remove(classes);
      }, 3200);
    }
  };

  const handleInputChange = (e) => {
    setCurrentMessage(e.target.value);
    if (!isTypingRef.current && e.target.value.trim() !== "") {
      isTypingRef.current = true;
      socket.emit("typing", { roomID, username });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (e.target.value.trim() !== "") {
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socket.emit("stop_typing", { roomID, username });
      }, 2000);
    } else {
      isTypingRef.current = false;
      socket.emit("stop_typing", { roomID, username });
    }
  };

  const sendMsg = () => {
    if (currentMessage.trim() !== "") {
      const now = new Date();
      const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const messageId =
        typeof window !== "undefined" &&
        window.crypto &&
        window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const msgData = {
        type: "message",
        id: userId,
        messageId,
        author: username,
        room: roomID,
        message: currentMessage,
        time: time,
        replyTo: replyingTo
          ? {
              messageId: replyingTo.messageId,
              message: replyingTo.message,
              author: replyingTo.author,
              id: replyingTo.id,
            }
          : null,
        seenBy: [userId],
      };

      socket.emit("send_message", msgData);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      isTypingRef.current = false;

      setCurrentMessage("");
      setEmojiOpen(false);
      setReplyingTo(null);
    }
  };

  // ✅ Mark message as seen only when visible in viewport AND tab is active
  const markMessageAsSeen = useCallback(
    (messageId) => {
      if (!markedSeenRef.current.has(messageId) && isWindowVisible) {
        markedSeenRef.current.add(messageId);
        socket.emit("mark_seen", {
          messageId,
          userId,
          room: roomID,
          username,
        });
      }
    },
    [socket, userId, roomID, username, isWindowVisible]
  );

  // ✅ Intersection Observer to track which messages are visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && isWindowVisible) {
            const messageId = entry.target.dataset.messageId;
            const senderId = entry.target.dataset.senderId;

            // Only mark as seen if it's not your own message
            if (messageId && senderId && senderId !== userId) {
              markMessageAsSeen(messageId);
            }
          }
        });
      },
      {
        root: messagesContainerRef.current,
        threshold: 0.5, // Mark as seen when 50% of message is visible
      }
    );

    // Observe all message elements
    Object.values(messagesRef.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [messageList, markMessageAsSeen, userId, isWindowVisible]);

  // ✅ Re-mark unseen messages when window becomes visible
  useEffect(() => {
    if (isWindowVisible) {
      // Wait a bit for the intersection observer to kick in
      setTimeout(() => {
        const unSeenMessages = messageList.filter(
          (msg) =>
            msg.type === "message" &&
            msg.messageId &&
            msg.id !== userId &&
            (!msg.seenBy || !msg.seenBy.includes(userId)) &&
            !markedSeenRef.current.has(msg.messageId)
        );

        // Check if they're in viewport
        unSeenMessages.forEach((msg) => {
          const el = messagesRef.current[msg.messageId];
          if (el) {
            const rect = el.getBoundingClientRect();
            const container =
              messagesContainerRef.current?.getBoundingClientRect();

            if (
              container &&
              rect.top >= container.top &&
              rect.bottom <= container.bottom
            ) {
              markMessageAsSeen(msg.messageId);
            }
          }
        });
      }, 100);
    }
  }, [isWindowVisible, messageList, userId, markMessageAsSeen]);

  useEffect(() => {
    const handleReceiveMessage = (data) => {
      lastActionRef.current = "add";
      setMessageList((list) => [...list, data]);
      // Mark as seen after receiving
      setTimeout(() => handleMarkSeen(), 100);
    };

    const handleUserJoined = (data) => {
      setMessageList((list) => [
        ...list,
        {
          type: "join",
          username: data.username,
        },
      ]);
    };

    const handleUserLeft = (data) => {
      setMessageList((list) => [
        ...list,
        {
          type: "left",
          username: data.username,
        },
      ]);
    };

    const handleUserTyping = ({ username: typingUser, typers }) => {
      setTypingUsers(typers.filter((typer) => typer.socketId !== socket.id));
    };

    const handleUserStoppedTyping = ({ username: stoppedUser, typers }) => {
      setTypingUsers(typers.filter((typer) => typer.socketId !== socket.id));
    };

    const handleSeenMsg = ({ messageId, userId: seenUserId }) => {
      setMessageList((list) =>
        list.map((msg) => {
          if (msg.messageId === messageId) {
            const currentSeenBy = msg.seenBy || [];
            return {
              ...msg,
              seenBy: currentSeenBy.includes(seenUserId)
                ? currentSeenBy
                : [...currentSeenBy, seenUserId],
            };
          }
          return msg;
        })
      );
    };

    const handleDeleteMessage = (message) => {
      lastActionRef.current = "delete";
      // Filter by unique messageId when available; fall back to id if not present
      setMessageList((list) =>
        list.map((item) => {
          if (item.messageId === message.messageId) {
            return { ...item, deleted: true };
          }
          if (item.replyTo?.messageId === message.messageId) {
            return {
              ...item,
              replyTo: {
                ...item.replyTo,
                message: "This message was deleted",
                deleted: true,
              },
            };
          }

          return item;
        })
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_joined", handleUserJoined);
    socket.on("user_left", handleUserLeft);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);
    socket.on("message_deleted", handleDeleteMessage);
    const handleUserKicked = ({ username, kickedBy, kickedUserId }) => {
      // If the kicked event refers to the current user, skip adding a system message
      if (kickedUserId && kickedUserId === userId) return;
      setMessageList((list) => [
        ...list,
        {
          type: "kicked",
          username: username,
          kickedBy: kickedBy,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    };
    socket.on("user_kicked", handleUserKicked);

    const handleKickedFromRoom = ({ roomID, kickedBy }) => {
      // Set an informative message and return user to room selection
      const msg = kickedBy ? `You were kicked from the room by ${kickedBy}` : `You were kicked from the room`;
      if (setKickedNotice) setKickedNotice(msg);
      if (setShowChat) setShowChat(false);
      if (setRoomID) setRoomID("");
      if (setRoomName) setRoomName("");
      if (setMessageList) setMessageList([]);
      // Keep a toast as well
      toast.error(msg, { id: `kicked_${roomID}_${userId}` });
    };
    socket.on("kicked_from_room", handleKickedFromRoom);
    socket.on("mark_seen", handleSeenMsg);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_joined", handleUserJoined);
      socket.off("user_left", handleUserLeft);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
      socket.off("message_deleted", handleDeleteMessage);
      socket.off("user_kicked", handleUserKicked);
      socket.off("kicked_from_room", handleKickedFromRoom);
      socket.off("mark_seen", handleSeenMsg);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, setMessageList]);

  const handleDeleteMessage = (message) => {
    socket.emit("delete_message", message);
  };

  return (
    <>
      <div className="bg-gray-100 flex flex-col max-h-[80vh] mx-auto h-[80vh]">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 pb-20"
        >
          {/* Messages */}
          <div className="flex flex-col space-y-2">
            {/* Typing indicator at top - sticky */}
            {typingUsers.length > 0 && (
              <div className="flex justify-center sticky top-0 z-10 my-2 text-xs text-gray-600 text-center bg-emerald-200 rounded-full py-1 px-5 w-fit mx-auto">
                {typingUsers.length === 1
                  ? `${typingUsers[0].username} is typing...`
                  : typingUsers.length === 2
                  ? `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`
                  : `${typingUsers.length} people are typing...`}
              </div>
            )}

            {/* Messages list */}
            {messageList.map((item, index) => (
              <div
                key={item.messageId || index}
                className={`flex ${
                  item.type === "join" || item.type === "left"
                    ? "justify-center"
                    : item.id === userId
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <MessageList
                  item={item}
                  index={index}
                  userId={userId}
                  messagesRef={messagesRef}
                  socket={socket}
                  textareaRef={textareaRef}
                  setReplyingTo={setReplyingTo}
                  onScrollToMessage={scrollToMessage}
                  onDelete={handleDeleteMessage}
                />
              </div>
            ))}

            {/* Typing indicator at bottom */}
            {typingUsers.length > 0 && (
              <div className="flex justify-start mb-4">
                <TypingIndicator />
              </div>
            )}

            {/* Scroll to bottom button */}
            {showScrollBtn && (
              <ScrollToBottomButton
                handleScrollToBottom={handleScrollToBottom}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Bottom bar */}
        <MessageInput
          emojiPicker={emojiPicker}
          emojiButtonRef={emojiButtonRef}
          emojiPickerRef={emojiPickerRef}
          replyingTo={replyingTo}
          textareaRef={textareaRef}
          userId={userId}
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          sendMsg={sendMsg}
          isTall={isTall}
          handleInputChange={handleInputChange}
          setReplyingTo={setReplyingTo}
          emojiOpen={emojiOpen}
          setEmojiOpen={setEmojiOpen}
        />
      </div>
    </>
  );
}

export default Chat;
