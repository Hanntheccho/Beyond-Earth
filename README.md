# BYOND UNiTY HTML

Interactive scenario briefing for the world after the Great Mistake of 2070. A static site: open `index.html` in a browser (a local server is safest for the JSON data).

## What it shows

- Interactive globe with hotspots and a sea-level view
- Faction profiles and points of interest
- Bloc, corp, and good treemaps and ledgers (shown as World, Market, and Resource values)
- Scenario outlook from 2070 to 2200

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Page entry |
| `src/js`, `src/css` | Interface scripts and styles |
| `data/` | Scenario, bloc, corp, good, relations, POI, and locale JSON; `scenario-data.md` and `relations.md` explain how to edit them |
| `assets/` | Icons, faction marks, and audio |
| `docs/legacy/` | Legacy worldbuilding text, not loaded by the site |
| `tools/validate.mjs` | Data checks (`npm run validate`) |
| `tools/make-elevation-webp.py` | Rebuilds `data/elev-1080.webp` from `data/elev-1080.png` (Python, Pillow, NumPy) |

The globe loads `data/elev-1080.webp`, a lossless copy of the PNG heightmap with deep ocean flattened. After editing the PNG, rerun the script. The PNG stays as the original and as a fallback.

No build step and no script dependencies: every module is plain JavaScript in `src/js`, loaded from `src/default.js`.

