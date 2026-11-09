# Pip's Squirrel Chase: sources for real-place facts

Every real-world claim in the New York tour is listed here with a URL. The same claims sit in each city's `facts` array
(or on a clue's own `source`) in `src/content/cities.js`, and `tools/content-tests.mjs` fails if a fact's URL is missing
from this file. The gang, the witnesses, the hideouts and every plot are fictional. Postcards reuse city facts, so they
are covered by the city tables.

**How these were checked.** As with Case Files, the content session could search the web but could not open most pages
directly (the network allow-list blocked parks.ny.gov and most other hosts), so each claim was confirmed from search
excerpts of the cited page or of several agreeing pages, not from reading the full page. Where sources disagreed, the
text uses only the part they agree on (for example "more than 150 waterfalls", "two tall ski jump towers") or leaves the
claim out. The parent review step should spot-check the rows marked **spot-check** (secondary, encyclopedia or thin
sources, or a source that was confirmed through other pages). See "Dropped or avoided" at the end.

## Rochester

| Claim | Source |
|---|---|
| High Falls is a 96-foot waterfall on the Genesee River in the middle of downtown Rochester | https://www.visitrochester.com/things-to-do/outdoors/waterfalls/high-falls/ |
| The National Toy Hall of Fame is in Rochester (at The Strong National Museum of Play) and honors toys loved over many generations | https://www.iloveny.com/listing/the-strong-museum/3530/ |
| Frederick Douglass published The North Star, an abolitionist newspaper, in Rochester from 1847 | https://www.nps.gov/museum/exhibits/frdo/exb/mightyWord/frdo3219_north_star_newspap.html |
| The Lilac Festival is held each May in Highland Park, which has more than 500 varieties of lilacs. **spot-check** (encyclopedia; the festival's and Monroe County's own pages were not reachable) | https://en.wikipedia.org/wiki/Rochester_Lilac_Festival |
| (clue only) Susan B. Anthony lived in a Rochester house that is now a museum. **spot-check** (encyclopedia; the museum site susanb.org agrees in excerpts) | https://en.wikipedia.org/wiki/Susan_B._Anthony_House |

## Buffalo

| Claim | Source |
|---|---|
| Buffalo is on the shore of Lake Erie; Canalside is the site of the western end (terminus) of the Erie Canal | https://esd.ny.gov/esd-media-center/press-releases/canalside-tenth-anniversary |
| The world's first steam-powered grain elevator was built in Buffalo in 1842 (Joseph Dart and Robert Dunbar); a steam engine drove a belt of buckets that lifted grain out of boats. Most sources say 1842; a few say 1843 | https://www.wbfo.org/heritage-moments/2017-11-20/heritage-moments-dart-dunbar-and-the-colossus-in-the-harbor |
| Buffalo City Hall was completed in 1931 and has an observation deck on the 28th floor open to visitors. **spot-check** | https://www.atlasobscura.com/places/buffalo-city-hall |
| Buffalo chicken wings are named after the city | https://www.smithsonianmag.com/legacy_blog/a-brief-history-of-the-buffalo-chicken-wing/ |

## Niagara Falls

| Claim | Source |
|---|---|
| Niagara Falls is three waterfalls: the American Falls, the Bridal Veil Falls and the Horseshoe Falls | https://www.niagarafallsusa.com/the-source/american-horseshoe-and-bridal-veil-falls-a-primer/ |
| The falls sit on the border between the United States and Canada | https://www.niagarafallsusa.com/the-source/american-horseshoe-and-bridal-veil-falls-a-primer/ |
| The Niagara River runs from Lake Erie to Lake Ontario and flows over the falls | https://www.worldatlas.com/articles/where-is-niagara-falls.html |
| Niagara Falls State Park (the State Reservation at Niagara) opened in 1885; New York State Parks calls it the oldest state park in the country. The text says "New York calls it" because some historians dispute "first" | https://parks.ny.gov/blog/niagara-falls-state-park-celebrating-140-years-natural-wonder-preserved |

## Syracuse

| Claim | Source |
|---|---|
| Syracuse is nicknamed the Salt City; brine (salty) springs near Onondaga Lake made it a major salt producer in the 1800s | https://dec.ny.gov/sites/default/files/2026-08/salt26.pdf |
| Canal boats were weighed in the 1850 Weighlock Building in Syracuse, which now houses the Erie Canal Museum | https://nyheritage.org/node/15846 |
| The first state fair in the United States was held in Syracuse in 1841; the New York State Fair is held near Syracuse each summer | https://nysfair.ny.gov/?p=137 |

## Albany

| Claim | Source |
|---|---|
| Albany is the capital of New York State and has been since 1797. **spot-check** (the 1797 date was confirmed from several agreeing pages; check it on the city page) | https://www.albanyny.gov/512/City-History |
| The New York State Capitol took 32 years to build, from 1867 to 1899. **spot-check** (encyclopedia) | https://en.wikipedia.org/wiki/New_York_State_Capitol |
| The New York State Museum was founded in 1836 and displays the Cohoes Mastodon, found in Cohoes in 1866. **spot-check** (tourism listing; nysm.nysed.gov was not reachable) | https://www.albany.org/listing/new-york-state-museum/4868/ |
| The Tulip Festival is held each May in Washington Park; it began with tulip bulbs given by Albany's Dutch sister city, Nijmegen | https://albanyny.gov/2306/Tulip-Festival |

## Cooperstown

| Claim | Source |
|---|---|
| The National Baseball Hall of Fame and Museum opened in Cooperstown in 1939 | https://baseballhall.org/media/cooperstown-new-york |
| The village was founded in 1786 by William Cooper, father of the novelist James Fenimore Cooper (one source says 1785, the year he bought the land; the text says 1786 like the Hall of Fame's page) | https://baseballhall.org/media/cooperstown-new-york |
| Cooperstown is at the south end (the foot) of Otsego Lake, which James Fenimore Cooper called the Glimmerglass. **spot-check** | https://www.cooperstownny.org/about |
| The Cardiff Giant, a famous 1869 hoax (a carved stone "giant"), is shown at the Farmers' Museum in Cooperstown | https://www.wamc.org/new-york-news/2019-10-17/cardiff-giant-celebrates-150th-birthday |

## Corning

| Claim | Source |
|---|---|
| The Corning Museum of Glass has more than 50,000 works in glass covering more than 3,500 years | https://press.cmog.org/about-the-corning-museum-of-glass-fact-sheet |
| The museum's glassblowers give live glassblowing demonstrations (the Hot Glass Show) daily | https://press.cmog.org/about-the-corning-museum-of-glass-fact-sheet |
| In 1934 Corning poured a 200-inch glass disk for the Palomar telescope mirror (the first try is on display at the museum) | https://whatson.cmog.org/exhibitions-galleries/mirror-discovery-200-inch-disk-and-hale-reflecting-telescope-palomar |
| Corning's nickname is the Crystal City, from its glassmaking. **spot-check** (word-history blog; Wikipedia agrees) | https://barrypopik.com/blog/corning_crystal_city_nickname |

## Lake Placid

| Claim | Source |
|---|---|
| Lake Placid hosted the Winter Olympics in 1932 and 1980 | https://olympics.com/en/news/olympic-tradition-and-legacy-flourish-in-lake-placid |
| In 1980 the U.S. hockey team beat the Soviet Union in Lake Placid, the game called the "Miracle on Ice". **spot-check** (confirmed through several pages; check the wording on the IOC page) | https://olympics.com/ioc/news/lake-placid-1980-taking-the-adirondacks-global-again |
| Two ski jump towers built for the 1980 Winter Olympics stand at the Olympic Ski Jumping Complex near the village. **spot-check** (encyclopedia; sizes differ by source, so no sizes are given) | https://en.wikipedia.org/wiki/Lake_Placid_Olympic_Ski_Jumping_Complex |
| Lake Placid is in the Adirondack Park, the largest publicly protected area in the contiguous United States ("the lower 48 states") | https://apa.ny.gov/about/park.html |

## Saratoga Springs

| Claim | Source |
|---|---|
| The city is named for its natural mineral springs; the carbonated spring water can be sampled free at public springs | https://www.discoversaratoga.org/blog/stories/post/experience-the-natural-mineral-springs-in-saratoga-ny/ |
| Thoroughbred racing at Saratoga began in 1863; the race course is one of the oldest in the country (the text avoids the stronger "oldest sports venue" claim) | https://discoversaratoga.org/saratoga-springs-visitor-center/history |
| The Battles of Saratoga (1777) were fought nearby and were a turning point of the American Revolution | https://www.nps.gov/parkhistory/online_books/colonials-patriots/sitea10.htm |

## Ithaca

| Claim | Source |
|---|---|
| More than 150 waterfalls lie within 10 miles of Ithaca; the motto "Ithaca is Gorges" | https://www.visitithaca.com/blog/post/48-hours-and-10-ithaca-waterfalls/ |
| Ithaca is at the south end of Cayuga Lake, the longest Finger Lake | https://www.visitfingerlakes.com/plan-your-trip/finger-lakes-facts/cayuga-lake/ |
| Cornell University was founded in Ithaca in 1865 (classes began in 1868) | https://www.britannica.com/topic/Cornell-University |
| Taughannock Falls drops 215 feet, taller than Niagara Falls (NYS Parks: 33 feet taller). **spot-check** (relayed from NYS Parks by a parks association page; parks.ny.gov was not reachable) | https://www.americasstateparks.org/state-park/taughannock-falls/ |

## New York City

| Claim | Source |
|---|---|
| New York City is the most populous city in the United States | https://www.census.gov/about/history/stories/monthly/2023/january-2023.html |
| The city has five boroughs: Manhattan, Brooklyn, Queens, the Bronx and Staten Island | https://www.census.gov/about/history/stories/monthly/2023/january-2023.html |
| The Statue of Liberty was a gift from the people of France, dedicated in 1886 | https://www.nps.gov/articles/liberty.htm |
| Central Park covers 843 acres in Manhattan | https://www.centralparknyc.org/celebrating-40-years-of-commitment-and-conservancy |
| (clue only) More than 12 million immigrants entered the United States through Ellis Island (1892 to 1954) | https://www.nps.gov/parkhistory/categrs/immg.htm |

## Watkins Glen (extra city)

| Claim | Source |
|---|---|
| Watkins Glen State Park's gorge has 19 waterfalls, and the Gorge Trail passes behind one of them (Cavern Cascade). **spot-check** (waterfall guide; several sources agree on 19) | https://www.gowaterfalling.com/waterfalls/watkins.shtml |
| (clue only) Glen Creek drops about 400 feet through the gorge in about 2 miles. **spot-check** | https://www.gowaterfalling.com/waterfalls/watkins.shtml |
| The village is at the south end of Seneca Lake, the deepest Finger Lake, 618 feet deep | https://dec.ny.gov/places/seneca-lake |
| The first Watkins Glen sports car race (1948) ran through the village streets | https://wskg.org/watkins-glen-the-street-years/ |

## Binghamton (extra city)

| Claim | Source |
|---|---|
| The Binghamton area (Broome County) is called the Carousel Capital of the World; its six antique carousels are free to ride | https://www.iloveny.com/listings/Broome-County-Carousels/1471/ |
| Edwin Link grew up in Binghamton (his family moved there in 1910) and built his early flight trainer in 1929 so pilots could practice on the ground. **spot-check** (two sources: the ASME landmark page for the 1929 trainer, and Binghamton University's biography, https://www.binghamton.edu/libraries/about/special-collections/research-and-collections/link/edwin-link/ , for where he grew up) | https://www.asme.org/about-asme/engineering-history/landmarks/210-Link-C-3-Flight-Trainer |
| Binghamton is where the Chenango River flows into the Susquehanna River. **spot-check** (encyclopedia) | https://en.wikipedia.org/wiki/Binghamton,_New_York |

## Dropped or avoided (could not verify, contested, or not right for this game)

- **Syracuse snowfall** ("snowiest big city", about 128 inches a year): the averages differ by source and period, and snow
  would also blur clues with Buffalo. Left out.
- **Buffalo as "second-largest city in the state"**: the ranking was found only in encyclopedia text, not the Census page; left out.
- **The 1964 Buffalo-wing origin story**: contested, and it centers a business name. Only "named after the city" is used.
- **Saratoga Spa State Park founded in 1911**, the National Museum of Dance (it may be closed), and the "Saratoga chips"
  potato-chip legend: no reliable source found, so left out.
- **Heights of the Niagara falls** (sources give different numbers), and Taughannock's "tallest single drop east of the
  Rockies" (repeated, not verified).
- **Watkins Glen Gorge Trail length** (1.1, 1.5 or 2 miles, depending on the source): the text says "19 waterfalls" only.
- **Lake Placid ski jump sizes** (90/120 m versus HS100/HS128): the text says "two tall towers".
- **"Oldest and largest state museum"** (the New York State Museum describes itself this way; no independent ranking found).
- **"Oldest sports venue in the country"** for Saratoga Race Course: the text uses the narrower "one of the oldest racetracks".
- **Albany "oldest city" and charter claims**, and Fort Orange dates: not needed and partly contested.
- **Haudenosaunee history** of these places (for example the Onondaga Nation at Onondaga Lake, the Seneca at Canalside):
  no verified, respectful source set was gathered in this session, so the tour does not mention it. A later pass should
  add it with care rather than leave it out for good.
- Brand and company names (glassworks, snack makers, tour-boat companies) are kept out of every sign and clue.
