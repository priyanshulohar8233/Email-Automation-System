// Force IST Timezone
(window as any).process = { env: { TZ: "Asia/Kolkata" } };

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";

// SaaS Grade: Global Timezone Standardization (Asia/Kolkata)
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Kolkata");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
