import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export default function Layout() {
  return (
    <div className="app-shell min-h-screen bg-background text-foreground transition-colors duration-300">
      <Sidebar />
      <main className="app-main-shell min-h-screen pl-[282px]">
        <div className="mx-auto max-w-[1480px] p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
