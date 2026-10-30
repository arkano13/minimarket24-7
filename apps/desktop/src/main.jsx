import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.jsx";

import "./tokens.css";
import "./styles.css";

// La ruedita del mouse no cambia los números: al girarla sobre un campo
// numérico enfocado se le quita el foco y la página se desplaza normal.
document.addEventListener(
  "wheel",
  (event) => {
    const campo = document.activeElement;
    if (campo?.type === "number" && campo === event.target) campo.blur();
  },
  { passive: true },
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);