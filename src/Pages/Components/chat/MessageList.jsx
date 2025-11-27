import { useState } from "react";

import HoverMenu from "./Message Items/HoverMenu";
import ReplyBubble from "./Message Items/ReplyBubble";

function MessageList({
  item,
  index,
  userId,
  messagesRef,
  onScrollToMessage,
  textareaRef,
  onDelete,
  setReplyingTo,
}) {
  const [showMore, setShowMore] = useState(null);
  const [showMsgMenu, setShowMsgMenu] = useState(null);
  if (item.type === "join" || item.type === "left" || item.type === "kicked") {
    return (
      <div
        key={index}
        draggable="false"
        className="flex justify-center my-2 text-[11px] select-none text-gray-600 text-center bg-gray-300 rounded-full py-1 px-3 w-fit mx-auto"
      >
          {item.type === "kicked" ? (
            item.username === userId ? (
              `You were kicked by ${item.kickedBy}`
            ) : (
              `${item.kickedBy} kicked ${item.username}`
            )
          ) : (
            `${item.id === userId ? "You" : item.username} ${item.type === "join" ? "joined" : "left"} the room`
          )}
      </div>
    );
  }

  const isExpanded = showMore === index;
  const isLong = item.message.length > 500;
  const message =
    isLong && !isExpanded ? `${item.message.slice(0, 500)}...` : item.message;

  const toggleShowMore = () => {
    setShowMore((prev) => (prev === index ? null : index));
  };

  const isHovered = showMsgMenu === index;

  const displayMessage = item.deleted
    ? `${item.id === userId ? "You" : item.author} deleted this message`
    : message;

  return (
    <div
      ref={(el) => {
        if (item.messageId) {
          messagesRef.current[item.messageId] = el;
        }
      }}
      data-message-id={item.messageId}
      data-sender-id={item.id}
      onMouseEnter={() => setShowMsgMenu(index)}
      onMouseLeave={() => setShowMsgMenu(null)}
      className="flex flex-col-reverse gap-1"
    >
      <div
        className={`transition-all duration-300 
          ${
            isHovered
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
      >
        {isHovered && !item.deleted && (
          <HoverMenu
            item={item}
            onDelete={onDelete}
            setReplyingTo={setReplyingTo}
            userId={userId}
            textareaRef={textareaRef}
          />
        )}
      </div>
      <div
        key={index}
        className={`text-black p-2 rounded-lg max-w-xs wrap-break-word ${
          item.id === userId
            ? "self-end bg-emerald-200"
            : "self-start bg-gray-300"
        }`}
      >
        {item.replyTo && !item.deleted && (
          <ReplyBubble
            item={item}
            onScrollToMessage={onScrollToMessage}
            userId={userId}
          />
        )}
        <div className={`${item.deleted ? "text-xs text-gray-500" : ""}`}>
          {displayMessage}
        </div>
        {/* show more/less button */}
        {isLong && !item.deleted && (
          <button
            onClick={toggleShowMore}
            className="flex cursor-pointer text-[13px] text-emerald-700 hover:text-emerald-800 hover:underline ring-offset-4"
          >
            {isExpanded ? "show less" : "show more"}
          </button>
        )}

        <div className="flex justify-end items-center gap-1 mt-1">
          <div className="text-xs text-gray-500 select-none">{item.time}</div>
          <div className="font-bold text-xs text-gray-500">
            • {item.id === userId ? "You" : item.author}
          </div>
          {item.id === userId && !item.deleted && (
            <div
              title={
                item.seenBy && item.seenBy.length > 1
                  ? `Seen by ${item.seenBy.length - 1} user(s)`
                  : "No active users"
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className={`w-3 h-3 transition-colors duration-200 ${
                  item.seenBy && item.seenBy.length > 1
                    ? "text-blue-500"
                    : "text-gray-400"
                }`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageList;
