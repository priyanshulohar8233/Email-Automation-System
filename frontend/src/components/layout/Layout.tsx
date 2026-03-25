import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Sidebar />
      <main className="pl-[260px] min-h-screen">
        <Header />
        <div className="mx-auto max-w-[1440px] p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
