"""Celesta Glow A6 shipping label PDF generator.

Renders an A6 (148 × 105 mm) printable shipping label that:
  • Switches the India Post contract number based on payment type (COD vs Prepaid).
  • Shows a clear payment pill in the header (red "COD Rs.X" vs green "PREPAID").
  • Lays out a tidy FROM block + Contract/CID line + DELIVER TO block.
  • Has a dark-green bottom strip with the order id, AWB number, and total.

Two public functions:
  • build_single_label_pdf(order)            → bytes  (one A6 page)
  • build_bulk_labels_pdf(orders)            → bytes  (multi-page A4, 2×2 grid)

Both functions are pure — they don't talk to the DB. Wrap them in route
handlers that fetch the order, exclude `deleted:{$ne: true}`, and stream the
returned bytes back to the caller.
"""
from __future__ import annotations
import io
from typing import Iterable, List

from reportlab.lib.pagesizes import A4, A6
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas as rl_canvas


# ============================== brand constants ==============================
COMPANY = {
    "name":  "Celesta Glow",
    "addr1": "Parakkal House, Door No 1234",
    "addr2": "Thrissur, Kerala 680001, India",
    "phone": "+91 98470 00000",
}

# India Post booking contracts. CID is shared across both contracts.
CONTRACT_COD     = "41377633"
CONTRACT_PREPAID = "41196151"
CUSTOMER_ID      = "1261445435"

# Brand palette
DARK_GREEN   = HexColor("#2C3531")
GOLD         = HexColor("#D4A373")
RED_COD      = HexColor("#B91C1C")
GREEN_PREPAID = HexColor("#15803D")
GREY_LABEL   = HexColor("#6B7280")
GREY_DARK    = HexColor("#1F2937")
GREEN_HEAD   = HexColor("#15803D")


def _is_cod(order: dict) -> bool:
    pm = (order.get("payment_method") or "").strip().lower()
    return pm in ("cod", "cash on delivery", "cash_on_delivery", "cash-on-delivery")


def _payment_pill_text(order: dict) -> tuple[str, HexColor]:
    """Right-hand pill in the header. COD shows the amount, prepaid stays clean."""
    if _is_cod(order):
        amt = float(order.get("amount") or order.get("total_amount") or 0)
        return f"COD  Rs.{amt:,.0f}", RED_COD
    return "PREPAID", GREEN_PREPAID


def _payment_tag(order: dict) -> str:
    """Bottom-strip bracketed tag — uses the actual payment method when known."""
    if _is_cod(order):
        return "[COD]"
    pm = (order.get("payment_method") or "").strip().upper()
    if pm in ("UPI", "CARD", "NETBANKING"):
        return f"[{pm}]"
    return "[PREPAID]"


def _wrap_words(text: str, max_chars: int = 25) -> List[str]:
    """Word-wrap the customer address into lines of ~max_chars (no hyphenation)."""
    if not text:
        return []
    out: List[str] = []
    line = ""
    for word in str(text).split():
        if not line:
            line = word
        elif len(line) + 1 + len(word) <= max_chars:
            line += " " + word
        else:
            out.append(line)
            line = word
    if line:
        out.append(line)
    return out


def _fit_text(c, text: str, max_width: float, font: str, start_size: int, min_size: int) -> int:
    """Shrink-to-fit. Returns the largest font size that fits max_width."""
    size = start_size
    while size > min_size and c.stringWidth(text, font, size) > max_width:
        size -= 1
    return size


