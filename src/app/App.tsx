import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";

// Lazy-load each route so a module failure in one doesn't crash the others
const SurveyApp = lazy(() => import("./components/SurveyApp"));
const PanelLayout = lazy(() => import("./components/panel/PanelLayout"));
const OnboardingApp = lazy(() => import("./components/onboarding/OnboardingApp"));

function RouteLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
      }}
    >
      <span
        style={{
          fontFamily: "Silkscreen, monospace",
          fontSize: 11,
          color: "#444",
          letterSpacing: 2,
        }}
      >
        Cargando...
      </span>
    </div>
  );
}

function SurveyRoute() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <SurveyApp />
    </Suspense>
  );
}

function PanelRoute() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <PanelLayout />
    </Suspense>
  );
}

function OnboardingRoute() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <OnboardingApp />
    </Suspense>
  );
}

const router = createBrowserRouter([
  { path: "/entrar", Component: OnboardingRoute },
  { path: "/panel/*", Component: PanelRoute },
  { path: "/*", Component: SurveyRoute },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
