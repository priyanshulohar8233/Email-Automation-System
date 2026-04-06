import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export default function Layout() {
  return (
    <div className="apple-app-shell bg-background text-foreground transition-colors duration-300">
      <Sidebar />
      <main className="apple-main-shell min-h-screen pl-[284px]">
        <div className="mx-auto max-w-[1540px] px-8 py-8 xl:px-10">
          <div className="apple-page-shell">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
