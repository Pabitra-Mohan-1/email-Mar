import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
setBaseUrl(apiBaseUrl);

// Override global fetch to redirect relative /api calls and include credentials for cross-domain cookies
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  const newInit = { ...init };
  newInit.credentials = "include";

  let finalInput = input;
  if (apiBaseUrl) {
    if (typeof input === "string" && input.startsWith("/api")) {
      finalInput = `${apiBaseUrl}${input}`;
    } else if (input instanceof URL && input.pathname.startsWith("/api")) {
      finalInput = new URL(`${apiBaseUrl}${input.pathname}${input.search}`);
    } else if (input instanceof Request && input.url.includes("/api")) {
      // If request url is relative (or starts with "/api"), prepend base
      const parsedUrl = new URL(input.url, window.location.origin);
      if (parsedUrl.pathname.startsWith("/api")) {
        const newUrl = `${apiBaseUrl}${parsedUrl.pathname}${parsedUrl.search}`;
        finalInput = new Request(newUrl, input);
      }
    }
  }

  return originalFetch(finalInput, newInit);
};

createRoot(document.getElementById("root")!).render(<App />);

