"""
Convierte una hoja de un .xlsx en un CSV compatible con el importador de
grupos del dashboard (columnas: nombre,url,categoria).

No requiere dependencias externas (usa zipfile/xml de la stdlib) porque un
.xlsx es un zip con XML por dentro.

Uso:
    python scripts/xlsx_to_csv.py <archivo.xlsx> <nombre_hoja> \
        --name-col <col> --url-col <col> [--category-col <col>] \
        -o salida.csv

<col> puede ser el nombre del encabezado (ej. "Nombre") o el índice 0-based.
Si una celda de la columna de nombre/url tiene un hipervínculo (como en las
listas donde el nombre del grupo ES el enlace), se usa ese enlace aunque la
columna de URL esté vacía o no exista.

Para listar las hojas y encabezados disponibles:
    python scripts/xlsx_to_csv.py <archivo.xlsx> --list
"""
import argparse
import csv
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
R_NS = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'


def col_to_idx(col: str) -> int:
    idx = 0
    for c in col:
        idx = idx * 26 + (ord(c) - ord('A') + 1)
    return idx - 1


def load_shared_strings(z: zipfile.ZipFile):
    if 'xl/sharedStrings.xml' not in z.namelist():
        return []
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    return [''.join(t.text or '' for t in si.findall('.//s:t', NS)) for si in root.findall('s:si', NS)]


def load_sheet_names(z: zipfile.ZipFile):
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    return [s.get('name') for s in wb.findall('.//s:sheets/s:sheet', NS)]


def sheet_file_for_index(z: zipfile.ZipFile, index: int) -> str:
    files = sorted(n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml', n))
    return files[index]


def read_sheet(path: str, sheet_name: str):
    """Returns (rows: list[list[str]], hyperlinks: dict[(row,col) -> url]), both 0-indexed."""
    z = zipfile.ZipFile(path)
    shared = load_shared_strings(z)
    names = load_sheet_names(z)
    idx = names.index(sheet_name) if sheet_name in names else None
    if idx is None:
        raise SystemExit(f"Hoja '{sheet_name}' no encontrada. Disponibles: {names}")
    sheet_file = sheet_file_for_index(z, idx)

    rels_path = sheet_file.replace('xl/worksheets/', 'xl/worksheets/_rels/') + '.rels'
    rels = {}
    if rels_path in z.namelist():
        rroot = ET.fromstring(z.read(rels_path))
        for rel in rroot:
            rels[rel.get('Id')] = rel.get('Target')

    root = ET.fromstring(z.read(sheet_file))
    hyperlinks = {}
    for h in root.findall('.//s:hyperlinks/s:hyperlink', NS):
        ref = h.get('ref')
        rid = h.get(R_NS)
        target = rels.get(rid) or h.get('location', '')
        m = re.match(r'([A-Z]+)(\d+)', ref)
        if m and target:
            hyperlinks[(int(m.group(2)) - 1, col_to_idx(m.group(1)))] = target

    rows = []
    for row_el in root.findall('.//s:sheetData/s:row', NS):
        rowvals = {}
        for c in row_el.findall('s:c', NS):
            ref = c.get('r')
            col = re.match(r'([A-Z]+)', ref).group(1)
            ci = col_to_idx(col)
            t = c.get('t')
            v = c.find('s:v', NS)
            val = v.text if v is not None else ''
            if t == 's' and val != '':
                val = shared[int(val)]
            elif t == 'inlineStr':
                isnode = c.find('s:is', NS)
                if isnode is not None:
                    val = ''.join(tt.text or '' for tt in isnode.findall('.//s:t', NS))
            rowvals[ci] = val
        maxc = max(rowvals.keys()) if rowvals else -1
        rows.append([rowvals.get(i, '') for i in range(maxc + 1)])

    return rows, hyperlinks


def resolve_col(spec: str, header: list) -> int:
    if spec.isdigit():
        return int(spec)
    norm_header = [h.strip().lower() for h in header]
    if spec.strip().lower() not in norm_header:
        raise SystemExit(f"Columna '{spec}' no encontrada en encabezado: {header}")
    return norm_header.index(spec.strip().lower())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('xlsx')
    ap.add_argument('sheet', nargs='?')
    ap.add_argument('--list', action='store_true', help='Lista hojas y su encabezado, y termina')
    ap.add_argument('--name-col', default='0')
    ap.add_argument('--url-col', default='1')
    ap.add_argument('--category-col', default=None)
    ap.add_argument('--has-header', action='store_true', default=True)
    ap.add_argument('--no-header', dest='has_header', action='store_false')
    ap.add_argument('-o', '--output')
    args = ap.parse_args()

    z = zipfile.ZipFile(args.xlsx)
    names = load_sheet_names(z)

    if args.list or not args.sheet:
        print(f"Hojas en {args.xlsx}:")
        for n in names:
            rows, _ = read_sheet(args.xlsx, n)
            header = rows[0] if rows else []
            print(f"  - {n}  ({len(rows)} filas)  encabezado: {header}")
        return

    rows, hyperlinks = read_sheet(args.xlsx, args.sheet)
    if not rows:
        raise SystemExit('Hoja vacía.')

    header = rows[0]
    data_start = 1 if args.has_header else 0
    name_idx = resolve_col(args.name_col, header) if args.has_header and not args.name_col.isdigit() else int(args.name_col)
    url_idx = resolve_col(args.url_col, header) if args.has_header and not args.url_col.isdigit() else int(args.url_col)
    cat_idx = None
    if args.category_col is not None:
        cat_idx = resolve_col(args.category_col, header) if args.has_header and not args.category_col.isdigit() else int(args.category_col)

    out = args.output or (args.xlsx.rsplit('.', 1)[0] + f'.{args.sheet}.csv')
    written = 0
    with open(out, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['nombre', 'url', 'categoria'])
        for r in range(data_start, len(rows)):
            row = rows[r]
            name = (row[name_idx] if name_idx < len(row) else '').strip()
            if url_idx == name_idx:
                # URL only ever comes from a hyperlink on the name cell itself;
                # falling back to the cell's own text would just duplicate the name.
                url = (hyperlinks.get((r, url_idx)) or '').strip()
            else:
                url = (hyperlinks.get((r, url_idx)) or hyperlinks.get((r, name_idx)) or
                       (row[url_idx] if url_idx < len(row) else '')).strip()
            category = ((row[cat_idx] if cat_idx is not None and cat_idx < len(row) else '') or '').strip()
            if not name and not url:
                continue
            writer.writerow([name, url, category])
            written += 1

    print(f"Escrito {out} ({written} filas)")


if __name__ == '__main__':
    main()
