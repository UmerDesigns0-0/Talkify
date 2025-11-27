import EmojiDropDown from "./Message Input Items/EmojiDropDown";
import ReplyPreview from "./Message Input Items/ReplyPreview";

function MessageInput({
  emojiPicker,
  emojiButtonRef,
  emojiPickerRef,
  replyingTo,
  textareaRef,
  userId,
  currentMessage,
  sendMsg,
  handleInputChange,
  setReplyingTo,
  isTall,
  emojiOpen,
  setEmojiOpen,
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {/* Emoji button + textarea wrapper */}
      <div ref={emojiButtonRef} className="relative flex-1 min-w-0">
        {/* Emoji Dropdown */}
        <EmojiDropDown
          emojiOpen={emojiOpen}
          emojiPicker={emojiPicker}
          emojiPickerRef={emojiPickerRef}
        />

        {/* Reply Preview */}
        <ReplyPreview
          replyingTo={replyingTo}
          userId={userId}
          setReplyingTo={setReplyingTo}
        />

        {/* TEXTAREA + SEND BUTTON CONTAINER */}
        <div className="relative flex items-center">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={currentMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMsg();
              }
            }}
            placeholder="Type your message..."
            className={`field-sizing-content w-full min-h-10 max-h-60 overflow-y-auto resize-none border bg-white border-gray-300 pl-10 pr-12 py-6 focus:outline-none placeholder-shown:leading-0.5 focus:leading-0.5 ${
              isTall ? "rounded-md" : "rounded-full"
            }`}
          />

          {/* Emoji button (vertical center) */}
          <button
            onClick={() => setEmojiOpen((p) => !p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMsg();
              }
            }}
            className="absolute outline-none cursor-pointer left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.3}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z"
              />
            </svg>
          </button>

          {/* Send button (vertical center ALWAYS) */}
          <button
            onClick={sendMsg}
            className="absolute outline-none right-3 top-1/2 -translate-y-1/2 text-white bg-emerald-500 rounded-full p-2 cursor-pointer hover:bg-emerald-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.2}
              stroke="currentColor"
              className="size-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageInput;
