import uuid
from datetime import datetime, timezone, timedelta


def img(pid):
    return f"https://images.unsplash.com/photo-{pid}?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"


I = {
    "plywood": img("1627590720218-c5ed819dae7e"),
    "marble": img("1709023467724-76b796b0c7d2"),
    "spc": img("1617090446934-b9058290f047"),
    "wp1": img("1701421052582-9f6935aff566"),
    "wp2": img("1700809887581-c41c239e808e"),
    "wp3": img("1701422052139-e72ee5e67249"),
    "bp1": img("1721244654394-36a7bc2da288"),
    "bp2": img("1542621334-a254cf47733d"),
    "chair1": img("1634712282287-14ed57b9cc89"),
    "chair2": img("1617364852223-75f57e78dc96"),
    "wood1": img("1644931551533-02906718127f"),
    "wood2": img("1619976553860-b7ffbe9a093b"),
    "wood3": img("1611600700192-d87eaeed4f81"),
    "k1": img("1600489000022-c2086d79f9d4"),
    "k2": img("1722605090433-41d1183a792d"),
    "k3": img("1663811396777-05505d999151"),
    "living": img("1600210492486-724fe5c67fb0"),
    "lounge": img("1618221195710-dd6b41faaea6"),
    "studio": img("1630659508738-74252299fa4d"),
}

DEMO_USERS = [
    {"user_id": "user_demo_buyer", "email": "kontraktor@matshop.id", "name": "CV Bangun Jaya (Kontraktor)",
     "primary_role": "contractor_buyer", "enabled_roles": ["contractor_buyer"]},
    {"user_id": "user_demo_supplier", "email": "supplier@matshop.id", "name": "PT Material Nusantara",
     "primary_role": "supplier_vendor", "enabled_roles": ["supplier_vendor", "contractor_buyer"]},
    {"user_id": "user_demo_designer", "email": "desainer@matshop.id", "name": "Studio Ruang Arsitek",
     "primary_role": "designer_creator", "enabled_roles": ["designer_creator", "contractor_buyer"]},
]

S = ("user_demo_supplier", "PT Material Nusantara")
D = ("user_demo_designer", "Studio Ruang Arsitek")


def mat(title, category, price, wholesale, unit, stock, images, desc, specs, sold, threshold=50):
    return dict(type="material", category=category, title=title, price=price, unit=unit, stock=stock,
                tiers=[{"min_qty": threshold + 1, "price": wholesale}], images=images, description=desc,
                specs=specs, sold=sold, owner=S)


def svc(title, category, price, days, images, desc, revisions, sold):
    return dict(type="service", category=category, title=title, price=price, unit="paket", stock=None, tiers=[],
                images=images, description=desc, delivery_days=days, revisions=revisions, sold=sold, owner=D)


def asset(title, category, price, fmt, size, images, desc, sold):
    return dict(type="asset", category=category, title=title, price=price, unit="file", stock=None, tiers=[],
                images=images, description=desc, file_format=fmt, file_size=size, sold=sold, owner=D,
                file_url=f"https://files.matshop.id/demo/{uuid.uuid4().hex[:8]}.{fmt.lower().strip('.')}")


