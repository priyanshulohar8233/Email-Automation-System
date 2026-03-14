/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Layout from "./components/layout/Layout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Templates = lazy(() => import("./pages/Templates"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const AITemplates = lazy(() => import("./pages/AITemplates"));
const SubscriberProfile = lazy(() => import("./pages/SubscriberProfile"));
const SuppressionList = lazy(() => import("./pages/SuppressionList"));
const Automations = lazy(() => import("./pages/Automations"));

const Loading = () => (
    <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Lumina Loading...</p>
        </div>
    </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="templates">
              <Route index element={<Navigate to="custom" replace />} />
              <Route path="custom" element={<Templates />} />
              <Route path="feature" element={<AITemplates />} />
            </Route>
            <Route path="contacts" element={<Contacts />} />
            <Route path="contacts/:id" element={<SubscriberProfile />} />
            <Route path="analytics">
              <Route index element={<Analytics />} />
              <Route path="suppressions" element={<SuppressionList />} />
            </Route>
            <Route path="settings" element={<Settings />} />
            <Route path="automations" element={<Automations />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
