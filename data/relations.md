Relations in `data/relations.json` are directed. Each relation has a `sourceKey` and a `targetKey`; the direction matters.

For resource relations, use the resource’s tag from `data/src-data.json` as `sourceKey`. Never use a resource name or tag as `targetKey`. A `targetKey` must identify a top-level parent entity; do not target a child entity.

In the guide below, each `+` represents a suggested weight of `+0.05`, and each `-` represents `-0.05`. For example, `+++OIL` suggests a weight of `0.15`, while `--GAS` suggests `-0.10`. These are guidelines, not strict requirements; use judgment when choosing weights.

You may add relations that are not listed in the guide. For additional resource relations, consider each faction’s country list and real-world resource availability in those regions.

For relations between countries and companies, consider their names, lore, and worldbuilding when deciding whether a relation makes sense and what its weight should be.

# CURRENT SOURCE LIST IS (BY TAG)
OIL
GAS
URANIUM
IRON
COPPER
LITHIUM
PHOSPHA
SULFUR
BAUX
NICK
MANGA
COBALT
REE
GRAPH
TITAN
CHROM
TUNG
SILICA
HELIUM
COAL

# COUNTRY | (WEIGHT)SOURCE
Al-Falah | +++OIL ++GAS ++SULFUR +PHOSPHA ++CHROM +BAUX ++HELIUM
Central Asian Federation | +OIL +GAS +URANIUM +++CHROM +SULFUR +COPPER +IRON +COAL
North Sea Alliance | +OIL ++GAS +URANIUM ++IRON +COPPER +++REE ++++COAL ++TITAN +GRAPH
Slavic Federation | +OIL +++GAS +URANIUM +++HELIUM ++IRON ++COAL +COPPER ++NICK +COBALT ++TITAN +PHOSPHA +SULFUR +MANGA +CHROM
Kimpwanza League | +URANIUM +++COPPER ++++COBALT ++++CHROM +++MANGA ++TITAN ++COAL +IRON +OIL +REE
INTEGR | ---OIL ---GAS -URANIUM +IRON +COPPER +CHROM +NICK -PHOSPHA +TUNG +SILICA
Pact of Hyderabad | -OIL -GAS +URANIUM ++IRON ++COAL ++BAUX ++CHROM +MANGA +TITAN +GRAPH
Pan-Asian Cooperative | -OIL +URANIUM ++IRON +LITHIUM +REE +COAL +++GRAPH ++++TUNG ++PHOSPHA +++TITAN +SULFUR +SILICA +BAUX +NICK +MANGA
North American Union | +OIL -GAS -URANIUM +IRON +COAL +COPPER +LITHIUM +PHOSPHA +SULFUR +NICK +SILICA ++HELIUM +REE
Mediterranean Bloc | -OIL -GAS +IRON +COPPER ++BAUX +TUNG
Polystralia | +OIL -GAS ++URANIUM ++++IRON +++COAL ++LITHIUM +++BAUX +++NICK ++MANGA ++COBALT ++TITAN +COPPER +SILICA
Brasilia | ++OIL +++IRON +COPPER ++BAUX ++NICK +MANGA +GRAPH +PHOSPHA
Conosur | -OIL -GAS +++COPPER +LITHIUM
People's African Union | +OIL +GAS +URANIUM ++COPPER +COBALT ++GRAPH +COAL +REE +TITAN +NICK
Andean Compact | +IRON ++LITHIUM +REE +COAL ++COPPER +TUNG +PHOSPHA
Bamako Compact | ++OIL +GAS +URANIUM +++IRON ++BAUX ++MANGA +LITHIUM
Union of Maghreb | ++OIL +++GAS ++++PHOSPHA -SULFUR +COPPER +COBALT +IRON

# COMPANY | (WEIGHT)SOURCE
ARC International | ---OIL ---GAS -URANIUM -IRON --LITHIUM ---REE -COBALT
Pavlov Energy | --OIL --GAS ---URANIUM --LITHIUM
Westralian Logistics | --OIL -GAS -IRON ---LITHIUM
AutoFarm International | +GAS -LITHIUM +++HELIUM --PHOSPHA -SULFUR
PLENFOR Armor & Steel | --IRON -COPPER -LITHIUM -NICK -MANGA -TITAN -CHROM -TUNG
Vostok Heavy Industries | ---IRON -LITHIUM -MANGA
LOW Artillery Foundries | --IRON -LITHIUM -MANGA -TITAN --TUNG
Antarctica Trust | +OIL ++GAS +URANIUM ++++REE ++++HELIUM +IRON +COAL +COPPER
North Sea Construction | ---IRON -COPPER -MANGA -SILICA
Cooperativa Minera de Lima | +IRON +COPPER ++++LITHIUM ++REE +COAL
Morgan Industries | ++COBALT +COPPER
NADL Industries | -IRON
INTRCD |
Compact Corporation | +COPPER +LITHIUM
Sub-Orbital Contractors | -BAUX -TITAN -HELIUM
Pacific Patch Market | +IRON +COPPER +REE
Müninstek Freunde | (+OIL +GAS, 0.03 each: fossil price spikes feed the case for the Ecomodel)
INCOM International | -REE -SILICA
Pioneer Habitat Works | -IRON -SILICA
LysCore |
Bharat Blackrock | ++++COAL
Permafrost Reconstruction | -IRON -GAS
Ark Initiative |
ABTBIA | -IRON -COPPER
University of Eurasia Fund |

