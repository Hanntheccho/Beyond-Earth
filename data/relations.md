Relations in `data/relations.json` are directed. Each relation has a `fromKey` and a `toKey`; the direction matters.

For good relations, use the good’s tag from `data/good-data.json` as `fromKey`. Never use a good name or tag as `toKey`. A `toKey` must identify a top-level parent entity; do not target a child entity.

In the guide below, each `+` represents a suggested weight of `+0.05`, and each `-` represents `-0.05`. For example, `+++OIL` suggests a weight of `0.15`, while `--GAS` suggests `-0.10`. These are guidelines, not strict requirements; use judgment when choosing weights.

You may add relations that are not listed in the guide. For additional good relations, consider each bloc’s country list and the real-world availability of those goods in those regions.

For relations between blocs and corps, consider their names, lore, and worldbuilding when deciding whether a relation makes sense and what its weight should be.

# CURRENT GOOD LIST IS (BY TAG)
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

# BLOC | (WEIGHT)GOOD
Al-Falah | +++OIL +++GAS ++SULFUR ++PHOSPHA ++CHROM +BAUX ++HELIUM
Central Asian Federation | ++OIL +++GAS ++URANIUM +++CHROM +SULFUR +COPPER +IRON +COAL
North Sea Alliance | +OIL ++GAS +URANIUM ++IRON +COPPER +++REE ++++COAL ++TITAN +GRAPH
Slavic Federation | +OIL +++GAS +URANIUM +++HELIUM ++IRON ++COAL +COPPER ++NICK +COBALT ++TITAN +PHOSPHA +SULFUR +MANGA +CHROM
Kimpwanza League | +URANIUM +++COPPER ++++COBALT ++++CHROM +++MANGA ++TITAN ++COAL +IRON +OIL +REE
INTEGR | ---OIL ---GAS -URANIUM +IRON +COPPER +CHROM +NICK -PHOSPHA +TUNG +SILICA
Pact of Hyderabad | -OIL -GAS +URANIUM ++IRON ++COAL ++BAUX ++CHROM +MANGA +TITAN +GRAPH
Pan-Asian Cooperative | -OIL +URANIUM ++IRON +LITHIUM +REE +COAL +++GRAPH ++++TUNG ++PHOSPHA +++TITAN +SULFUR +SILICA +BAUX +NICK +MANGA
North American Union | +OIL -GAS -URANIUM +IRON +COAL +COPPER +LITHIUM +PHOSPHA +SULFUR +NICK +SILICA ++HELIUM +REE
Mediterranean Bloc | -OIL +GAS +IRON +COPPER ++BAUX +TUNG +++PHOSPHA -SULFUR
Polystralia | +OIL -GAS ++URANIUM ++++IRON +++COAL ++LITHIUM +++BAUX +++NICK ++MANGA ++COBALT ++TITAN +COPPER +SILICA
Brasilia | ++OIL +++IRON +COPPER ++BAUX ++NICK +MANGA +GRAPH +PHOSPHA
Conosur | -OIL -GAS +++COPPER +LITHIUM
People's African Union | +OIL +GAS +URANIUM ++COPPER +COBALT ++GRAPH +COAL +REE +TITAN +NICK
Andean Compact | +IRON ++LITHIUM +REE +COAL ++COPPER +TUNG +PHOSPHA
Bamako Compact | ++OIL +GAS +URANIUM +++IRON ++BAUX ++MANGA +LITHIUM

# CORP | (WEIGHT)GOOD
ARC International | ---OIL ---GAS -URANIUM -IRON --LITHIUM ---REE -COBALT
Pavlov Energy | --OIL --GAS ---URANIUM --LITHIUM
Westralian Logistics | --OIL -GAS -IRON ---LITHIUM
AutoFarm International | -GAS -LITHIUM --PHOSPHA -SULFUR
PLENFOR Armor & Steel | --IRON -COPPER -LITHIUM -NICK -MANGA -TITAN -CHROM -TUNG
Vostok Heavy Industries | ---IRON -LITHIUM -MANGA
LOW Artillery Foundries | --IRON -LITHIUM -MANGA -TITAN --TUNG
Antarctica Trust | +OIL ++GAS +URANIUM ++++REE ++++HELIUM +IRON +COAL +COPPER
North Sea Construction | ---IRON -COPPER -MANGA -SILICA
Cooperativa Minera de Lima | +IRON +COPPER ++++LITHIUM ++REE +COAL
Morgan Industries | ++COBALT +COPPER +OIL -PHOSPHA
NADL Industries | -IRON -SILICA
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
Names in relations.json follow data/bloc-data.json and data/corp-data.json exactly (Al-Falah, LOW Artillery Foundries, ...). The lists above were typed with older spellings in places.

