function EmojiDropDown({emojiOpen, emojiPicker, emojiPickerRef}) {
  return (
    <>
      {emojiOpen && (
        <div
          ref={emojiPickerRef}
          className={`absolute bottom-20 left-8 z-10 ${
            emojiOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 pointer-events-none"
          }`}
        >
          {emojiPicker}
        </div>
      )}
    </>
  );
}

export default EmojiDropDown;
