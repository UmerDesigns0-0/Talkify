import { EmojiPicker } from "frimousse";

export default function MyEmojiPicker({ onEmojiClick }) {
  return (
    <EmojiPicker.Root
      onEmojiSelect={onEmojiClick}
      className="max-h-80 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
    >
      <div className="max-h-[280px] overflow-y-auto">
        <EmojiPicker.Search
          className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-2 focus:border-emerald-300"
          placeholder="Search emoji..."
        />

        <EmojiPicker.Viewport className="p-2">
          <EmojiPicker.Loading className="text-gray-500 text-sm">
            Loading…
          </EmojiPicker.Loading>
          <EmojiPicker.Empty className="text-gray-400 text-sm text-center">
            No emoji found.
          </EmojiPicker.Empty>
          <EmojiPicker.List
            className="select-none pb-1.5"
            components={{
              CategoryHeader: ({ category, ...props }) => (
                <div
                  className="bg-white px-3 pt-3 pb-1.5 font-medium text-neutral-600 text-xs"
                  {...props}
                >
                  {category.label}
                </div>
              ),
              Row: ({ children, ...props }) => (
                <div className="scroll-my-1.5 px-1.5" {...props}>
                  {children}
                </div>
              ),
              Emoji: ({ emoji, ...props }) => (
                <button
                  className="flex size-10 items-center justify-center rounded-md text-lg data-active:bg-neutral-100"
                  {...props}
                >
                  {emoji.emoji}
                </button>
              ),
            }}
          />
        </EmojiPicker.Viewport>
      </div>
    </EmojiPicker.Root>
  );
}