# INTERPRETATIONS (added with the extra relations)
Names in relations.json follow data/gdp-data.json and data/mkt-data.json exactly (Al-Falah, LOW Artillery Foundries, ...). The lists above were typed with older spellings in places.

## Sign and size
- A source price move pushes the target in the same direction when the weight is positive (the target earns from that source) and the opposite direction when negative (the target pays for it). Producers get +, heavy consumers and importers get -.
- Source to country/company weights use the +/- steps above (0.05 each). Country/company links use free values between 0.02 and 0.12.
- The country to company link is usually a bit larger than the company back to the country (the state backs the firm more than the firm moves the state). Rivalries are negative and small (-0.02 to -0.03).

## Added country lists (real world source availability)
- Brasilia: Brazil (iron, bauxite, manganese, graphite, phosphate, nickel), Bolivaria and Guiana (oil), Caribbean Union (Cuban nickel).
- People's African Union: Zambezia (copper, cobalt), Tanzania/Mozambique/Madagascar (graphite, gas, titanium, nickel), Ethiopia/South Sudan (oil).
- Bamako Compact: Mauritania/Liberia/Burkina (iron), Ghana/Ogowe (manganese, bauxite), Biafra/Sokoto (oil, gas), Mali (lithium).
- Union of Maghreb: Morocco (phosphate, the largest reserve on Earth, and a big sulfur importer), Algeria (gas, oil, iron).
- Kimpwanza League: Republic of the Kongo (cobalt, copper), South Africa (chromium, manganese, titanium, coal), Angola (oil).
- Others (Al-Falah, Slavic, Pan-Asian, Polystralia, ...) were extended with the new source tags using the same logic: China for graphite, tungsten, phosphate, titanium; Australia/Indonesia for iron, bauxite, nickel; Kazakhstan for chromium; India for coal, iron, bauxite; Qatar for helium; Norway for titanium.

## Company readings (the lore gives little, so these are assumptions)
- Morgan Industries: the Kongo/Africa mega-corporation (see PAU lore). It earns from cobalt and copper, grows with Kimpwanza League and INTEGR, and is a rival of the People's African Union and ABTBIA.
- ABTBIA: the board that regulates the African economy. It moves with the People's African Union and pays for infrastructure inputs (iron, copper).
- Compact Corporation: read as the Andean Compact's corporate arm (the Compact is run by its corporations), so it tracks Andean Compact, copper and lithium.
- NADL Industries: read as North American Union heavy industry (steel input costs), tied to the North American Union and ARC International.
- INCOM International: electronics and tech from the Pan-Asian Cooperative. Pays for rare earths and silica.
- Pioneer Habitat Works: space habitats, fed by Sub-Orbital Contractors and ARC. Pays for iron and silica.
- Permafrost Reconstruction: Siberian and Arctic rebuilding, so Slavic Federation and North Sea Alliance. Pays for iron and heating gas.
- Ark Initiative: biodiversity and seed preservation, tied to Müninstek Freunde and Antarctica Trust (ice vaults). Change this if its lore turns out to be about space arks.
- Pacific Patch Market: the Great Pacific Garbage Patch salvage trade. Scrap metal and old electronics make it earn more when iron, copper and REE rise.
- Bharat Blackrock: read as a coal producer and trader based on Bharat.
- LysCore, INTRCD, University of Eurasia Fund: no extra source links, only the country links in relations.json.

## Pairs worth knowing
- People's African Union and Kimpwanza League/Bamako Compact are rivals (-0.02 each way).
- Mediterranean Bloc and Union of Maghreb are trade partners (positive), while North Sea Alliance takes trade from the Mediterranean Bloc (-0.02).
- Conosur and Antarctica Trust (Patagonian gateway) share a small positive link.

## Keys
- data/relations.json uses a single "relations" array. tools/validate.mjs reads that array, checks each relation's keys and weight, and enforces the source and target rules at the top of this file.
