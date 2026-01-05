# LinedUp

Booking management app for businesses and clients.

## Tech Stack

- **Frontend:** React 18 + Vite
- **Backend:** Supabase (Auth, Database, Storage)
- **Notifications:** Twilio WhatsApp via Railway
- **Styling:** Tailwind CSS + Radix UI

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 3. Run development server

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_WHATSAPP_API_URL` | Your Railway WhatsApp service URL |

## Project Structure

```
src/
├── api/              # API client (backward compatibility)
├── components/       # React components
│   ├── ui/          # shadcn/ui components
│   └── UserContext  # Auth state management
├── lib/
│   └── supabase/    # Supabase client & services
├── pages/           # Page components
└── App.jsx          # Main app with providers
```

## Features

- WhatsApp OTP authentication
- Business management (services, staff, hours)
- Client booking flow
- Calendar view
- Notifications
- Waiting list
