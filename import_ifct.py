#!/usr/bin/env python3
"""
IFCT 2017 -> normalized seed data for the nutrition tracker.

Input : node_modules/@ifct2017/compositions/index.csv  (542 rows, 421 cols)
Output: out/seed_nutrient.sql        30 rows, the nutrient dictionary
        out/food.csv                 542 rows,   \
        out/food_alias.csv           ~6000 rows,  }  for \copy
        out/food_nutrient.csv        ~13000 rows /
        out/report.txt               coverage + sanity checks

Usage:  pip install nothing.  python3 import_ifct.py <path-to-index.csv>

Unit contract: IFCT stores grams per 100 g edible portion for every nutrient,
except Energy which is kJ. Verified against B020 (Rajmah, red):
  ca=0.126 -> 126 mg | fe=0.00613 -> 6.13 mg | k=1.324 -> 1324 mg
  folsum=0.000316 -> 316 ug | enerc=1252 kJ -> 299 kcal
"""

import csv, os, re, sys, json
from collections import defaultdict

G_TO_MG = 1_000.0
G_TO_UG = 1_000_000.0
KJ_TO_KCAL = 1 / 4.184

# ---------------------------------------------------------------- dictionary
# (id, key, display, unit, category)
NUTRIENTS = [
    (1,  'energy',       'Energy',                  'kcal', 'macro'),
    (2,  'protein',      'Protein',                 'g',    'macro'),
    (3,  'fat',          'Total Fat',               'g',    'macro'),
    (4,  'carb',         'Carbohydrate',            'g',    'macro'),
    (5,  'fiber',        'Dietary Fibre',           'g',    'macro'),
    (6,  'fiberSoluble', 'Soluble Fibre',           'g',    'macro'),
    (7,  'sugarFree',    'Free Sugars',             'g',    'macro'),
    (8,  'starch',       'Starch',                  'g',    'macro'),
    (9,  'fatSat',       'Saturated Fat',           'g',    'lipid'),
    (10, 'fatMono',      'Monounsaturated Fat',     'g',    'lipid'),
    (11, 'fatPoly',      'Polyunsaturated Fat',     'g',    'lipid'),
    (12, 'fatTrans',     'Trans Fat',               'g',    'lipid'),
    (13, 'omega3',       'Omega-3',                 'mg',   'lipid'),
    (14, 'omega6',       'Omega-6',                 'mg',   'lipid'),
    (15, 'cholesterol',  'Cholesterol',             'mg',   'lipid'),
    (16, 'sodium',       'Sodium',                  'mg',   'mineral'),
    (17, 'potassium',    'Potassium',               'mg',   'mineral'),
    (18, 'calcium',      'Calcium',                 'mg',   'mineral'),
    (19, 'iron',         'Iron',                    'mg',   'mineral'),
    (20, 'magnesium',    'Magnesium',               'mg',   'mineral'),
    (21, 'zinc',         'Zinc',                    'mg',   'mineral'),
    (22, 'phosphorus',   'Phosphorus',              'mg',   'mineral'),
    (23, 'selenium',     'Selenium',                'ug',   'mineral'),
    (24, 'vitA',         'Vitamin A (RAE)',         'ug',   'vitamin'),
    (25, 'vitC',         'Vitamin C',               'mg',   'vitamin'),
    (26, 'vitD',         'Vitamin D',               'ug',   'vitamin'),
    (27, 'vitE',         'Vitamin E',               'mg',   'vitamin'),
    (28, 'vitK',         'Vitamin K',               'ug',   'vitamin'),
    (29, 'folate',       'Folate (B9)',             'ug',   'vitamin'),
    (30, 'vitB12',       'Vitamin B12',             'ug',   'vitamin'),
]
NID = {k: i for i, k, *_ in NUTRIENTS}

# key -> (list of IFCT short codes to sum, multiplier)
SIMPLE_MAP = {
    'energy':       (['enerc'],    KJ_TO_KCAL),
    'protein':      (['protcnt'],  1),
    'fat':          (['fatce'],    1),
    'carb':         (['choavldf'], 1),
    'fiber':        (['fibtg'],    1),
    'fiberSoluble': (['fibsol'],   1),
    'sugarFree':    (['fsugar'],   1),
    'starch':       (['starch'],   1),
    'fatSat':       (['fasat'],    1),
    'fatMono':      (['fams'],     1),
    'fatPoly':      (['fapu'],     1),
    'fatTrans':     (['fatrn'],    1),
    'omega3':       (['f18d3n3', 'f20d5n3', 'f22d6n3'], G_TO_MG),
    'omega6':       (['facn6'],    G_TO_MG),
    'cholesterol':  (['cholc'],    G_TO_MG),
    'sodium':       (['na'],       G_TO_MG),
    'potassium':    (['k'],        G_TO_MG),
    'calcium':      (['ca'],       G_TO_MG),
    'iron':         (['fe'],       G_TO_MG),
    'magnesium':    (['mg'],       G_TO_MG),
    'zinc':         (['zn'],       G_TO_MG),
    'phosphorus':   (['p'],        G_TO_MG),
    'selenium':     (['se'],       G_TO_UG),
    'vitC':         (['vitc'],     G_TO_MG),
    'vitD':         (['ergcal', 'chocal'], G_TO_UG),
    'vitE':         (['tocpha'],   G_TO_MG),
    'vitK':         (['vitk1', 'vitk2'],   G_TO_UG),
    'folate':       (['folsum'],   G_TO_UG),
    # vitA handled specially (RAE); vitB12 absent from IFCT entirely
}

