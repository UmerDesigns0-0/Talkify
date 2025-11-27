// The TypingIndicator component, utilizing inline SVG animation
// and wrapped with Tailwind classes for responsive sizing and display.
const TypingIndicator = () => {
  // Using hex codes that correspond to Tailwind colors for better consistency
  // Bubble: blue-400 (#60A5FA)
  // Dots: white (#ffffff)
  const bubbleColor = "#bfc3c9";
  const dotColor = "#ffffff";

  return (
    <div className="flex items-center justify-start py-2">
      {/* The SVG is sized using w-24 (width: 96px) and h-16 (height: 64px) 
        Tailwind classes for responsive control.
      */}
      <svg
        className="h-16"
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Bubble */}
        <rect x="0" y="0" width="100" height="50" rx="10" fill={bubbleColor} />
        {/* Pointer Triangle */}
        <polygon points="20,50 30,50 25,60" fill={bubbleColor} />

        {/* Dots with SVG SMIL animation */}
        <circle cx="30" cy="25" r="5" fill={dotColor}>
          <animate
            attributeName="opacity"
            values="0;1;0"
            dur="1s"
            repeatCount="indefinite"
            begin="0s"
          />
        </circle>
        <circle cx="50" cy="25" r="5" fill={dotColor}>
          <animate
            attributeName="opacity"
            values="0;1;0"
            dur="1s"
            repeatCount="indefinite"
            begin="0.2s"
          />
        </circle>
        <circle cx="70" cy="25" r="5" fill={dotColor}>
          <animate
            attributeName="opacity"
            values="0;1;0"
            dur="1s"
            repeatCount="indefinite"
            begin="0.4s"
          />
        </circle>
      </svg>
    </div>
  );
};

export default TypingIndicator;
