"""Build report.html, report.pdf and report.docx from report.md.

Usage:  python report/build_report.py
Needs:  pip install markdown python-docx pypdf ; Chrome or Edge installed.
"""
import pathlib
import re
import subprocess
import sys

import markdown
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from pypdf import PdfReader

HERE = pathlib.Path(__file__).resolve().parent
MD = HERE / "report.md"
HTML = HERE / "_build" / "report.html"
PDF = HERE / "report.pdf"
DOCX = HERE / "report.docx"

FONT = "Calibri"
BODY_PT = 10.5          # never below 10pt
MARGIN_IN = 0.55

CSS = f"""
@page {{ size: Letter; margin: {MARGIN_IN}in; }}
html {{ font-family: {FONT}, Carlito, Arial, sans-serif; font-size: {BODY_PT}pt; line-height: 1.24; color: #111; }}
body {{ margin: 0; }}
h1 {{ font-size: 15pt; margin: 0 0 1pt; }}
h1 + p {{ margin-top: 0; text-align: left; }}
h2 {{ font-size: 11.5pt; margin: 6pt 0 1.5pt; color: #1d3b53; }}
p {{ margin: 0 0 3pt; text-align: justify; hyphens: auto; }}
ul {{ margin: 0 0 3pt; padding-left: 14pt; }}
li {{ margin: 0 0 1pt; text-align: justify; }}
a {{ color: #1d3b53; text-decoration: none; }}
code {{ font-family: Consolas, monospace; font-size: 9.5pt; }}
"""


def build_html() -> str:
    body = markdown.markdown(MD.read_text(encoding="utf-8"), extensions=["sane_lists"])
    return f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Report</title><style>{CSS}</style></head><body>{body}</body></html>"


def find_browser() -> str:
    for p in [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ]:
        if pathlib.Path(p).exists():
            return p
    sys.exit("Chrome or Edge not found")


def build_pdf() -> int:
    HTML.parent.mkdir(exist_ok=True)
    HTML.write_text(build_html(), encoding="utf-8")
    subprocess.run(
        [find_browser(), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={PDF}", HTML.as_uri()],
        check=True, capture_output=True, timeout=120,
    )
    return len(PdfReader(str(PDF)).pages)


INLINE = re.compile(r"(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))")
LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def add_hyperlink(par, text, url):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    r_id = par.part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), r_id)
    run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "1D3B53")
    rpr.append(color)
    run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    run.append(t)
    link.append(run)
    par._p.append(link)


def add_runs(par, text):
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith("**"):
            r = par.add_run(part[2:-2])
            r.bold = True
        elif LINK.fullmatch(part):
            add_hyperlink(par, *LINK.fullmatch(part).groups())
        elif part.startswith("`"):
            r = par.add_run(part[1:-1])
            r.font.name = "Consolas"
            r.font.size = Pt(BODY_PT - 1)
        else:
            par.add_run(part)


def build_docx():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, side, Inches(MARGIN_IN))
    st = doc.styles["Normal"]
    st.font.name = FONT
    st.font.size = Pt(BODY_PT)
    st.paragraph_format.space_after = Pt(3)
    st.paragraph_format.line_spacing = Pt(BODY_PT * 1.24)  # same as the PDF

    lines = MD.read_text(encoding="utf-8").splitlines()
    para_buf: list[str] = []

    def flush():
        if para_buf:
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            # markdown hard line break (two trailing spaces) -> new line
            text = "\n".join(l.rstrip() for l in para_buf)
            add_runs(p, text)
            para_buf.clear()

    for line in lines:
        if line.startswith("# "):
            flush()
            p = doc.add_paragraph()
            r = p.add_run(line[2:])
            r.bold = True
            r.font.size = Pt(15)
            p.paragraph_format.space_after = Pt(1)
        elif line.startswith("## "):
            flush()
            p = doc.add_paragraph()
            r = p.add_run(line[3:])
            r.bold = True
            r.font.size = Pt(11.5)
            r.font.color.rgb = RGBColor(0x1D, 0x3B, 0x53)
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(1.5)
        elif line.startswith("- "):
            flush()
            p = doc.add_paragraph(style="List Bullet")
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.space_after = Pt(1)
            add_runs(p, line[2:])
        elif not line.strip():
            flush()
        else:
            para_buf.append(line)
    flush()
    for p in doc.paragraphs:
        for r in p.runs:
            if r.font.name is None:
                r.font.name = FONT
    doc.save(DOCX)


if __name__ == "__main__":
    pages = build_pdf()
    build_docx()
    print(f"report.pdf pages: {pages}")
    if pages != 1:
        sys.exit("PDF is not exactly one page")
