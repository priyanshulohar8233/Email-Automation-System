import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ClawdAssistant } from "../dashboard/ClawdAssistant";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Sidebar />
      <main className="pl-[260px] min-h-screen">
        <div className="mx-auto max-w-[1440px] p-8 relative">
          <Outlet />
        </div>
      </main>
      <ClawdAssistant />
    </div>
  );
}