SEED_LISTINGS = [
    mat("Plywood Meranti 18mm Grade A", "plywood", 285000, 252000, "lembar", 1200, [I["plywood"], I["wood3"]],
        "Multiplek meranti 18mm 122x244cm, permukaan halus siap finishing HPL/duco. Cocok untuk kitchen set & wardrobe.",
        {"Ukuran": "122 x 244 cm", "Tebal": "18 mm", "Grade": "A/A", "Lem": "Melamine E1"}, 842),
    mat("Plywood Falcata 12mm Ekonomis", "plywood", 158000, 139000, "lembar", 2400, [I["wood3"], I["plywood"]],
        "Plywood falcata ringan untuk partisi, backing furniture, dan bekisting ringan.",
        {"Ukuran": "122 x 244 cm", "Tebal": "12 mm", "Grade": "BB/CC"}, 1310),
    mat("HPL Woodgrain Walnut 0.8mm", "hpl", 165000, 142000, "lembar", 860, [I["wood2"], I["wood1"]],
        "High Pressure Laminate motif walnut, tahan gores & panas. Finishing matt-texture.",
        {"Ukuran": "122 x 244 cm", "Tebal": "0.8 mm", "Finishing": "Matt Texture"}, 615),
    mat("SPC Flooring Oak Natural 5mm", "spc", 189000, 164000, "m2", 3500, [I["spc"], I["wood1"]],
        "Lantai SPC click-lock 100% waterproof dengan underlayment IXPE 1mm. Wear layer 0.5mm.",
        {"Tebal": "5 mm + 1 mm IXPE", "Wear Layer": "0.5 mm", "Sistem": "Click Lock", "Isi/Box": "2.2 m2"}, 1975),
    mat("SPC Flooring Grey Ash 4mm", "spc", 159000, 138000, "m2", 2800, [I["wood1"], I["spc"]],
        "SPC motif kayu abu modern untuk apartemen & kantor. Anti rayap, anti jamur.",
        {"Tebal": "4 mm", "Wear Layer": "0.3 mm", "Sistem": "Click Lock"}, 1022),
    mat("Marmer Statuario Italia 60x120", "marmer", 1250000, 1090000, "m2", 420, [I["marble"], I["k2"]],
        "Marmer impor Statuario putih dengan urat abu tegas. Polished, cocok untuk lantai lobby & meja island.",
        {"Ukuran": "60 x 120 cm", "Tebal": "18 mm", "Finishing": "Polished"}, 188, 20),
    mat("Granit Absolute Black 60x60", "marmer", 465000, 410000, "m2", 900, [I["k3"], I["marble"]],
        "Granit hitam solid untuk top table, tangga, dan fasad.",
        {"Ukuran": "60 x 60 cm", "Tebal": "15 mm", "Finishing": "Honed"}, 344),
    mat("WallPanel WPC Fluted Teak 16cm", "wallpanel", 98000, 84000, "batang", 5000, [I["wp2"], I["wp3"]],
        "Panel dinding WPC fluted 16 x 290cm motif teak. Pemasangan cepat dengan lem & paku tembak.",
        {"Ukuran": "16 x 290 cm", "Material": "WPC", "Indoor": "Ya"}, 2840),
    mat("WallPanel PVC Marble Sheet 122x244", "wallpanel", 325000, 289000, "lembar", 740, [I["wp1"], I["marble"]],
        "PVC marble sheet glossy pengganti marmer asli, ringan dan waterproof.",
        {"Ukuran": "122 x 244 cm", "Tebal": "3 mm", "Finishing": "High Gloss"}, 690),
    mat("Lis Profil PU Minimalis 8cm", "lis", 72000, 61000, "batang", 3100, [I["wp3"], I["living"]],
        "Lis profil polyurethane untuk plafon dan dinding. Siap cat, anti rayap.",
        {"Panjang": "240 cm", "Lebar": "8 cm", "Material": "PU"}, 1150),
    mat("Lounge Chair Bentwood Oak", "furniture", 2450000, 2150000, "pcs", 64, [I["chair2"], I["chair1"]],
        "Kursi santai rangka bentwood oak dengan bantalan kain premium. Untuk proyek hospitality.",
        {"Dimensi": "68 x 82 x 100 cm", "Rangka": "Oak Bentwood"}, 97, 10),
    mat("Accent Armchair Scandinavian Blue", "furniture", 1890000, 1650000, "pcs", 40, [I["chair1"], I["lounge"]],
        "Armchair gaya skandinavia, kaki kayu solid, kain linen biru dusty.",
        {"Dimensi": "72 x 75 x 85 cm", "Kain": "Linen"}, 58, 10),
    svc("Desain Interior 3D Render — Per Ruang", "interior3d", 1500000, 7, [I["living"], I["lounge"]],
        "Desain interior lengkap dengan 3 view render fotorealistik (D5/Enscape), moodboard material, dan rekomendasi produk dari MatShop.",
        2, 312),
    svc("Desain Arsitektur Rumah Tinggal (Konsep + Fasad)", "arsitektur", 12500000, 21, [I["bp1"], I["studio"]],
        "Konsep massa bangunan, denah, tampak, potongan, dan 4 render fasad untuk rumah tinggal hingga 250 m2.",
        3, 64),
    svc("Gambar Kerja (DED) Interior Lengkap", "ded", 4500000, 10, [I["bp2"], I["bp1"]],
        "Detail Engineering Design: denah, tampak, potongan, detail furniture & konstruksi siap tender.",
        2, 141),
    svc("Penyusunan RAB Proyek Interior/Renovasi", "rab", 2500000, 5, [I["bp2"], I["studio"]],
        "Rencana Anggaran Biaya detail per item pekerjaan dengan harga material terkini dari supplier MatShop.",
        1, 208),
    svc("Desain Kitchen Set 3D + Gambar Produksi", "interior3d", 2200000, 6, [I["k1"], I["k2"]],
        "Desain kitchen set 3D render + gambar produksi (cutting list plywood & HPL).",
        2, 175),
    asset("Kitchen Set Modern Pack (SketchUp)", "skp", 149000, ".SKP", "84 MB", [I["k2"], I["k1"]],
          "12 model kitchen set modern siap pakai, lengkap material & komponen dinamis. SketchUp 2021+.", 1240),
    asset("Living Room Scene — D5 Render Ready", "d5", 225000, ".D5", "1.2 GB", [I["lounge"], I["living"]],
          "Scene ruang keluarga lengkap pencahayaan & material siap render di D5 Render 2.6+.", 486),
    asset("Furniture Lounge Chair Collection (FBX)", "fbx", 99000, ".FBX", "56 MB", [I["chair2"], I["chair1"]],
          "8 model kursi lounge high-poly dengan UV & tekstur PBR, kompatibel Blender/3ds Max/D5.", 731),
    asset("PBR Texture Pack — Kayu & Marmer 4K", "texture", 79000, ".ZIP", "2.4 GB", [I["wood1"], I["marble"]],
          "60 tekstur PBR 4K (albedo, normal, roughness) kayu, marmer, dan teraso seamless.", 2210),
    asset("Wall Panel Fluted Library (SketchUp)", "skp", 59000, ".SKP", "22 MB", [I["wp2"], I["wp1"]],
          "Library wallpanel fluted & lis profil sesuai produk supplier MatShop.", 905),
    asset("Dark Kitchen Interior Scene (FBX + Textures)", "fbx", 189000, ".FBX", "640 MB", [I["k3"], I["k1"]],
          "Scene dapur gelap minimalis lengkap tekstur 4K, siap import ke Blender/3ds Max.", 322),
]


async def seed(db):
    for u in DEMO_USERS:
        await db.users.update_one({"user_id": u["user_id"]}, {"$setOnInsert": {
            **u, "picture": "", "active_role": u["primary_role"],
            "created_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    if await db.listings.count_documents({}) > 0:
        return
    now = datetime.now(timezone.utc)
    docs = []
    for i, item in enumerate(SEED_LISTINGS):
        owner_id, owner_name = item.pop("owner")
        docs.append({
            "listing_id": f"lst_{uuid.uuid4().hex[:12]}",
            "owner_id": owner_id, "owner_name": owner_name,
            "rating": round(4.6 + (i % 4) * 0.1, 1), "is_active": True,
            "created_at": (now - timedelta(days=i)).isoformat(),
            **item,
        })
    await db.listings.insert_many(docs)
