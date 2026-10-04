import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/AppRouter";
import { initMetaPixel } from "@/utils/metaPixel";

// Initialize Meta Pixel (ID: 690863659974240)
initMetaPixel();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