def _draw_label(c, x: float, y: float, w: float, h: float, order: dict) -> None:
    """Render ONE label inside the rectangle (x, y, w, h) on the canvas `c`.

    `y` is the BOTTOM-LEFT corner of the label area (reportlab convention).
    All coordinates inside this function are absolute (ie. x+offset).
    """
    # ---------- HEADER STRIP (dark green, ~14 mm tall) ----------
    header_h = 14 * mm
    c.setFillColor(DARK_GREEN)
    c.rect(x, y + h - header_h, w, header_h, fill=1, stroke=0)

    # Brand: CELESTA white + GLOW gold (immediately to its right)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 16)
    brand_x = x + 5 * mm
    brand_y_text = y + h - header_h + 7.5 * mm
    c.drawString(brand_x, brand_y_text, "CELESTA")
    celesta_w = c.stringWidth("CELESTA", "Helvetica-Bold", 16)
    c.setFillColor(GOLD)
    c.drawString(brand_x + celesta_w + 4, brand_y_text, "GLOW")
    # Tagline
    c.setFillColor(white)
    c.setFont("Helvetica-Oblique", 6.5)
    c.drawString(brand_x, brand_y_text - 4 * mm, "Premium Beauty  •  Wellness  •  Skincare")

    # Payment pill — fits inside the header strip
    pill_text, pill_color = _payment_pill_text(order)
    pill_size = _fit_text(c, pill_text, 35 * mm, "Helvetica-Bold", 13, 9)
    pad_x = 3 * mm
    pill_text_w = c.stringWidth(pill_text, "Helvetica-Bold", pill_size)
    pill_w = pill_text_w + pad_x * 2
    pill_h = 8.5 * mm
    pill_x = x + w - pill_w - 5 * mm
    pill_y = y + h - header_h + (header_h - pill_h) / 2
    c.setFillColor(white)
    c.roundRect(pill_x, pill_y, pill_w, pill_h, 3.5 * mm, fill=1, stroke=0)
    c.setFillColor(pill_color)
    c.setFont("Helvetica-Bold", pill_size)
    c.drawString(pill_x + pad_x, pill_y + (pill_h - pill_size) / 2 + 1, pill_text)

    # ---------- FROM BLOCK ----------
    from_y = y + h - header_h - 5 * mm
    c.setFillColor(GREY_LABEL)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(x + 5 * mm, from_y, "FROM:")
    c.setFillColor(GREY_DARK)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(x + 5 * mm, from_y - 3.6 * mm, COMPANY["name"])
    c.setFont("Helvetica", 7.5)
    c.drawString(x + 5 * mm, from_y - 6.6 * mm, COMPANY["addr1"])
    c.drawString(x + 5 * mm, from_y - 9.4 * mm, COMPANY["addr2"])
    c.drawString(x + 5 * mm, from_y - 12.2 * mm, f"Phone: {COMPANY['phone']}")

    # ---------- Contract + CID line (directly under FROM phone) ----------
    contract = CONTRACT_COD if _is_cod(order) else CONTRACT_PREPAID
    contract_line = f"Contract No: {contract}  |  Customer Identification: {CUSTOMER_ID}"
    contract_size = _fit_text(c, contract_line, w - 10 * mm, "Helvetica-Bold", 9, 7)
    c.setFillColor(GREY_DARK)
    c.setFont("Helvetica-Bold", contract_size)
    c.drawString(x + 5 * mm, from_y - 16 * mm, contract_line)

    # ---------- DELIVER TO BLOCK ----------
    deliver_y = from_y - 22 * mm
    c.setFillColor(GREEN_HEAD)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 5 * mm, deliver_y, "DELIVER TO:")

    # Customer name — bold 12pt (ToA larger than FROM 8.5pt as requested)
    cust_name = (order.get("name") or order.get("customer_name") or "").strip() or "—"
    c.setFillColor(GREY_DARK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x + 5 * mm, deliver_y - 5 * mm, cust_name)

    # Address lines — word-wrapped, max ~5 lines to keep label tidy
    addr_parts = [
        order.get("address_line1") or order.get("house_number") or "",
        order.get("address_line2") or order.get("area") or "",
        order.get("address_line3") or "",
    ]
    full_addr = ", ".join(p for p in addr_parts if p and str(p).strip())
    addr_lines = _wrap_words(full_addr, max_chars=42)[:5]
    c.setFont("Helvetica", 9.5)
    addr_y = deliver_y - 9.5 * mm
    for i, line in enumerate(addr_lines):
        c.drawString(x + 5 * mm, addr_y - i * 4 * mm, line)

    # City / State / PIN — bold 9.5pt
    csp_y = addr_y - len(addr_lines) * 4 * mm - 1.5 * mm
    city = (order.get("city") or "").strip()
    state = (order.get("state") or "").strip()
    pin = str(order.get("pincode") or order.get("zip") or "").strip()
    csp = ", ".join(p for p in [city, state, pin] if p)
    if csp:
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(x + 5 * mm, csp_y, csp)
        csp_y -= 4 * mm

    # Optional landmark — italic grey
    landmark = (order.get("landmark") or "").strip()
    if landmark:
        c.setFillColor(GREY_LABEL)
        c.setFont("Helvetica-Oblique", 8.5)
        c.drawString(x + 5 * mm, csp_y, f"Landmark: {landmark}")
        csp_y -= 3.5 * mm

    # Phone — bold 10pt gold
    phone = (order.get("phone") or "").strip()
    if phone:
        c.setFillColor(GOLD)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x + 5 * mm, csp_y, f"Phone: +91 {phone}")

    # ---------- BOTTOM STRIP ----------
    footer_h = 10 * mm
    c.setFillColor(DARK_GREEN)
    c.rect(x, y, w, footer_h, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8.5)
    order_id = str(order.get("order_id") or order.get("id") or "—")
    awb = str(order.get("tracking_number") or order.get("awb_number") or "—")
    c.drawString(x + 5 * mm, y + footer_h - 4 * mm, f"ORDER: {order_id}")
    c.setFont("Helvetica", 7.5)
    c.drawString(x + 5 * mm, y + footer_h - 7.5 * mm, f"AWB: {awb}")

    # Right side — tag on top, total below
    tag = _payment_tag(order)
    amt = float(order.get("amount") or order.get("total_amount") or 0)
    c.setFont("Helvetica", 7)
    tag_w = c.stringWidth(tag, "Helvetica", 7)
    c.drawString(x + w - 5 * mm - tag_w, y + footer_h - 4 * mm, tag)
    c.setFont("Helvetica-Bold", 10)
    total_text = f"Rs.{amt:,.0f}"
    tot_w = c.stringWidth(total_text, "Helvetica-Bold", 10)
    c.drawString(x + w - 5 * mm - tot_w, y + footer_h - 8 * mm, total_text)


