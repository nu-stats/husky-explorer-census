# Husky Explorer (web, census and crime data)

A free, browser-only explorer for U.S. Census Bureau data and crime data: maps, place profiles, side-by-side comparisons, report and table downloads, for every state. This repository holds the built site only; the source is Husky Explorer, part of the Craft suite from nu-stats (built with `node src/build-site.ts --site census`).

Live at https://nu-stats.github.io/husky-explorer-census/

## What it holds

- Census Bureau data: the American Community Survey (5-year 2020–2024 and 2015–2019, 1-year 2024), the 2000, 2010 and 2020 censuses, 2010–2020 change, the Vintage 2025 population estimates and LODES commuting, for states, counties, towns and townships, tracts and ZIP code areas.
- **Cities and places are limited to the 343 cities of the community-context assignment** (U.S. places of 75,000 people or more as that assignment chose them).
- **No block groups.** The block-group level is left out to keep the site under GitHub Pages' 1 GB limit; the full Husky Explorer has it.
- Crime data: the FBI's public files (reported crime, police employees, county crime, incident-based reporting) and campus crime.
- Not on this site: any other source (CDC, EPA, USDA and other federal sets, the dot layers), the national surveys, sources whose terms are still being confirmed, and anything restricted.

Data comes from the agencies that publish it; every page carries its credit, and the Data sources page lists terms. This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.
