# Baggo Catalog

Templates, a schema and examples for making a catalog for
[Baggo](https://baggo.dev), the free shopping list app.

A catalog is a ready-made pantry: categories and the items on their shelves,
each with an optional unit, tip and picture. Anyone can write one, and anyone
can add one to Baggo. This repository holds what you need to make yours.

> **Baggo cannot export your own items as a catalog.** A catalog is a JSON
> file you write (by hand or with an editor), check, and then bring into Baggo.

## What is here

| Path | What it is |
| --- | --- |
| [`templates/catalog.template.json`](templates/catalog.template.json) | A small, valid standalone catalog to copy and change. Start here. |
| [`schema/catalog.schema.json`](schema/catalog.schema.json) | The JSON Schema for the format. Editors use it for completion and errors. |
| [`examples/`](examples) | Larger finished catalogs: [`illustrated-basket.json`](examples/illustrated-basket.json) (24 items) and three `daily-basket.*.json` files (85–98 items, each drawn with a different open icon set). |
| [`scripts/validate.mjs`](scripts/validate.mjs) | Checks a catalog against the schema, plus what a schema cannot check. |

## Quick start

1. Copy [`templates/catalog.template.json`](templates/catalog.template.json).
2. Replace the `id`, `name`, `description`, categories and items with yours.
3. Check it:

   ```bash
   npm install
   npm run validate -- path/to/your-catalog.json
   ```

4. In Baggo, open **Menu → Catalogs → Add a new catalog** and choose
   **Import a file** to see how it reads.
5. To share it with the community, follow the
   [community catalog guidelines](https://baggo.dev/community/guidelines).

`npm run validate` with no file checks everything in `templates/` and
`examples/`. The validator needs Node 20 or newer.

Add `--check-urls` to also fetch every picture and warn about any that does not
answer (it needs network access and can take a minute):

```bash
npm run validate -- --check-urls path/to/your-catalog.json
```

It also warns when pictures from an icon set that asks for credit (OpenMoji,
game-icons.net) are not credited in `description` or `homepage`, and when a
`default_locale` text is missing from item names.

The templates carry a `"$schema": "../schema/catalog.schema.json"` line for
editor help. It is relative to this repository, so **change or delete it when
you move your file elsewhere**. Baggo ignores it.

## The format

### Required

A catalog needs six things:

| Field | Value |
| --- | --- |
| `schema_version` | `2` |
| `id` | The catalog's permanent identity (see below). |
| `name` | Text, plain or per language. |
| `version` | A whole number, starting at `1`. |
| `categories` | At least one. Each needs `slug` and `name`. |
| `items` | At least one. Each needs `slug`, `category` and `name`. |

### Optional

| Field | Notes |
| --- | --- |
| `description` | One or two sentences, shown before someone adds the catalog. |
| `homepage` | An `https://` address where people can report a problem. |
| `author`, `license` | `license` is an SPDX identifier or a URL. It describes your catalog data, not the pictures. |
| `default_locale` | The BCP 47 tag a text falls back to, for example `en`. |
| `expires` | The longest, in days (`1`–`365`), Baggo goes without checking a catalog added by link. Without it, 7. A catalog added from a file is never re-checked. |
| `icon` | A picture for the catalog itself. |
| `shortcuts` | Icons for Baggo's own Missing, Favorites and Recent shelves. |
| `pins` | Pictures a shopping list can wear (at most 60). |
| category `icon` | One of Baggo's icon names, or a picture file. |
| item `unit`, `note`, `image` | See below. |

The schema is the full definition, and its descriptions explain each field.

### Catalog ID

`id` is the catalog's permanent identity. Choose it once and **never change
it**. Baggo recognises an installed catalog by its `id`, not by its address or
filename, so the same catalog is still the same catalog if you move it. Change
the `id` and you have published a second, different catalog.

Use lowercase letters, digits, dots, hyphens and underscores. A reverse domain
name is recommended, for example `io.github.yourname.corner-shop`. It has to be
unique, so use a namespace you control.

### Slugs

Categories, items and pins each have a `slug`: lowercase letters, digits and
single hyphens (`dairy-eggs`).

- A slug is **permanent**. An item's identity is the pair (catalog `id`, slug).
- Slugs are unique within their list.
- Never reuse an item's slug for a different product. To retire a wrong item,
  add a new one with a new slug.
- Every item's `category` must be the `slug` of a category in the same file. An
  item whose category does not exist is skipped when the catalog is added.

### Version

`version` is a whole number. **Increase it every time you publish a change**,
even a small one. Baggo compares this number, not a date or a tag, to tell
whether a catalog has something new.

### Units

An item's `unit` is optional and is one of:

`pcs`, `pack`, `kg`, `g`, `l`, `ml`, `bottle`, `can`, `bag`, `box`

An unknown or missing unit means the item has no unit.

### Localization and language tags

Any text (`name`, `description`, a category or item `name`, a `note`) is either:

- a plain string, shown as written in every language; or
- a map from language tag to text:

  ```json
  "name": { "en": "Milk", "fr": "Lait", "ar": "حليب" }
  ```

**Language tags follow [BCP 47](https://www.rfc-editor.org/info/bcp47)**, the
IETF standard that browsers, phones and operating systems use. Please name
your languages with it, and only it. Baggo reads these tags to pick the right
text, and to list the languages your catalog offers by their proper names
("German", "Arabic (Morocco)"), in the reader's own language. A made-up code
or a language's English name cannot be matched or named.

A tag is a language, then optionally a script and a region, written in this
case: **language lower case, script Title case, region UPPER case**.

| Write | Means |
| --- | --- |
| `en`, `fr`, `ar` | A language. |
| `pt-BR`, `ar-MA`, `en-US` | A language with a region. |
| `zh-Hant`, `zh-Hant-TW` | A language with a script, and a region. |
| `es-419` | A language with a numeric region (Latin America). |

| Do not write | Because |
| --- | --- |
| `EN`, `en-us`, `zh-hant` | Wrong case. |
| `en_US` | An underscore is not BCP 47. Use a hyphen. |
| `english`, `Deutsch` | A name, not a tag. |

The validator rejects tags that are not written this way. Baggo itself is more
forgiving about case, but the canonical form is what we ask for.

How Baggo uses them:

- It matches the reader's language for that catalog by trimming the tag from the
  end: `ar-MA`, then `ar`. Failing that, it tries another region of the same
  language, so someone reading `en` gets your `en-US`.
- If nothing matches it uses `default_locale`, which is also a BCP 47 tag, and
  then the first entry in the map.
- No language is mandatory. You can translate some names and not others, and a
  catalog is never rejected for missing a language.
- People can pick any language your catalog publishes from the catalog's page,
  even one Baggo itself is not translated into. The languages you list are what
  they choose from, so only list languages you have actually written.

Use `default_locale` whenever you use maps.

Baggo trims overlong text instead of rejecting the file: item names at 84
characters, category names at 52, notes at 356. Keep a note to one short
sentence. The validator warns about anything longer.

### Images

Pictures are optional. An item without an `image` shows its category's icon.

- Item pictures: JPEG, PNG, WebP or SVG. Icon files (category, catalog,
  shortcut and pin icons): SVG, PNG or WebP, never JPEG.
- Every picture is fetched over `https://`, and **each must be under 2 MB**.
- An icon SVG that fills with `currentColor` follows the app's colours. An icon
  that names its own colours, and every PNG or WebP, keeps them.
- Baggo's own catalogs use 512 × 512 transparent PNG item pictures. That is a
  good size to aim for, not a rule.

A catalog file may be at most 5 MB, with at most 5,000 items and 200
categories.

## Share a standalone JSON file

Community catalogs are **standalone JSON files**: one file that people import
with **Import a file**, or add with **Add by link** from its raw address (see
below). It has no folder beside it, so **every picture reference must be an
absolute `https://` URL**. Baggo drops a relative path, because there is
nothing to resolve it against.

The [template](templates/catalog.template.json) and all the
[examples](examples) are standalone, and the validator enforces this.

Catalogs that are served from a folder and use image paths relative to the
file are not offered for the community library yet. For now they are reserved
for Baggo's own catalogs.

## Which GitHub address is which?

For the same file, GitHub shows three different addresses. Only one is the
catalog.

| | Looks like | Is it a catalog? |
| --- | --- | --- |
| **Repository URL** | `https://github.com/you/your-catalog` | No. It is the project page. Give it to us so we can find your work. |
| **File-view URL** | `https://github.com/you/your-catalog/blob/main/catalog.json` | No. It is a web page that displays the file. |
| **Raw JSON URL** | `https://raw.githubusercontent.com/you/your-catalog/main/catalog.json` | **Yes.** This is the file itself. |

**Add by link needs the raw JSON URL.** Pasting a repository or file-view
address fails, because the page that comes back is not JSON.

To get the raw address, open the file on GitHub, choose **Raw**, and copy the
address from the browser.

## Image permissions and licensing

You are responsible for the pictures a catalog points to.

- Only use images you made, or that their owner allows you to use this way.
  Finding a picture online does not mean you may use it.
- The catalog's `license` field covers your catalog data (names, notes,
  structure). It does **not** cover the pictures, which keep their own licences.
- Follow each licence's conditions. Attribution licences such as CC BY and
  CC BY-SA need credit, so put the credit in the catalog's `description` or
  `homepage`. The [examples](examples) show this.
- Linking to a picture also depends on the host allowing it. Prefer your own
  repository, or an icon service that is meant to be linked.

The example catalogs link to these open icon sets:

| Example | Pictures | Licence |
| --- | --- | --- |
| `daily-basket.fluent.json` | [Fluent Emoji (Flat)](https://github.com/microsoft/fluentui-emoji) | MIT |
| `daily-basket.gameicons.json` | [game-icons.net](https://game-icons.net) | CC BY 3.0 |
| `daily-basket.openmoji.json`, `illustrated-basket.json` | [OpenMoji](https://openmoji.org) | CC BY-SA 4.0 |
| `catalog.template.json` | [Tabler Icons](https://tabler.io/icons), via Iconify | MIT |

## Format rules and community rules

Two different sets of rules apply. Keep them apart.

**The format** is what Baggo can read. It is the schema above: six required
fields, everything else optional. A catalog that passes the schema and the
validator can be added to Baggo, by anyone, for personal use. You do not need
anyone's approval for that.

**Community submission** is an extra step, if you want your catalog featured in
the Baggo community library. On top of the format, we ask for:

- a public GitHub repository holding the catalog;
- a catalog that passes `npm run validate`;
- text and pictures you have the right to share;
- clear item names, fitting categories and accurate descriptions;
- your repository link and the raw JSON link, with a short description and the
  languages the catalog supports, emailed to
  [hello@baggo.dev](mailto:hello@baggo.dev?subject=Catalog%20submission).

Every submission is reviewed by hand. Review does not guarantee that a catalog
is accepted or featured, and Baggo may reject or remove catalogs that do not
follow the guidelines. The full wording is on the
[guidelines page](https://baggo.dev/community/guidelines).

## Licence

The contents of this repository are released under [CC0 1.0](LICENSE), so you
can copy the template and examples freely. The pictures the examples link to
keep their own licences, listed above.
