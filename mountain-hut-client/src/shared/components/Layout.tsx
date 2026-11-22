import { Outlet, useLocation } from "react-router";
import Navbar from "./Navbar";
import { BrandIcon } from "./Logo.tsx";

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-800 pt-14 overflow-x-clip">
      <Navbar />

      <main className={`flex-1 w-full ${isHome ? "" : "max-w-5xl mx-auto px-4 py-8"}`}>
        <Outlet />
      </main>

      <footer className="relative z-20 text-sm text-stone-600 py-4 bg-white/85 backdrop-blur-lg backdrop-saturate-150 border-t border-white/50">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center sm:justify-between gap-x-6 gap-y-1">
          <span className="flex items-center gap-2 font-semibold text-[#175735]">
            <BrandIcon className="w-7 h-7" />
            Mountain Hut
          </span>
          <span className="text-stone-500">High altitude hut · 2,354 m · © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
