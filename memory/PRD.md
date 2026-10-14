# MatShop.id — PRD

## Original Problem Statement
Marketplace hibrida B2B/B2C + Jasa/Aset Kreator "MatShop.id" (requested Next.js/TS; built on Emergent stack React + Tailwind + FastAPI + MongoDB per user choice). Supplier Material, Kontraktor, Desainer/Arsitek. Material catalog (Plywood, SPC, WallPanel, HPL, Marmer/Granit, Lis Profil, Loose Furniture) with tiered wholesale pricing; designer services (Arsitektur, 3D Render, DED, RAB) & 3D digital assets (.skp, D5, FBX, textures) with auto-download after transaction; multi-role dashboards; hero, catalog tabs, popular sections; cart & checkout with escrow.

## User Choices
- Stack: React + FastAPI + MongoDB
- Auth: Unified account, Emergent Google OAuth, onboarding Primary Role modal, `primary_role` + `enabled_roles` + `active_role`, role switcher
- Escrow: MOCK simulation
- Uploads: product photos via Emergent Object Storage; asset files = URL links
- Demo data seeded + demo login per role

## Architecture
- backend/server.py (auth, listings, uploads, cart, checkout, payments mock, orders escrow, seller stats), backend/seed.py
- Collections: users, user_sessions, listings (type material/service/asset), carts, orders (split per seller), payments, files
- Frontend pages: Home, Catalog, ListingDetail (tier calculator), Cart, Checkout, Payment (mock), Orders, Dashboard (supplier/designer/buyer), Login

## Implemented (2026-06)
- All above; tested 25/25 backend, frontend e2e passed; fixed checkout deep-link race

## Backlog
- P1: Real payment gateway (Midtrans/Xendit/Stripe), dispute flow, auto-release timer
- P1: Reviews & ratings, seller profile/storefront pages
- P2: Quote request (RFQ) for B2B bulk, shipping cost calculator, chat buyer-seller
- P2: Restrict self-enabling seller roles (verification/KYC)
