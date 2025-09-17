import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Load development utilities in development mode
if (process.env.NODE_ENV === 'development') {
  import('./lib/nostr-dev-utils');
}

createRoot(document.getElementById("root")!).render(<App />);