## Sign and size
- A "from" price move pushes the "to" item in the same direction when the weight is positive (it earns from that good) and the opposite direction when negative (it pays for it). Producers get +, heavy consumers and importers get -.
- Good to bloc/corp weights use the +/- steps above (0.05 each). Bloc/corp links use free values between 0.02 and 0.12.
- The bloc to corp link is usually a bit larger than the corp back to the bloc (the state backs the firm more than the firm moves the state). Rivalries are negative and small (-0.02 to -0.03).
- Pushes chain: a bloc or corp passes on what its own relations did to it one tick later. An oil move reaches Al-Falah at once and Al-Falah's rivals on the next tick, smaller at every link.

## Added country lists (real-world availability of goods)
- Brasilia: Brazil (iron, bauxite, manganese, graphite, phosphate, nickel), Bolivaria and Guiana (oil), Caribbean Union (Cuban nickel).
- People's African Union: Zambezia (copper, cobalt), Tanzania/Mozambique/Madagascar (graphite, gas, titanium, nickel), Ethiopia/South Sudan (oil).
- Bamako Compact: Mauritania/Liberia/Burkina (iron), Ghana/Ogowe (manganese, bauxite), Biafra/Sokoto (oil, gas), Mali (lithium).
- Mediterranean Bloc: Franco-Iberia, Italia, Padania, Greece and the Union of Maghreb. The Union of Maghreb is no longer a top-level entity, so its old profile is folded in here: Morocco (phosphate, the largest reserve on Earth, and a big sulfur importer) and Algeria (gas). The Bloc still buys most of its oil.
- Al-Falah: Türkiye, the Mashriq, Oman, Al-Hasa, Yemen, the Hejaz, Al-Hilal, and the United Arab Alliance (Egypt, Sudan, Tripolitania). Egypt adds gas and phosphate; Qatar (Al-Hasa) the helium.
- Central Asian Federation: Iran, Kazakhstan, Kyrgyzstan, Tajikistan, Turkmenistan, Uzbekistan, Afghanistan, Hazaristan. Iran adds oil and some of the largest gas reserves on Earth; Kazakhstan is the largest uranium producer and the chromium source.
- North Sea Alliance: Scotland, England, Ireland, Iceland, Greenland, Norway (coal, gas, iron, rare earths, Norwegian titanium).
- Polystralia: the Nusantaran Association, Australasia and Westralia (Australian and Indonesian iron, bauxite, nickel, coal, lithium).
- Conosur: Argentina and Chile (copper above all, some lithium, little oil or gas).
- Kimpwanza League: Republic of the Kongo (cobalt, copper), South Africa (chromium, manganese, titanium, coal), Angola (oil).
- Others (Slavic, Pan-Asian, ...) were extended with the new good tags using the same logic: China for graphite, tungsten, phosphate, titanium; Australia/Indonesia for iron, bauxite, nickel; India for coal, iron, bauxite; Norway for titanium.

