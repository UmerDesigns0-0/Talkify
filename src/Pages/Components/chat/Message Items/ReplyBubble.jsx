function ReplyBubble({ item, userId, onScrollToMessage }) {
  return (
    <div
      onClick={() => onScrollToMessage(item.replyTo.messageId)}
      className={`bg-white/50 border-l-4 text-gray-700 text-xs p-2 rounded mb-2 cursor-pointer hover:bg-white/65 transition-colors duration-200 ease-in ${
        item.id === userId
          ? "bg-emerald-200 border-emerald-500"
          : "bg-gray-300 border-gray-500"
      }`}
    >
      <div
        className={`font-semibold ${
          item.id === userId ? "text-emerald-700" : "text-gray-600"
        }`}
      >
        {item.replyTo.id === userId ? "You" : item.replyTo.author}
      </div>
      <div
        className={`line-clamp-2 ${
          item.replyTo?.deleted ? "text-xs text-gray-500 italic pr-2" : ""
        }`}
      >
        {item.replyTo.message}
      </div>
    </div>
  );
}

export default ReplyBubble;
