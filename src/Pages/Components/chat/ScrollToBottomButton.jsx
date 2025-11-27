function ScrollToBottomButton({ handleScrollToBottom }) {
  return (
    <button
      onClick={handleScrollToBottom}
      title="scroll down to bottom"
      className="group hover:scale-105 duration-300 cursor-pointer p-3.5 rounded-lg bg-white border border-gray-300 w-fit fixed bottom-50 md:bottom-40 right-4 md:right-8 z-20"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="size-5 group-hover:translate-y-1 group-focus:translate-y-1 md:group-focus:translate-y-0 transition duration-300 ease-in"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"
        />
      </svg>
    </button>
  );
}

export default ScrollToBottomButton;
