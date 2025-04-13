# Discord Auth App

A React and Express application that implements Discord OAuth authentication.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm

### Discord Developer Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to the "OAuth2" tab
4. Add a redirect URL: `http://localhost:5000/auth/discord/callback`
5. Copy your Client ID and Client Secret

### Environment Configuration
1. In the `server` directory, update the `.env` file with your Discord credentials:
```
PORT=5000
CLIENT_ID=your_discord_client_id
CLIENT_SECRET=your_discord_client_secret
REDIRECT_URI=http://localhost:5000/auth/discord/callback
CLIENT_REDIRECT=http://localhost:3000/welcome
```

### Installation

#### Server Setup
```bash
cd server
npm install
npm run dev
```

#### Client Setup
```bash
cd client
npm install
npm start
```

## Usage
1. Open your browser and navigate to `http://localhost:3000`
2. Click "Login with Discord"
3. You'll be redirected to Discord's authorization page
4. After authorization, you'll be redirected to the welcome page

## Features
- Discord OAuth authentication
- Display user profile information
- Session management
- Logout functionality

## Tech Stack
- Frontend: React, TypeScript, React Router
- Backend: Express, Passport.js with Discord strategy
- Authentication: Discord OAuth2 