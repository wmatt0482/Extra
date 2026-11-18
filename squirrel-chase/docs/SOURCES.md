# Pip's Squirrel Chase: sources for real-place facts

Every real-world claim in the New York tour and the USA Tour is listed here with a URL. The same claims sit in each city's `facts` array
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
| High Falls is a tall waterfall on the Genesee River in the middle of downtown Rochester (older sources say 96 feet, but the falls were lowered in the early 1900s and sources now differ, so the text gives no number) | https://www.visitrochester.com/things-to-do/outdoors/waterfalls/high-falls/ |
| The National Toy Hall of Fame is in Rochester (at The Strong National Museum of Play) and honors toys loved over many generations | https://www.iloveny.com/listing/the-strong-museum/3530/ |
| Frederick Douglass published The North Star, an abolitionist newspaper, in Rochester from 1847 | https://www.nps.gov/frdo/learn/kidsyouth/chronology.htm |
| The Lilac Festival is held each May in Highland Park, which has more than 500 varieties of lilacs. **spot-check** (encyclopedia; the festival's and Monroe County's own pages were not reachable) | https://en.wikipedia.org/wiki/Rochester_Lilac_Festival |
| (clue only) Susan B. Anthony lived in a Rochester house that is now a museum. **spot-check** (encyclopedia; the museum site susanb.org agrees in excerpts) | https://en.wikipedia.org/wiki/Susan_B._Anthony_House |

## Buffalo

| Claim | Source |
|---|---|
| Buffalo is on the shore of Lake Erie; Canalside is the site of the western end (terminus) of the Erie Canal | https://esd.ny.gov/esd-media-center/press-releases/canalside-tenth-anniversary |
| The world's first steam-powered grain elevator was built in Buffalo, finished in spring 1843 (work began at the end of 1842; the cited WBFO page says it "went up in 1843") (Joseph Dart and Robert Dunbar); a steam engine drove a belt of buckets that lifted grain out of boats. | https://www.wbfo.org/heritage-moments/2017-11-20/heritage-moments-dart-dunbar-and-the-colossus-in-the-harbor |
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
| The Tulip Festival is held each May in Washington Park; it began with a gift of tulip bulbs from Queen Wilhelmina of the Netherlands after Albany sent help to its Dutch sister city, Nijmegen, after World War II (the text says only "a gift from the Netherlands") | https://albanyny.gov/2306/Tulip-Festival |

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
| The city is famous for its natural mineral springs (the name Saratoga comes from a Mohawk-derived name for the area, not from the springs); the carbonated spring water can be sampled free at public springs | https://www.discoversaratoga.org/blog/stories/post/experience-the-natural-mineral-springs-in-saratoga-ny/ |
| Thoroughbred racing at Saratoga began in 1863; the race course is one of the oldest in the country (the text avoids the stronger "oldest sports venue" claim) | https://discoversaratoga.org/saratoga-springs-visitor-center/history |
| The Battles of Saratoga (1777) were fought nearby and were a turning point of the American Revolution | https://www.nps.gov/sara/learn/historyculture/index.htm |

## Ithaca

| Claim | Source |
|---|---|
| Ithaca is surrounded by waterfalls and gorges; the motto "Ithaca is Gorges" (tourism sources say more than 150 waterfalls; the game gives no count) | https://www.visitithaca.com/blog/post/48-hours-and-10-ithaca-waterfalls/ |
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
| (clue only) More than 12 million immigrants entered the United States through Ellis Island (1892 to 1954) | https://www.nps.gov/elis/learn/historyculture/index.htm |

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

## USA Tour

The USA Tour (cases usa-01 to usa-06) adds 11 cities. New York City, the 12th, is listed above. Every source below was read
directly (page text, through a proxy fetch) in the content session, not only from search snippets, unless a row says
otherwise. Rows marked **spot-check** rest on one non-government source, or on a claim the page words a little
differently. Clues never name the city, and every clue is built on one of these claims.

### Boston

