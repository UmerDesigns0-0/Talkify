import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { useState, useEffect } from "react";

import { Toaster } from "react-hot-toast";

import ChatPage from "./Pages/ChatPage";
import Header from "./Pages/Header";
import Footer from "./Pages/Footer";

function App() {
  const [showChat, setShowChat] = useState(
    () => localStorage.getItem("showChat") === "true"
  );

  const [activeMenu, setActiveMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem("showChat", showChat);
  }, [showChat]);

  return (
    <>
      <Router>
        <Toaster
          toastOptions={{
            success: {
              style: {
                background: "#6eeb63",
                color:"#fff"
              },
            },
            error: {
              style: {
                background: "#f77984",
                color:"#fff"
              },
            },
          }}
        />
        <div className="h-full bg-gray-100 flex flex-col justify-between min-h-screen">
          <Header setActiveMenu={setActiveMenu} showChat={showChat} setShowChat={setShowChat} />
          <Routes>
            <Route
              path="/"
              element={
                <ChatPage showChat={showChat} setShowChat={setShowChat} activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
              }
            />
          </Routes>
          <Footer />
        </div>
      </Router>
    </>
  );
}

export default App;
