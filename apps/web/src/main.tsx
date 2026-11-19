import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "./design-system/global.css";
import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing React root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