| Claim | Source |
|---|---|
| The Freedom Trail is a 2.5-mile walking trail that links 16 historic sites; the red line on the ground was added in 1958 | https://americantrails.org/resources/the-freedom-trail-massachusetts |
| In 1634 the townspeople bought William Blackstone's farm to be the Boston Common; cows were forbidden on it in 1830 | https://www.nps.gov/places/boston-common-ma.htm |
| Swan Boats are pedal-powered and have been a Public Garden fixture since 1877 | https://www.bu.edu/articles/2024/boston-swan-boats |
| USS Constitution, launched in Boston in 1797, is the oldest commissioned warship afloat in the world; nickname "Old Ironsides" (the facts say "oldest navy ship that still floats") | https://www.nps.gov/places/uss-constitution.htm |

### Philadelphia

| Claim | Source |
|---|---|
| The Liberty Bell is recognizable for its crack; no one recorded when or why it first cracked | https://www.nps.gov/inde/learn/historyculture/stories-libertybell.htm |
| The Declaration of Independence and the U.S. Constitution were both debated and signed in Independence Hall | https://www.nps.gov/inde/learn/historyculture/places-independencehall.htm |
| The first U.S. Mint building was built in Philadelphia and opened in 1793; its first coins were silver half dimes and copper cents | https://kids.usmint.gov/about-the-mint/history-timeline |
| The Philadelphia Zoo opened July 1, 1874; its slogan is "America's First Zoo" (worded as "calls itself America's first zoo" because a Central Park menagerie is older). **spot-check** (encyclopedia; the zoo's own 150th-anniversary page agrees in search excerpts) | https://en.wikipedia.org/wiki/Philadelphia_Zoo |

### Washington, D.C.

| Claim | Source |
|---|---|
| The Washington Monument is 555 feet, 5 1/8 inches tall and was the tallest building in the world when it was finished in 1884 | https://www.nps.gov/wamo/learn/historyculture/index.htm |
| The 1903 Wright Flyer is on display at the National Air and Space Museum in Washington, DC | https://airandspace.si.edu/collection-objects/1903-wright-flyer/nasm_A19610048000 |
| Tokyo's mayor gave the U.S. 3,020 Japanese cherry trees in 1912 (the text says "about 3,000"); the first two were planted by the Tidal Basin | https://www.nps.gov/articles/000/cherry-trees-on-the-national-mall.htm |
| The Lincoln Memorial has 36 Doric columns, one for each of the 36 states in the Union at the time (1865; the text avoids the reason) | https://www.nps.gov/linc/learn/historyculture/exterior-features.htm |

### Cape Canaveral

Kennedy Space Center is on Merritt Island, next to Cape Canaveral; the game uses "Cape Canaveral" for the whole Space Coast.

| Claim | Source |
|---|---|
| Apollo 11 launched July 16, 1969 from Launch Pad 39A at Kennedy Space Center, carrying the crew of the first crewed lunar landing | https://www.nasa.gov/missions/apollo/apollo-11/apollo-11-mission-overview/ |
| The Vehicle Assembly Building is 525 feet tall; rocket stages are moved, processed and stacked inside | https://www.nasa.gov/image-article/vehicle-assembly-building-kennedy-space-center/ |
| The space shuttle fleet flew 135 missions between April 1981 and July 2011; the last one ended at Kennedy Space Center | https://www.nasa.gov/space-shuttle/ |
| Kennedy Space Center shares a border with Merritt Island National Wildlife Refuge; alligators and more than 330 bird species live there | https://www.nasa.gov/image-article/alligators-rockets-sharing-kennedy-space-center/ |

### New Orleans

| Claim | Source |
|---|---|
| New Orleans was founded in 1718 by the French; the French Quarter (Vieux Carre) is its oldest neighborhood. **spot-check** (encyclopedia; the National Park Service page https://www.nps.gov/jazz/learn/historyculture/history_early.htm confirms the 1718 founding) | https://en.wikipedia.org/wiki/French_Quarter |
| Jazz developed in New Orleans; the National Park Service links Congo Square's drumming and dance traditions to jazz's origins (the NPS does not say "birthplace of jazz", so the text says "Jazz music began in New Orleans"). **spot-check** | https://www.nps.gov/jazz/learn/historyculture/history_early.htm |
| The St. Charles Avenue streetcar line began service in 1835; ASME calls it the oldest surviving urban passenger rail system in the United States (the text says "oldest streetcar line still running in the United States") | https://asme.org/About-ASME/Engineering-History/Landmarks/101-st-charles-avenue-streetcar-line |
| In 1986 the Louisiana legislature made the beignet the state doughnut; beignets are fried dough dusted with powdered sugar | https://statesymbolsusa.org/node/1975 |

### San Antonio

| Claim | Source |
|---|---|
| The River Walk (Paseo del Rio) winds for 13 miles; downtown the river is about 20 feet below street level | https://www.tshaonline.org/handbook/entries/san-antonio-river-walk-paseo-del-rio |
| Five Spanish colonial missions (including the Alamo) are one UNESCO World Heritage Site, inscribed in 2015, the only one in Texas | https://www.nps.gov/saan/learn/historyculture/world-heritage-site.htm |
| The Battle of Flowers Parade was founded in 1891 by women volunteers, inspired by flower parades in Spain (the Alamo reason for the parade is left out) | https://fiestasanantonio.org/history-of-fiesta/ |
| The Tower of the Americas is 750 feet tall and was built in 1968 for HemisFair, the world's fair for San Antonio's 250th anniversary | https://www.toweroftheamericas.com/history/ |

### St. Louis

| Claim | Source |
|---|---|
| The stainless-steel Gateway Arch is 630 feet tall; the National Park Service calls it the nation's tallest monument | https://www.nps.gov/jeff/planyourvisit/materials-and-techniques.htm |
| Gateway Arch National Park has only 91 acres, the smallest national park in the United States | https://www.nps.gov/jeff/learn/nature/nature.htm |
| Admission to the Saint Louis Zoo is free (some attractions inside charge a fee) | https://stlzoo.org/visit |
| The zoo's Flight Cage was built for the 1904 World's Fair; St. Louisans rallied to keep it and it led to the zoo | https://stlzoo.org/zones/historic-hill/1904-flight-cage-and-cypress-swamp |
| (clue only) The Gateway Arch has a tram ride to the top | https://www.nps.gov/jeff/index.htm |

### Chicago

| Claim | Source |
|---|---|
| Cloud Gate, nicknamed "the Bean," is a famous sculpture in Millennium Park. **spot-check** (tourism bureau page) | https://www.choosechicago.com/articles/tours-and-attractions/the-bean-chicago/ |
| (clue only) Cloud Gate is a 110-ton sculpture of polished stainless steel plates | https://www.chicago.gov/city/en/depts/dca/supp_info/chicago_s_publicartcloudgateinmillenniumpark.html |
| In 1900 the Sanitary District completed the Chicago Sanitary and Ship Canal, reversing the Chicago River away from Lake Michigan | https://mwrd.org/news/chicago-rivers-reversal-1900-was-engineering-triumph-transformed-our-city-chicago-sun-times |
| The world's first Ferris wheel was made for the 1893 World's Columbian Exposition in Chicago | https://www.chicagohistory.org/the-first-ferris-wheel/ |
| SUE the T. rex at the Field Museum is more than 40 feet long and about 90 percent complete (the museum's own claim: most complete T. rex discovered) | https://www.fieldmuseum.org/blog/sue-t-rex |

### Denver

| Claim | Source |
|---|---|
| A step on the Colorado State Capitol is marked one mile (5,280 feet) above sea level; the exact step has been re-measured three times (15th, 18th, 13th), so the text says "a step". **spot-check** (encyclopedia; the state's own page capitol.colorado.gov/history-capitol agrees in search excerpts) | https://en.wikipedia.org/wiki/Colorado_State_Capitol |
| Red Rocks Amphitheatre (owned by Denver) opened in 1941 and seats 9,525, set among natural rock formations | https://www.redrocksonline.com/our-story/history/ |
| "I See What You Mean," the Big Blue Bear, is a 40-foot-tall sculpture outside the Colorado Convention Center, peering into the lobby. **spot-check** (encyclopedia; Visit Denver agrees in search excerpts) | https://en.wikipedia.org/wiki/I_See_What_You_Mean_(Argent) |
| Denver was founded in November 1858 at the meeting of the South Platte River and Cherry Creek after a little gold was found there | https://history.denverlibrary.org/lodo-denvers-lower-downtown-success-story |

### Seattle

| Claim | Source |
|---|---|
| The Space Needle is 605 feet tall and opened shortly before the 1962 World's Fair (Century 21 Exposition) | https://www.historylink.org/file/1424 |
| Pike Place Market opened in 1907; the city calls it the oldest continuously operating public market in the country | https://www.seattle.gov/neighborhoods/historic-preservation/historic-districts/pike-place-market-historical-district |
| (clue only) Fish sellers at the Market throw fish ("the place where they throw the fish") | https://www.historylink.org/File/22703 |
| The Fremont Troll sits under a bridge, is made of rebar, wire and two tons of ferroconcrete, and clutches a car (the text avoids the car brand and the bridge's formal name) | https://www.historylink.org/File/7785 |
| Floating homes on Lake Union have been lived in since the 1920s and are still a Seattle neighborhood | https://www.seattle.gov/cityarchives/exhibits-and-education/seattle-segments/floating-homes |

### San Francisco

| Claim | Source |
|---|---|
| The Golden Gate Bridge opened in 1937; its 4,200-foot main span was the longest in the world at the time | https://www.goldengate.org/exhibits/facts-and-figures-about-the-bridge/ |
| The International Orange paint color was developed to fit the bridge's location | https://www.nps.gov/places/000/why-is-the-golden-gate-bridge-orange.htm |
| Andrew Hallidie invented the cable car in San Francisco and tested the first one in 1873; cable cars still run | https://www.sfmta.com/getting-around/muni/cable-cars/cable-car-history |
| Lombard Street's one-block section has eight hairpin turns, built in 1922 to ease a 27 percent grade (the "most crooked street" title is disputed, so the facts do not claim it). **spot-check** (encyclopedia) | https://en.wikipedia.org/wiki/Lombard_Street,_San_Francisco |

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

### USA Tour: dropped or avoided

- **Alcatraz and any prison history** of San Francisco: the kid rules ban the word and the theme. Left out.
- **"Birthplace of jazz"** (New Orleans) and the St. Charles streetcar as "oldest in the world": the NPS and ASME word these
  more carefully, so the text follows them. The cable cars and the St. Charles line are both National Historic Landmarks;
  no clue says "only moving landmark".
- **Pier 39 sea lions** (San Francisco): confirmed only from search excerpts, not read on the page; left out.
- **Space Needle brand details, company names and the Fremont Troll's car brand**: left out of signs and clues.
- **Why the Lincoln Memorial has 36 columns** (the NPS wording uses a banned word): the text says "one for each of the 36
  states in the country in 1865".
- **The Alamo battle** (San Antonio): not used. Only the Spanish missions, the River Walk, Fiesta and the tower.
- **Which Capitol step is the mile-high one** (15th, 18th or 13th, depending on the survey): the text says "a step".
- **Philadelphia Zoo "first in America"** is hedged ("calls itself"); Boston Common is not called "the oldest park" (the NPS
  itself says "generally considered"). Chicago's "the Bean" nickname and "Cape Canaveral" for the Kennedy Space Center
  area (the center is on Merritt Island) are common usage, not formal names.
- **Pike Place Market's "oldest" claim**: the city says oldest continuously operating public market; the Market itself is
  more hedged, so the text says "oldest public market in the country that is still running" (spot-check).
