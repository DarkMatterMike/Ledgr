import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import BriefingPage from "./BriefingPage.jsx";
import "./index.css";

const isBriefing = window.location.pathname === "/briefing";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isBriefing ? <BriefingPage /> : <App />}
  </React.StrictMode>
);
