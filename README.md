# Solana Token Launchpad Backend

A database-backed REST API for a Solana token launchpad platform. Users can register, create token launches, manage whitelists, purchase tokens with tiered pricing, use referral codes, and track vesting schedules.

## Features
- User registration and login (JWT authentication)
- Launch creation with tiered pricing and optional vesting
- Whitelist management (add, list, remove addresses)
- Referral code system with usage limits and discounts
- Token purchase endpoint with sybil protection and duplicate prevention
- Real-time vesting schedule calculation
- Paginated launch listing and status computation

## Tech Stack
- **Node.js** (Express.js)
- **PostgreSQL** (via Prisma ORM)
- **JWT** for authentication
- **bcryptjs** for password hashing

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/dhanushsanand/solana_token_launchpad.git
   cd solana_token_launchpad
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Create a `.env` file in the project root:
     ```env
     DATABASE_URL="postgresql://<user>@localhost:5432/<db_name>"
     JWT_SECRET="your-secret-key"
     ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start the server**
   ```bash
   npm start
   ```
   Server runs on port 3000.

## API Endpoints

### Health
- `GET /api/health` — Returns `{ status: "ok" }`

### Auth
- `POST /api/auth/register` — Register a new user
- `POST /api/auth/login` — Login

### Launches
- `POST /api/launches` — Create a launch (auth required)
- `GET /api/launches` — List launches (public, paginated)
- `GET /api/launches/:id` — Get launch by ID (public)
- `PUT /api/launches/:id` — Update launch (auth, creator only)

### Whitelist
- `POST /api/launches/:id/whitelist` — Add addresses (auth, creator only)
- `GET /api/launches/:id/whitelist` — List whitelist (auth, creator only)
- `DELETE /api/launches/:id/whitelist/:address` — Remove address (auth, creator only)

### Referrals
- `POST /api/launches/:id/referrals` — Create referral code (auth, creator only)
- `GET /api/launches/:id/referrals` — List referral codes (auth, creator only)

### Purchases
- `POST /api/launches/:id/purchase` — Record a purchase (auth required)
- `GET /api/launches/:id/purchases` — List purchases (creator sees all, others see their own)

### Vesting
- `GET /api/launches/:id/vesting?walletAddress=ADDR` — Calculate vesting for a wallet

## License
MIT
