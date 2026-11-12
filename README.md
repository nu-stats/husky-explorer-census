# Husky Explorer (web, census data)

A free, browser-only explorer for U.S. Census Bureau data: maps, place profiles, side-by-side comparisons, report and table downloads, for every state. This repository holds the built site only; the source is Husky Explorer, part of the Craft suite from nu-stats (built with `node src/build-site.ts --site census`).

Live at https://nu-stats.github.io/husky-explorer-census/

## What it holds

- Census Bureau data: the American Community Survey (5-year 2020–2024 and 2015–2019, 1-year 2024), the 2000, 2010 and 2020 censuses, the Vintage 2025 population estimates and LODES commuting, for states, counties, and towns and townships.
- **Cities and places are limited to the 343 cities of the community-context assignment** (U.S. places of 75,000 people or more as that assignment chose them). Every other level is complete.
- Federal sources whose terms are clear (CDC PLACES and the federal dot layers), and UNHCR refugee counts (CC BY 4.0).
- Not on this site: crime and campus crime data, the national surveys, and sources whose terms are still being confirmed.

Data comes from the agencies that publish it; every page carries its credit, and the Data sources page lists terms. This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.
