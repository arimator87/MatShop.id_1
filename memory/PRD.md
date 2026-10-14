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
- Dashboard tabs per role: Supplier [Stok Material, Pesanan Masuk]; Desainer [Aset 3D Saya, Layanan Jasa, Penjualan Digital]; Kontraktor [Pesanan Material, Aset Digital Terbeli, Status Escrow Payment]
- Shipping options per vendor (Ambil Mandiri / Kargo Vendor, estimate = 50k + fee/unit), dispute flow (DISPUTE freezes funds, blocks release & 7-day auto-release, buyer can withdraw), order detail page + Invoice PDF (reportlab), watermark preview for assets/services, original files only after COMPLETED

## Backlog
- DONE: Custom Furniture & Fit-Out module: homepage banner + nav, /custom-project calculator (Kitchen Set/Wardrobe per m lari, Full Interior per m2, HPL/Duco), request form with photos, 'Peluang Proyek' tab (supplier & contractor) with RAB bidding, client accepts bid, milestone escrow 30/40/30 (pay → vendor report → client release) — backend custom_projects.py
- DONE: Managed Open-Bid: client request (kategori, lokasi, est. budget, foto, detail) → PENDING_REVIEW_INTERNAL → admin Managed Project Board approve/reject → OPEN_FOR_BID → 'Project Board' tab, proposals with RAB + durasi + spesifikasi material → in-app notifications (bell) → client picks winner & pays DP 30% (m1)
- DONE: Vendor verification: 'Profil Usaha & Portofolio' tab (nama usaha, alamat, link portofolio, foto, PIC) → users.verification_status PENDING; bidding locked (UI + backend 403) unless VERIFIED; admin 'Verifikasi Vendor' tab to VERIFY/REJECT (with note) + notifications
- DONE: Progress tracking (executor posts % + photos, monotonic; dual progress bars reported vs milestone released, live polling) + Takeover Protocol (admin 'Monitoring & Takeover' tab → INTERNAL_TAKEOVER, escrow held → Master Workshop MatShop (user_master_workshop, ledger escrow_ledger), contractor suspended, client guarantee notification; admin unsuspend)
- DONE: Homepage 'Hasil Karya Kontraktor & Desainer MatShop' section (public GET /api/portfolios of VERIFIED non-suspended vendors, dialog gallery + their listings via /api/listings?owner= + CTA Ajukan Proyek Custom); 2 showcase vendors seeded
- DONE (2026-06): Public vendor profile /vendor/:id (header, stats, gallery, reviews + breakdown, listings, CTA Ajukan Proyek/Order) — backend reviews.py; Rating & Ulasan 1–5 + teks only for buyer of released order or client of completed custom project (unique per transaksi), avg on portfolio cards/profile, vendor notified; portfolio filters kota + jenis pekerjaan + sort rating on homepage & /portofolio; business profile city + work_types; seeded 9 demo reviews
- DONE (2026-06): Vendor reply to reviews (1x, editable, PUT /api/reviews/{id}/reply, reviewer notified), review photos (max 4, lightbox), bid cards show vendor rating + 'Lihat Profil' link
- NEXT: milestone dispute to admin, vendor portfolio/rating for bids, survey scheduling
- DONE: Admin mediation panel (/admin, refund_buyer→REFUNDED / release_vendor→COMPLETED), dispute photo evidence, cargo tracking (loading→departed→in_transit→arrived), NPWP tax info on checkout/order + invoice DPP/PPN 11%
- P1: Real payment gateway (Midtrans/Xendit/Stripe), dispute flow, auto-release timer
- P2: Quote request (RFQ) for B2B bulk, shipping cost calculator, chat buyer-seller
- P2: Restrict self-enabling seller roles (verification/KYC)