# IFCT language prefixes in the "Local Name" column
LANG = {
    'A': 'Assamese', 'B': 'Bengali', 'E': 'English', 'G': 'Gujarati',
    'H': 'Hindi', 'Kan': 'Kannada', 'Kash': 'Kashmiri', 'Kh': 'Khasi',
    'Mal': 'Malayalam', 'M': 'Manipuri', 'Mar': 'Marathi', 'N': 'Nepali',
    'O': 'Odia', 'P': 'Punjabi', 'S': 'Sanskrit', 'Tam': 'Tamil',
    'Tel': 'Telugu', 'U': 'Urdu',
}
LANG_RE = re.compile(r'^(' + '|'.join(sorted(LANG, key=len, reverse=True)) + r')\.?\s*(.*)$')


def num(v):
    """IFCT blanks and non-numerics -> None. 0 is a real measured zero."""
    if v is None:
        return None
    v = v.strip()
    if v == '' or v.upper() in ('NA', 'ND', '-'):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def parse_aliases(local_name, canonical):
    """
    'A. Rajmah; B. Barbati beej; E. Rajma, Razma; H. Rajmah; ...'
      -> {'rajmah', 'barbati beej', 'rajma', 'razma', ...}
    IFCT ships up to 18 language names per food. This is the single most
    valuable thing in the dataset for search and it is free.
    """
    out = set()
    if not local_name:
        return out
    for chunk in local_name.split(';'):
        chunk = chunk.strip().rstrip('.')
        if not chunk:
            continue
        m = LANG_RE.match(chunk)
        body = m.group(2) if m else chunk
        # a language slot may list synonyms comma-separated
        for name in body.split(','):
            name = name.strip().strip('.').lower()
            name = re.sub(r'\s*\([^)]*\)', '', name).strip()   # drop "(lal)"
            if 2 < len(name) <= 60 and not name.isdigit():
                out.add(name)
    out.discard(canonical.lower())
    return out