# =============================== public API ===============================

def build_single_label_pdf(order: dict) -> bytes:
    """Render ONE order to a single A6 PDF page."""
    buf = io.BytesIO()
    # A6 landscape so 148mm is the wider edge (standard shipping-label orientation)
    page_w, page_h = A6[1], A6[0]   # 148 mm × 105 mm
    c = rl_canvas.Canvas(buf, pagesize=(page_w, page_h))
    _draw_label(c, 0, 0, page_w, page_h, order)
    c.showPage()
    c.save()
    return buf.getvalue()


def build_bulk_labels_pdf(orders: Iterable[dict]) -> bytes:
    """Render N orders onto A4 pages, 4 labels per page (2×2 grid)."""
    buf = io.BytesIO()
    page_w, page_h = A4   # 210 mm × 297 mm
    c = rl_canvas.Canvas(buf, pagesize=A4)
    margin = 6 * mm
    gutter = 4 * mm
    label_w = (page_w - 2 * margin - gutter) / 2
    label_h = (page_h - 2 * margin - gutter) / 2

    orders = list(orders)
    if not orders:
        # Empty PDF — still emit a single blank page so the response has content
        c.setFont("Helvetica", 12)
        c.drawCentredString(page_w / 2, page_h / 2, "No orders to print.")
        c.showPage()
        c.save()
        return buf.getvalue()

    for i, order in enumerate(orders):
        pos = i % 4
        if pos == 0 and i != 0:
            c.showPage()
        col = pos % 2
        row = pos // 2
        # Row 0 = top, row 1 = bottom (reportlab origin is bottom-left)
        x = margin + col * (label_w + gutter)
        y = page_h - margin - (row + 1) * label_h - row * gutter
        _draw_label(c, x, y, label_w, label_h, order)

    c.showPage()
    c.save()
    return buf.getvalue()
