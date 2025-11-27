function ReplyPreview({ replyingTo, userId, setReplyingTo }) {
  return (
    <>
      {replyingTo && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-2 mx-1 rounded mb-2 text-sm flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-emerald-700 text-xs mb-1.5">
              Replying to{" "}
              {replyingTo.id === userId ? "yourself" : replyingTo.author}:
            </div>
            <div className="text-gray-600 truncate">
              {replyingTo.message.slice(0, 80)}
              {replyingTo.message.length > 80 ? "..." : ""}
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="ml-2 cursor-pointer text-red-500 hover:text-red-700 shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

export default ReplyPreview;