def main(src):
    outdir = os.path.join(os.path.dirname(os.path.abspath(src)) if False else '.', 'out')
    os.makedirs(outdir, exist_ok=True)

    with open(src, newline='', encoding='utf-8') as fh:
        rows = list(csv.DictReader(fh))

    # build shortcode -> actual header lookup ("Iron (Fe); fe" -> "fe")
    code2col = {}
    for col in rows[0]:
        if ';' in col:
            code = col.rsplit(';', 1)[1].strip()
            code2col.setdefault(code, col)

    missing = {c for codes, _ in SIMPLE_MAP.values() for c in codes if c not in code2col}
    missing |= {c for c in ('cartbeq', 'retol') if c not in code2col}
    if missing:
        sys.exit(f'FATAL: expected IFCT columns absent: {sorted(missing)}')

    foods, aliases, values, warnings = [], [], [], []
    coverage = defaultdict(int)
    b12_flagged = 0

    for i, r in enumerate(rows, start=1):
        code = r['Food Code; code'].strip()
        name = r['Food Name; name'].strip()
        group = r['Food Group; grup'].strip()
        scie = r['Scientific Name; scie'].strip()
        tags = r['Tags; tags'].strip()
        regions = num(r.get('No. of Regions; regn'))

        foods.append({
            'id': i, 'source': 'ifct2017', 'source_ref': code,
            'name': name, 'source_name': name,
            'scientific_name': scie or None, 'food_group': group,
            'state': 'raw', 'b12_unknown': 't', 'is_curated': 'f',
            'tags': tags, 'n_regions': int(regions) if regions else None,
        })
        b12_flagged += 1

        for a in parse_aliases(r.get('Local Name; lang', ''), name):
            aliases.append({'food_id': i, 'alias': a})

        def emit(key, val):
            if val is None:
                return
            values.append({'food_id': i, 'nutrient_id': NID[key],
                           'amount': round(val, 6)})
            coverage[key] += 1

        for key, (codes, mult) in SIMPLE_MAP.items():
            if key == 'energy':
                continue                       # handled below
            parts = [num(r[code2col[c]]) for c in codes]
            present = [p for p in parts if p is not None]
            if not present:
                continue
            emit(key, sum(present) * mult)

        # ---- energy: source value if present, else Atwater reconstruction ----
        # IFCT leaves enerc = 0 for all 14 "Edible Oils and Fats" rows despite
        # fat = 100 g. Logging ghee or mustard oil at 0 kcal would silently
        # wreck every daily total, so derive it. Atwater agrees with IFCT to a
        # median 2.6% across the 528 rows that do carry an energy value.
        src_kcal = num(r[code2col['enerc']])
        src_kcal = src_kcal * KJ_TO_KCAL if src_kcal else None
        atwater = (4 * (num(r[code2col['protcnt']]) or 0)
                   + 9 * (num(r[code2col['fatce']]) or 0)
                   + 4 * (num(r[code2col['cho']]) or 0)
                   + 2 * (num(r[code2col['fibtg']]) or 0))

        if src_kcal:
            emit('energy', src_kcal)
            foods[-1]['energy_source'] = 'measured'
            if atwater > 0 and abs(atwater - src_kcal) / src_kcal > 0.25:
                warnings.append({
                    'food_id': i, 'source_ref': code, 'name': name,
                    'issue': 'energy_atwater_mismatch',
                    'ifct_kcal': round(src_kcal, 1),
                    'atwater_kcal': round(atwater, 1),
                    'pct_diff': round(100 * (src_kcal - atwater) / src_kcal, 1),
                })
        else:
            emit('energy', atwater)
            foods[-1]['energy_source'] = 'derived_atwater'
            warnings.append({
                'food_id': i, 'source_ref': code, 'name': name,
                'issue': 'energy_missing_in_source',
                'ifct_kcal': 0, 'atwater_kcal': round(atwater, 1), 'pct_diff': '',
            })

        # Vitamin A as RAE: retinol(ug) + beta-carotene-equivalents(ug)/12
        ret = num(r[code2col['retol']])
        bce = num(r[code2col['cartbeq']])
        if ret is not None or bce is not None:
            emit('vitA', (ret or 0) * G_TO_UG + (bce or 0) * G_TO_UG / 12)

        # vitB12: deliberately not emitted. IFCT 2017 has no cobalamin column.

    # ------------------------------------------------------------- write out
    def dump(fname, rowsx, cols):
        with open(os.path.join(outdir, fname), 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            for x in rowsx:
                w.writerow(x)

    dump('food.csv', foods,
         ['id', 'source', 'source_ref', 'name', 'source_name', 'scientific_name',
          'food_group', 'state', 'b12_unknown', 'is_curated', 'tags', 'n_regions',
          'energy_source'])
    dump('food_alias.csv', aliases, ['food_id', 'alias'])
    dump('food_nutrient.csv', values, ['food_id', 'nutrient_id', 'amount'])
    dump('warnings.csv', warnings,
         ['food_id', 'source_ref', 'name', 'issue', 'ifct_kcal', 'atwater_kcal', 'pct_diff'])

    with open(os.path.join(outdir, 'seed_nutrient.sql'), 'w', encoding='utf-8') as fh:
        fh.write('-- nutrient dictionary, canonical units\n')
        fh.write('insert into nutrient (id, key, display_name, unit, category, sort_order) values\n')
        fh.write(',\n'.join(
            f"  ({i}, '{k}', '{d}', '{u}', '{c}', {i})"
            for i, k, d, u, c in NUTRIENTS) + '\non conflict (id) do nothing;\n')

    # ---------------------------------------------------------------- report
    lines = []
    lines.append(f'foods            : {len(foods)}')
    lines.append(f'aliases          : {len(aliases)}  ({len(aliases)/len(foods):.1f} per food)')
    lines.append(f'nutrient values  : {len(values)}')
    lines.append(f'b12 flagged unknown: {b12_flagged}\n')
    lines.append('coverage (foods with a value, of %d):' % len(foods))
    for _, key, disp, unit, _cat in NUTRIENTS:
        n = coverage.get(key, 0)
        bar = '#' * int(30 * n / len(foods))
        lines.append(f'  {key:<14} {n:>4} {100*n/len(foods):>5.1f}%  {bar}')

    # sanity: known values for rajma red
    chk = {v['nutrient_id']: v['amount'] for v in values
           if v['food_id'] == next(f['id'] for f in foods if f['source_ref'] == 'B020')}
    lines.append('\nsanity check B020 Rajmah, red (per 100 g):')
    for key in ('energy', 'protein', 'fat', 'carb', 'fiber', 'calcium',
                'iron', 'potassium', 'folate', 'omega3'):
        u = next(n[3] for n in NUTRIENTS if n[1] == key)
        v = chk.get(NID[key])
        lines.append(f'  {key:<12} {v!s:>12} {u}')

    report = '\n'.join(lines)
    with open(os.path.join(outdir, 'report.txt'), 'w', encoding='utf-8') as fh:
        fh.write(report + '\n')
    print(report)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1
         else 'node_modules/@ifct2017/compositions/index.csv')
