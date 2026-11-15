"""Inspect browser-generated print fixtures (requires pypdf and pypdfium2)."""
import os
import unicodedata
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium

folder = Path(os.environ['TEMP']) / 'ziwei-browser-check'
palaces = ['命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄', '遷移', '僕役', '官祿', '田宅', '福德', '父母']
for name in ['print.pdf', 'print-mobile.pdf', 'print-origin.pdf', 'print-yearly.pdf']:
    path = folder / name
    reader = PdfReader(path)
    sizes = [(round(float(p.mediabox.width), 2), round(float(p.mediabox.height), 2)) for p in reader.pages]
    print(name, 'pages=', len(reader.pages), 'size_pt=', sizes)
    assert len(reader.pages) == 1, f'{name} must fit on exactly one page'
    width, height = sizes[0]
    assert abs(width - 595.28) < 1 and abs(height - 841.89) < 1, 'A4 page size'
    # Chromium's CJK font maps some glyphs to their compatibility radicals.
    content = unicodedata.normalize('NFKC', reader.pages[0].extract_text()).replace('\u2e9f', '母')
    for palace in palaces:
        assert palace in content, f'{name}: missing {palace}'
    with pdfium.PdfDocument(str(path)) as pdf:
        pdf[0].render(scale=1.5).to_pil().save(folder / (path.stem + '-verified.png'))
print('All four PDFs contain exactly one A4 page and all twelve palaces.')
