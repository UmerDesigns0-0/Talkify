import { Link } from "react-router-dom";
import socket from "../Socket";

function Header({ showChat, setShowChat, setActiveMenu }) {
  return (
    <div>
      <div className="bg-emerald-600 p-4 top-0 sticky z-50 text-white flex items-center justify-between">
        <div className="flex gap-4 items-center">
          {/* Back button */}
          {showChat && (
            <button
              onClick={() => {
                setShowChat(false);
                socket.disconnect();
                console.log("You disconnected manually");
              }}
              className="group hover:bg-emerald-500 outline-none rounded-md py-2 px-4"
              title="Return to home"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-5 group-hover:-translate-x-1 transition-transform duration-200"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Center title */}
        <div className="flex-1 text-center">
          <Link to={'/'}>
            <span
              className="text-xl text-slate-200 font-medium select-none"
              draggable="false"
            >
              Talki<span className="text-emerald-300">fy</span>
            </span>
          </Link>
        </div>

        {/* Right side: user menu toggle */}
        <div className="relative inline-block text-right">
          {showChat && (
            <button
              onClick={() => setActiveMenu((p) => !p)}
              id="login-button"
              className="hover:bg-emerald-500 outline-none rounded-md p-1.5 mr-2 transition-colors duration-200"
              aria-haspopup="true"
              aria-expanded={false}
            >
            <svg
              width="25px"
              height="25px"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                <circle
                  cx="12"
                  cy="6"
                  r="4"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                ></circle>
                <path
                  d="M15 20.6151C14.0907 20.8619 13.0736 21 12 21C8.13401 21 5 19.2091 5 17C5 14.7909 8.13401 13 12 13C15.866 13 19 14.7909 19 17C19 17.3453 18.9234 17.6804 18.7795 18"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                ></path>
              </g>
            </svg>
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

export default Header;
