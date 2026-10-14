from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

DARK = colors.HexColor("#1E242B")
AMBER = colors.HexColor("#D97706")
SUBTLE = colors.HexColor("#F1EFE9")
SHIP_LABEL = {"pickup": "Ambil Mandiri di Gudang Vendor", "vendor_cargo": "Pengiriman Kargo/Armada Vendor"}
STATUS = {"awaiting_payment": "AWAITING_PAYMENT", "held": "ESCROW_HELD", "shipped": "SHIPPED",
          "disputed": "DISPUTE", "released": "COMPLETED"}


def rp(n):
    return "Rp " + f"{round(n or 0):,}".replace(",", ".")


def build_invoice(order: dict, seller: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm)
    ss = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=ss["Title"], alignment=0, textColor=DARK, fontSize=22)
    small = ParagraphStyle("s", parent=ss["Normal"], fontSize=8.5, leading=12, textColor=colors.HexColor("#475569"))
    body = ParagraphStyle("b", parent=ss["Normal"], fontSize=9, leading=13)
    bold = ParagraphStyle("bb", parent=body, fontName="Helvetica-Bold")

    created = datetime.fromisoformat(order["created_at"]).strftime("%d %b %Y %H:%M")
    ship = order.get("shipping", {})
    story = [
        Table([[Paragraph('MatShop<font color="#D97706">.id</font>', h),
                Paragraph(f"<b>INVOICE</b><br/>No: INV-{order['order_id']}<br/>Tanggal: {created}<br/>"
                          f"Status: <b>{STATUS.get(order['status'], order['status'])}</b>", body)]],
              colWidths=[95 * mm, 79 * mm], style=[("VALIGN", (0, 0), (-1, -1), "TOP")]),
        Spacer(1, 8),
        Table([[Paragraph("<b>DATA VENDOR / PENJUAL</b>", small), Paragraph("<b>DITAGIHKAN KEPADA</b>", small)],
               [Paragraph(f"<b>{order['seller_name']}</b><br/>{seller.get('email', '-')}<br/>"
                          f"Gudang: {order.get('warehouse_location') or '-'}", body),
                Paragraph(f"<b>{ship.get('recipient', order['buyer_name'])}</b><br/>{ship.get('phone', '')}<br/>"
                          f"{ship.get('address', '')}", body)]],
              colWidths=[87 * mm, 87 * mm],
              style=[("BACKGROUND", (0, 0), (-1, 0), SUBTLE), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                     ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 6)]),
        Spacer(1, 12),
    ]

    rows = [["Item", "Qty", "Harga Eceran", "Harga Satuan", "Diskon Grosir", "Subtotal"]]
    total_disc = 0
    for i in order["items"]:
        retail = i.get("retail_price", i["unit_price"])
        disc = (retail - i["unit_price"]) * i["qty"]
        total_disc += disc
        tier = " (Grosir)" if i.get("is_wholesale") else ""
        rows.append([Paragraph(i["title"] + tier, body), f"{i['qty']} {i['unit']}", rp(retail), rp(i["unit_price"]),
                     ("-" + rp(disc)) if disc > 0 else "-", rp(i["subtotal"])])
    t = Table(rows, colWidths=[58 * mm, 20 * mm, 24 * mm, 24 * mm, 24 * mm, 24 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ("TEXTCOLOR", (4, 1), (4, -1), colors.HexColor("#16A34A")),
    ]))
    story += [t, Spacer(1, 10)]

    items_total = order.get("items_total", sum(i["subtotal"] for i in order["items"]))
    ship_cost = order.get("shipping_cost", 0)
    fee = order.get("service_fee", 0)
    summary = [
        ["Metode Pengiriman", SHIP_LABEL.get(order.get("shipping_method"), "Digital / Tanpa Pengiriman")],
        ["Subtotal Item", rp(items_total)],
        ["Total Hemat Harga Grosir", ("-" + rp(total_disc)) if total_disc else "-"],
        ["Estimasi Ongkos Kirim", rp(ship_cost)],
        ["Biaya Layanan Escrow", rp(fee)],
        [Paragraph("<b>TOTAL TAGIHAN</b>", bold), Paragraph(f"<b>{rp(order['total'] + fee)}</b>", bold)],
    ]
    st = Table(summary, colWidths=[110 * mm, 64 * mm])
    st.setStyle(TableStyle([("ALIGN", (1, 0), (1, -1), "RIGHT"), ("FONTSIZE", (0, 0), (-1, -1), 9),
                            ("LINEABOVE", (0, -1), (-1, -1), 1, AMBER), ("TOPPADDING", (0, -1), (-1, -1), 6)]))
    story += [st, Spacer(1, 16), Paragraph(
        "Pembayaran dilindungi Escrow MatShop.id: dana ditahan sistem dan hanya dirilis ke vendor setelah "
        "pembeli mengonfirmasi penerimaan (COMPLETED). Dokumen ini sah tanpa tanda tangan.", small)]
    doc.build(story)
    return buf.getvalue()
