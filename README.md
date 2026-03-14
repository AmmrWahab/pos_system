# NexusPOS — Full-Stack Point of Sale System

A complete POS system with **React** frontend, **Express** backend, and **SQLite** database via **Prisma ORM**.

---

## 📁 Project Structure

```
nexuspos/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema (SQLite)
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── products.controller.js
│   │   │   ├── services.controller.js
│   │   │   ├── transactions.controller.js
│   │   │   ├── dashboard.controller.js
│   │   │   └── reports.controller.js
│   │   ├── routes/
│   │   │   ├── products.js
│   │   │   ├── services.js
│   │   │   ├── transactions.js
│   │   │   ├── dashboard.js
│   │   │   └── reports.js
│   │   ├── index.js               # Express app entry
│   │   └── seed.js                # Sample data seeder
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Icon.jsx            # SVG icon system
    │   │   ├── Sidebar.jsx         # Navigation sidebar
    │   │   ├── Modal.jsx           # Reusable modal
    │   │   └── Spinner.jsx         # Loading spinner
    │   ├── pages/
    │   │   ├── Dashboard.jsx       # Stats + recent transactions
    │   │   ├── POS.jsx             # Product sales terminal
    │   │   ├── ServiceSales.jsx    # Service billing
    │   │   ├── Products.jsx        # Inventory management
    │   │   ├── Services.jsx        # Service catalog
    │   │   ├── Transactions.jsx    # Transaction history
    │   │   └── Reports.jsx         # PDF report generation
    │   ├── context/
    │   │   └── AppContext.jsx      # Global state (dark mode)
    │   ├── hooks/
    │   │   └── useApi.js           # useFetch + useMutation hooks
    │   ├── utils/
    │   │   ├── api.js              # Axios API calls
    │   │   └── format.js          # fmt(), fmtDate() helpers
    │   ├── styles/
    │   │   └── global.css          # All styles
    │   ├── App.jsx                 # Router + layout
    │   └── main.jsx               # Entry point
    ├── .env
    ├── index.html
    └── package.json
```

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Set up the database

```bash
cd backend

# Create the SQLite DB and run migrations
npx prisma migrate dev --name init

# Seed with sample data
node src/seed.js
```

### 3. Start the servers

```bash
# Terminal 1 — Backend (port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Open **http://localhost:5173**

---

## 🔌 API Endpoints

| Method | Endpoint                     | Description                  |
|--------|------------------------------|------------------------------|
| GET    | /api/dashboard/stats         | Dashboard summary stats      |
| GET    | /api/products                | List products (search/filter)|
| POST   | /api/products                | Create product               |
| PUT    | /api/products/:id            | Update product               |
| DELETE | /api/products/:id            | Delete product               |
| PATCH  | /api/products/:id/stock      | Adjust stock level           |
| GET    | /api/services                | List services                |
| POST   | /api/services                | Create service               |
| PUT    | /api/services/:id            | Update service               |
| DELETE | /api/services/:id            | Delete service               |
| GET    | /api/transactions            | List transactions            |
| GET    | /api/transactions/:id        | Get single transaction       |
| POST   | /api/transactions            | Create transaction (POS sale)|
| DELETE | /api/transactions/:id        | Delete transaction           |
| GET    | /api/reports/:range          | daily / weekly / yearly      |
| GET    | /api/health                  | Health check                 |

---

## 🗄️ Database

- **Engine**: SQLite (file: `backend/prisma/nexuspos.db`)
- **ORM**: Prisma
- **Tables**: `Product`, `Service`, `Transaction`, `TransactionItem`

To view data visually:
```bash
cd backend
npx prisma studio
```

---

## ✨ Features

- **Dashboard** — live stats: total sales, transactions, products, avg order value
- **POS** — product grid, category filter, cart, stock-aware checkout
- **Service Sales** — service catalog + custom one-off services
- **Products** — full CRUD with search
- **Services** — full CRUD
- **Transactions** — searchable history, itemized view modal, delete
- **Reports** — daily/weekly/yearly PDF generation with top products

---

## 🛠 Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18, React Router 6, Vite      |
| Styling  | Plain CSS with CSS variables        |
| HTTP     | Axios                               |
| Backend  | Node.js, Express 4                  |
| Database | SQLite via Prisma ORM               |
| Toasts   | react-hot-toast                     |
