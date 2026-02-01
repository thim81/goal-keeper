import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Fix iOS PWA viewport height issue
function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Set on load
setVH();

// Update on resize (e.g., when rotating device)
window.addEventListener('resize', setVH);

// Also update on orientation change
window.addEventListener('orientationchange', () => {
  setTimeout(setVH, 100); // Small delay to ensure new dimensions are available
});

createRoot(document.getElementById("root")!).render(<App />);
