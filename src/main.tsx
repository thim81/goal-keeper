import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function isIosStandalonePwa() {
  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return isIOS && isStandalone;
}

// Fix iOS PWA viewport height issue
function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

// Set immediately
setVH();

// Set after a short delay (for PWA viewport adjustment)
setTimeout(setVH, 100);
setTimeout(setVH, 500);

// Update on various events
window.addEventListener("resize", setVH);
window.addEventListener("orientationchange", () => {
  setTimeout(setVH, 100);
  setTimeout(setVH, 500);
});

// Listen for visibility change (PWA becoming active)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    setTimeout(setVH, 100);
  }
});

// iOS may restore from back/forward cache when reopening.
if (isIosStandalonePwa()) {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });
}

// PWA-specific: listen for app install/launch
window.addEventListener("appinstalled", () => {
  setTimeout(setVH, 100);
});

createRoot(document.getElementById("root")!).render(<App />);
