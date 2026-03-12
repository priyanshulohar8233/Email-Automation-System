# Email Automation & Tracking System

A professional email tracking and delivery system built with Node.js, Express, and Python (FastAPI). This system is designed for high-performance email outreach with complete bounce, open, and click tracking.

## Features

- **Email Tracking**: 1x1 pixel tracking for opens and link redirection for click tracking.
- **Campaign Management**: Create, edit, and manage email campaigns with a professional dashboard.
- **Real-time Analytics**: Live feed of delivery events, including geographic data (City/Country) and device info.
- **Reporting**: Visual charts and tables for campaign performance metrics.
- **Webhook Support**: Ready for integration with third-party email providers for bounce and event tracking.

## Tech Stack

- **Backend**: Python (FastAPI), Node.js (Express), SQLite, SQLAlchemy.
- **Frontend**: React, Tailwind CSS, Recharts, Lucide React.
- **Automation**: Celery (integrated for scheduled delivery).

## Local Setup

### Backend (Python)
1. Navigate to `/backend`.
2. Install dependencies: `pip install -r requirements.txt`.
3. Start the server: `python main.py`.

### Frontend (React)
1. Navigate to `/frontend`.
2. Install dependencies: `npm install`.
3. Start the dev server: `npm run dev`.

## License
MIT