## Company readings
Readings marked (lore) follow the POI text in data/loc/pois, and readings marked (mod) follow the company descriptions in the original Beyond Earth mod. The others are still assumptions, because neither source says anything about them.
- Morgan Industries (lore, BMK panel): Nwabudike Morgan's Biafran conglomerate. It propped up Biafra, is buying its way into Benin and Adamawa, and was thrown out of Sokoto, so it grows with the Bamako Compact. It earns from cobalt, copper and Biafran oil and pays for fertiliser (phosphate) for its Adamawa farms. The Kimpwanza League still sells cobalt through its brokers but distrusts it, so that link is weak. It stays a rival of the People's African Union and ABTBIA. It has no INTEGR link: nothing in the lore connects them, and Morgan's free-market creed is the opposite of INTEGR's green austerity.
- NADL Industries (mod): "the leading provider of fortifications in the world". It pays for iron and silica (steel and concrete) and grows with the powers building forts in the lore: the Andean Compact (forts along the Brazilian border), Brasilia (the Salles Line and the Andean front) and the People's African Union (its borders with the Kimpwanza League). It is not North American heavy industry, and has no NAU or ARC links.
- PLENFOR Armor & Steel (mod): the leading maker of armed and armored vehicles since the 2050s. It pays for the metals that go into armor and grows with the powers rearming in the lore: Brasilia (the mobilized junta), the Andean Compact (its army review found too few armored vehicles) and the People's African Union (the second-largest army in the world). Nothing places it in Conosur, so that link was removed.
- Pavlov Energy and University of Eurasia Fund (mod): Moscow-based corporations that field mercenary battalions for Eurasia. The University's cliques are also Eurasia's main political parties, so both move strongly with the Slavic Federation. The University courts the Central Asian Federation's government. Pavlov's old Al-Falah link had no basis in the lore and was removed.
- AutoFarm International (mod): automated agriculture, growing populations and cheaper consumer goods. It pays for fertiliser (gas, phosphate, sulfur) and machine batteries (lithium). Its old helium gain had no basis and was removed.
- Antarctica Trust (lore, ANTT panel): the trust that governs Antarctica and licenses its mines. It earns from rare earths and helium (White Lua Mines), gas (Mann's Sea) and the rest, with Conosur as its Patagonian gateway, Polystralia as its supplier, and the Ark Initiative's Ice Vaults on its land.
- Cooperativa Minera de Lima (lore, COOP panel): the member-owned lithium cooperative at the heart of the Andean Compact. It and the Compact depend on each other, and it is wary of the corporations that also run the Compact (a small negative with Compact Corporation).
- North Sea Construction (lore, NSA panel): read as the builder of Scotland's ARKs and sea walls, which is why it pays for iron, copper, manganese and silica and moves with the North Sea Alliance.
- LysCore (lore, FRA panel): Franco-Iberia's archive corporation, now an entry under the Mediterranean Bloc. It still has no good links.
- ABTBIA: the board that regulates the African economy. It moves with the People's African Union and pays for infrastructure inputs (iron, copper).
- Compact Corporation: read as the Andean Compact's corporate arm (the Compact is run by its corporations), so it tracks Andean Compact, copper and lithium.
- INCOM International: electronics and tech from the Pan-Asian Cooperative. Pays for rare earths and silica.
- Pioneer Habitat Works: space habitats, fed by Sub-Orbital Contractors and ARC. Pays for iron and silica.
- Permafrost Reconstruction: Siberian and Arctic rebuilding, so Slavic Federation and North Sea Alliance. Pays for iron and heating gas.
- Ark Initiative: biodiversity and seed preservation, tied to Müninstek Freunde and Antarctica Trust. The ANTT panel now confirms this: its seed and gene vaults are the Trust's Ice Vaults in the Grand Ice Canyon. It is unrelated to Scotland's ARK cities.
- Pacific Patch Market: the Great Pacific Garbage Patch salvage trade. Scrap metal and old electronics make it earn more when iron, copper and REE rise.
- Bharat Blackrock: read as a coal producer and trader based on Bharat.
- INTRCD, University of Eurasia Fund: no extra good links, only the bloc links in relations.json. INTRCD's old link to the Union of Maghreb was folded into its Mediterranean Bloc link.

## Pairs worth knowing
Each pair is listed with the lore behind it.
- People's African Union and Kimpwanza League: the deepest rivalry in Africa (-0.03 each way), from the Congo Crisis and the proxy war in the Mwitanzige Rift.
- People's African Union and Bamako Compact: rivals (-0.02 each way).
- Bamako Compact and Kimpwanza League: rivals (-0.02 each way). Biafra and Morgan eye the League's undefended Atlantic coast.
- Al-Falah and People's African Union: rivals (-0.02 each way). Egypt has fought the East African Federation.
- Al-Falah and Central Asian Federation: rivals (-0.03 each way). This covers the century-long Türkiye and Iran contest over Arabia, the Arabian War of 2188, and Hushangism's push west.
- Central Asian Federation and Pact of Hyderabad: small ties (+0.02 each way). The Federation backs Kashmir, a Pact member.
- Central Asian Federation and Slavic Federation: rivals since the Great Betrayal.
- Mediterranean Bloc and North Sea Alliance: the Alliance takes Mediterranean trade (-0.02), and Iceland's tax haven drains Franco-Iberian taxes (-0.03 the other way).
- North Sea Alliance and Slavic Federation: Iceland also drains Eurasian taxes (-0.02).
- North Sea Alliance and INTEGR: rising tension between Scotland, Germany and Poland (-0.02 each way).
- INTEGR and Central Asian Federation: INTEGR courts the Federation government (+0.02).
- Mediterranean Bloc and INTEGR: rivals (-0.03 each way).
- Andean Compact and Conosur: Lima would rather keep Argentina divided, and refugees and meddling cross the border (-0.02 each way).
- Andean Compact and Brasilia: rivals, with Brazil's junta preparing for war against the Compact.
- Conosur and Antarctica Trust (Patagonian gateway) share a small positive link.

## Keys
- data/relations.json uses a single "relations" array. tools/validate.mjs reads that array, checks each relation's keys and weight, and enforces the source and target rules at the top of this file.

