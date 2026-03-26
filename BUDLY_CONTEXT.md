# Budly — Product Context

## Goal
Help users understand their spending habits and identify where they can save money.

---

## Stack
- **Frontend**: React (Vite), React Router, React Query, Axios, Material UI, Notistack, Recharts
- **Backend**: Node.js (TBD), PostgreSQL, Prisma
- **Infra**: Docker Compose, Caddy, VPS Ionos

---

## Expense types
- **Fixed recurring**: rent, subscriptions — constant amount, predictable date
- **Variable recurring**: groceries, fuel — regular frequency, fluctuating amount
- **One-time**: travel, electronics — unpredictable, usually high amount

---

## V1 Scope

### 1. Import
- CSV bank file import
- Automatic merchant detection
- Deduplication

### 2. Categorization
- Custom categories (color, icon)
- Merchant → category rules (learned over time)
- "To categorize" screen grouped by merchant
- Type tagging: fixed / variable / one-time

### 3. Monthly Dashboard
- Current balance
- Spending breakdown by category
- Month-over-month comparison
- Visual alerts on overspending

### 4. Trends Analysis
- Per-category evolution over 3–6 months
- Highlight drifting spending habits
- Visual history (curves or stacked bars)

### 5. Category Budgets
- Set a monthly cap per category
- Real-time consumption indicator (e.g. 120€ / 150€)
- Alert when approaching or exceeding threshold

### 6. Savings Simulator
- Pick a category and set a reduced target
- Show projected monthly and yearly savings
- Compare with current habit

### 7. Balance Projection
- Estimated 30-day balance curve
- Fixed recurrings auto-scheduled
- Variables estimated from historical average
- End-of-month balance indicator

---

## Out of scope (V2+)
- Automatic bank connection (Bridge API / Powens)
- Savings goals
- Multi-account
- Native mobile app
