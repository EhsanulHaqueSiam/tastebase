import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./components/Shell.tsx";
import { Browse } from "./pages/Browse.tsx";
import { Home } from "./pages/Home.tsx";
import "./styles.css";

const root = createRootRoute({ component: Shell });
const router = createRouter({
  routeTree: root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/", component: Home }),
    createRoute({ getParentRoute: () => root, path: "/browse", component: Browse }),
    createRoute({ getParentRoute: () => root, path: "/browse/$id", component: Browse }),
  ]),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
