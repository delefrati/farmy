Below is the most complete mechanics map I could reconstruct from available sources on **Happy Farm / 开心农场**, plus closely related versions such as **QQ Farm** and the Brazilian **Colheita Feliz / Happy Harvest**. The exact numbers, crop tables and balance values varied by platform/version, but the systems below are consistent across the documented versions.

Important caveat: old source material is fragmented. Some sources describe the original Chinese **Happy Farm**, others describe **QQ Farm**, and others describe **Colheita Feliz**, the Orkut/Brazilian version. I’m separating **core documented mechanics** from **variant/extended mechanics** where needed.

---

# 1. Core identity of the game

**Happy Farm** was a real-time social farming simulation game. Players owned a virtual farm, planted crops, waited for real-world time to pass, harvested products, sold them for currency, expanded/decorated the farm, and interacted with neighbors by helping or stealing from them. The original Chinese game became popular around 2008, and similar versions spread to platforms such as QQ/Qzone, Facebook and Orkut. ([Association for Asian Studies][1])

The game’s strength was not complex simulation. It was a simple loop plus social pressure: plant, wait, return at the right time, harvest before spoilage or theft, visit friends, help them, steal from them, and repeat. Wired described this genre as using basic 2D graphics and simple mechanics, with value coming mainly from social interaction rather than deep immersion. ([WIRED][2])

---

# 2. Primary game loop

The basic loop was:

1. Buy seeds.
2. Plant them on available soil plots.
3. Wait real-world time.
4. Maintain crops by watering/removing weeds/removing pests.
5. Harvest mature crops.
6. Store harvested goods.
7. Sell goods for coins.
8. Use coins to buy more seeds, fertilizer, decorations, animals, land expansions or other items.
9. Visit friends to help, steal, or interfere.
10. Gain XP, level up and unlock more content.

This loop is explicitly described in sources about both Happy Farm and Colheita Feliz: planting, watering, harvesting, selling, decorating, expanding, helping neighbors, killing bugs, pulling weeds and stealing products were central mechanics. ([Association for Asian Studies][1])

---

# 3. Farm layout mechanics

## 3.1 Farm area

The farm consisted of a visible 2D field with multiple plots/canteiros. Some plots were available from the start; many were blocked and had to be unlocked or expanded later. Colheita Feliz documentation describes a farm with several plots, most initially locked, plus a house, dog house and animal enclosure. ([Wikipédia][3])

## 3.2 Soil plots

Each soil plot could hold one crop or flower at a time.

Typical plot states:

```txt
locked
empty
planted
growing
dry
has weeds
has pests/bugs
mature
harvested residue
dead/withered
```

## 3.3 Expansion

Players could unlock or expand land using in-game currency and, in some versions, premium currency. Sources mention land expansion as a use for coins or premium credits. ([Wikipédia][3])

---

# 4. Crop mechanics

## 4.1 Seed purchase

Seeds were bought from the shop. In Colheita Feliz, seeds were bought with gold coins, required certain player levels, and had different growth times. That source says there were 33 seed types in that version. ([Wikipédia][3])

A crop definition typically included:

```ts
type Crop = {
  id: string;
  name: string;
  seedPrice: number;
  sellPrice: number;
  requiredLevel: number;
  growthDuration: number;
  stages: CropStage[];
  seasons: number;
  xpOnPlant?: number;
  xpOnHarvest?: number;
};
```

## 4.2 Planting

The player selected a seed and clicked an empty plot. Planting consumed one seed or charged its price, then set the crop’s `plantedAt` time.

## 4.3 Real-time growth

Growth used real-world time. A major feature of Happy Farm was that the game continued while the player was away. The Association for Asian Studies notes that Happy Farm ran at a one-to-one ratio with real-life time and used real calendar dates. ([Association for Asian Studies][1])

A correct implementation model is:

```ts
growthProgress = (now - plantedAt) / crop.growthDuration;
```

Do not model this as an active timer only while the game is open. The player should be able to close the browser and return later to find crops grown, ready, stolen, damaged or dead depending on elapsed time.

## 4.4 Growth stages

Colheita Feliz describes five plant stages:

```txt
germination
small leaves
large leaves
flowering
mature
```

These same stages applied to seeds and flowers. ([Wikipédia][3])

## 4.5 Crop maturity times

Happy Farm crops had long maturity timers compared with later Western farming games. One source says Happy Farm plant maturity could range from roughly **10 to 60 hours**, with the shortest times around **10, 13 and 14 hours**. This slow timing encouraged players to interact with neighbors while waiting. ([Association for Asian Studies][1])

## 4.6 Multi-season crops

Some seeds had multiple “seasons” or harvest cycles. After the crop matured and was harvested, it could regrow and produce again. Colheita Feliz documentation says seeds could have up to four growth seasons. ([Wikipédia][3])

Design model:

```ts
type CropInstance = {
  cropId: string;
  plantedAt: string;
  currentSeason: number;
  maxSeasons: number;
  stage: CropStage;
  health: number;
};
```

## 4.7 Harvest

When mature, crops could be harvested. Harvested goods went to a storage/deposit/warehouse, not directly to coins. The player then sold stored goods for currency. Colheita Feliz describes harvested seeds going to the deposit, where they could be sold for gold coins. ([Wikipédia][3])

## 4.8 Withering/death

Crops could wither or die if not harvested or cared for. Wired specifically describes the “harvest or die” urgency: if players did not harvest and sell crops, they could wither and die. ([WIRED][2])

Possible model:

```txt
mature window begins
if not harvested within grace period:
  crop becomes withered/dead
  player must remove it with hoe
```

## 4.9 Crop residue/removal

After harvesting, some crops or dead plants left residue that needed removal. Colheita Feliz had a hoe button for removing dead plants or leftovers from harvested plants. ([Wikipédia][3])

---

# 5. Crop health mechanics

## 5.1 Plant health bar

Colheita Feliz documentation describes two hover bars on planted seeds: one showing plant health, and another showing season/time-to-next-stage information. Health could drop because of pests, weeds or lack of water. ([Wikipédia][3])

Suggested model:

```ts
type PlantHealth = {
  health: number; // e.g. 0-100
  isDry: boolean;
  hasWeeds: boolean;
  hasPests: boolean;
};
```

## 5.2 Drought / dryness

Crops could become dry and needed watering. Happy Farm sources describe drought/dryness as a possible event during crop stages. ([GameRes][4])

Effects may include:

```txt
health loss
slower growth
reduced yield
risk of death
```

## 5.3 Watering

Players could water their own crops and friends’ crops. In some versions, watering gave rewards such as XP or coins. Recent QQ classic farm reporting says watering could shorten crop maturity time in that implementation. ([The Paper][5])

## 5.4 Weeds

Weeds could appear on crops. Players could remove weeds from their own farm or friends’ farms. Removing weeds was a social-help action and could reward XP/coins. ([GameRes][4])

## 5.5 Bugs / pests

Bugs or pests could appear and damage the crop. Players could remove them from their own or friends’ farms. ([Association for Asian Studies][1])

## 5.6 Deliberate sabotage

On friends’ farms, players could also add pests or weeds as a negative interaction. Colheita Feliz describes buttons for adding pests/pragas to damage another player’s farm; modern QQ Farm coverage also says “throwing bugs” and “placing weeds” returned as interaction mechanics. ([Wikipédia][3])

---

# 6. Fertilizer mechanics

Fertilizer reduced crop waiting time. Colheita Feliz documentation describes multiple fertilizer types:

```txt
normal fertilizer: reduces wait by 1 hour
fast fertilizer: reduces wait by 2 hours 30 minutes
super fertilizer: reduces wait by 5 hours 30 minutes
love fertilizer: usable on another player's farm, reduces wait by 1 hour
```

Some were bought with gold coins, some with premium credits, and some with either. Fertilizer could be used only for one stage of growth. ([Wikipédia][3])

For your version, you can simplify this to:

```ts
type Fertilizer = {
  id: string;
  name: string;
  reduceSeconds: number;
  canUseOnFriends: boolean;
  currency: "coins" | "premium" | "both";
};
```

---

# 7. Storage / warehouse / deposit mechanics

## 7.1 Harvested goods storage

Harvested crops did not instantly become money. They went into a warehouse/deposit/backpack. From there, the player could sell them. ([Wikipédia][3])

## 7.2 Sale price

Goods had sale value. A Chinese source mentions that users could choose a suitable time to sell warehouse fruit based on market fluctuation. ([GameRes][4])

So there may have been either:

```txt
fixed sell price
or
market-fluctuating sell price
```

For your recreation, fixed prices are enough for MVP; market fluctuation can be added later.

## 7.3 Backpack item categories

From QQ Farm automation documentation, the backpack/inventory contained fruits, seeds, fertilizer and tools, with quantity, unit price and total value. This is from a later/automated QQ Farm context, so treat it as a useful variant rather than guaranteed original Happy Farm behavior. ([GitHub][6])

---

# 8. Currency and economy

## 8.1 Gold coins

Gold coins were the standard currency. Players earned them by selling stored crops and collecting/selling animal products. Most normal goods could be purchased with gold coins. ([Wikipédia][3])

Uses:

```txt
buy seeds
buy animal feed
buy some animals
buy some decorations
buy fertilizer
expand land
```

## 8.2 Premium currency / credits

Colheita Feliz had green credits, obtainable through real-money deposit. Credits could buy exclusive seeds, flowers, animals and land expansion. ([Wikipédia][3])

For your private version, you probably do **not** need premium currency. But if you want to understand the original design, premium currency existed as a monetization layer.

## 8.3 VIP card

Colheita Feliz had a VIP card that allowed premium products and expired after one month. ([Wikipédia][3])

## 8.4 Monetization design

The broader social farm genre monetized through virtual goods such as decorations, seeds, fertilizer and animals. Wired described this as the core business model for FarmVille-like games. ([WIRED][2])

For your private project, you can ignore monetization but still model “rare items” as unlocks.

---

# 9. XP and leveling

## 9.1 XP sources

XP could be earned by:

```txt
planting seeds
planting/growing flowers
watering crops
removing pests
removing weeds
harvesting crops
feeding animals
buying decorations
helping friends
```

Colheita Feliz explicitly lists planting, watering, removing pests, harvesting, feeding animals and buying decorations as XP sources. ([Wikipédia][3])

## 9.2 Level gates

Seeds, flowers, animals, decorations, land and other features could be locked behind levels. Colheita Feliz says seeds needed a required level before purchase. ([Wikipédia][3])

## 9.3 Daily XP caps

Some guide snippets indicate that watering, weeding and pest-removal rewards had daily limits, with caps varying by level; one guide says after reaching the daily cap, these actions stopped giving XP/coins. ([4399 Notícias][7])

This is important for balance: without a cap, players could farm infinite XP by repeatedly helping friends.

---

# 10. Popularity / social prestige

Colheita Feliz had both **experience level** and **popularity level**. Popularity increased when the player received flowers from other players. ([Wikipédia][3])

Mechanically:

```txt
XP = progression through farming actions
Popularity = social/gift progression
```

Flowers existed partly as crops and partly as gifts. When a player harvested a flower, they could gift it to another player, raising that player’s popularity. ([Wikipédia][3])

---

# 11. Social mechanics

This is the most important part of Happy Farm’s design.

## 11.1 Friends / neighbors list

Players could invite or connect with friends from the social platform. More friends meant more farms to visit, more opportunities to help, and more opportunities to steal. The Association for Asian Studies and GameRes both emphasize that interaction with neighbors was central. ([Association for Asian Studies][1])

## 11.2 Visiting friends’ farms

Players could enter friends’ farms, inspect plots, and perform actions.

Possible friend farm states:

```txt
mature crops available to steal
dry crops available to water
weeds available to remove
bugs available to remove
plots available to sabotage
```

## 11.3 Helping friends

Helping actions included:

```txt
water crops
remove weeds
kill/remove bugs
possibly fertilize with special fertilizer
```

Helping friends rewarded the helper and protected the friend’s farm. Sources say helping could grant XP and sometimes coins. ([4399 Notícias][8])

## 11.4 Stealing crops

Players could steal or “help harvest” mature crops from neighbors if the owner did not collect them in time. This was the signature mechanic. ([China.org.cn][9])

Typical rules likely included:

```txt
only mature crops can be stolen
only part of the crop can be stolen
each crop/plot may have a steal limit
owner still keeps some harvest
thief gets stolen goods or money
event is logged
```

Exact percentages varied or are not clearly documented in the sources I found.

## 11.5 Sabotage

Players could place bugs or weeds on friends’ farms. This created a negative interaction and gave the owner or other friends a reason to return and clean up. Colheita Feliz and modern QQ Farm sources document damaging friends’ farms with pests/weeds. ([Wikipédia][3])

## 11.6 Revenge loop

The social loop was:

```txt
friend steals from you
you receive/log the event
you visit their farm
you steal back, help, or sabotage
```

Modern QQ Farm coverage describes “being stolen from and leaving revenge messages” as part of the remembered social behavior. ([Xhby][10])

## 11.7 Gifts

Players could send or receive gifts, especially flowers. Colheita Feliz had a gifts button showing flowers received and flowers available to send. ([Wikipédia][3])

## 11.8 Event log / assistant

Colheita Feliz had an assistant that showed recent farm events, including products bought/sold and people who helped or stole. ([Wikipédia][3])

For your project, this is a key feature to replicate emotionally:

```txt
Maria watered your strawberries.
João stole 2 tomatoes.
Ana removed bugs from your corn.
You sold 12 carrots.
```

---

# 12. Dog / guard mechanics

Players could buy dogs to guard the farm. A dog could catch a thief and cause them to lose money, which went to the farm owner. The Association for Asian Studies describes this mechanic directly for Happy Farm. ([Association for Asian Studies][1])

Other sources mention dogs catching bad actors who stole or caused trouble. ([GameRes][4])

Likely dog-related mechanics:

```txt
buy dog
place dog/dog house
dog protects against stealing/sabotage
dog has chance to catch thief
caught thief pays fine
fine goes to owner
dog may need food to function
```

One QQ Farm guide snippet says dogs prevent theft/bugs/weeds, but if the dog bowl has no dog food, the dog will not work. ([games.sina.com.cn][11])

---

# 13. Animal mechanics

Colheita Feliz had animals in an enclosure and dog house/dogs separately. Animals included, depending on version:

```txt
pigeon
dog
cow
sheep
bee
donkey
chicken
pig
peacock
rabbit
horse
reindeer
ostrich
goat
```

The documentation divides animals into two categories: animals that **produce items** and animals that **grow and are later sold**. ([Wikipédia][3])

## 13.1 Productive animals

Examples:

```txt
cow -> milk
chicken -> eggs
bee -> honey
sheep -> wool
```

Mechanics:

```txt
buy animal
feed animal
wait real time
collect product
sell product for coins
animal has productivity timer
animal may expire after a number of days
```

## 13.2 Growing animals

Some animals grew over time and could be sold when mature.

Mechanics:

```txt
buy young animal
feed regularly
animal grows through stages
sell mature animal for coins
animal may expire
```

## 13.3 Animal bars

Animals had hover/status bars:

```txt
food bar
growth bar for growing animals
productivity bar for producing animals
expiration/lifespan indicator
```

If not fed, animals would not produce or grow. ([Wikipédia][3])

## 13.4 Animal feed

Animal food was purchased with coins. In Colheita Feliz, food for producing animals lasted eight hours, while food for growing animals lasted twelve hours. Premium feeds could increase productivity. ([Wikipédia][3])

---

# 14. Flower mechanics

Flowers acted like crops but had a social purpose.

Mechanics:

```txt
buy flower seed
plant flower
grow through same stages as crops
harvest flower
send flower as gift
recipient gains popularity
```

Colheita Feliz says there were 13 flowers, many bought with credits, and that gifting harvested flowers increased the recipient’s popularity. ([Wikipédia][3])

---

# 15. Decoration mechanics

Decorations were used to beautify the farm and could also give XP when purchased. Colheita Feliz says decorations could be bought with either currency, some required premium credits, and decorations expired after one month. ([Wikipédia][3])

Possible decoration model:

```ts
type Decoration = {
  id: string;
  name: string;
  price: number;
  currency: "coins" | "credits";
  xpOnPurchase: number;
  expiresAt?: string;
  position: { x: number; y: number };
};
```

For your private version, I would remove expiration. Expiring decorations were probably monetization-driven, not fun for a private nostalgia project.

---

# 16. Daily reward mechanics

Colheita Feliz had a daily reward that could give a seed, flower or fertilizer. ([Wikipédia][3])

Suggested private implementation:

```txt
Day 1: coins
Day 2: seed
Day 3: fertilizer
Day 4: decoration
Day 5: rare seed
```

---

# 17. UI/tool mechanics

Colheita Feliz had tool buttons for specific actions:

```txt
harvest
remove pests
use pesticide
water
view purchased items
hoe/remove dead plants or crop remains
move/pan screen
```

On other players’ farms, extra buttons allowed placing pests or weeds to damage the farm. ([Wikipédia][3])

Top UI areas included:

```txt
coins
premium credits
XP level
popularity level
assistant/event log
gifts
shop
deposit/storage
decoration
my farm
friends’ farms
```

These UI areas are described in Colheita Feliz documentation and playing guides. ([Wikipédia][3])

---

# 18. Timing, urgency and retention mechanics

## 18.1 Real-world scheduling

The game created urgency by making players return at specific real-world times. Some players set alarms or returned during work to harvest or steal crops. ([Association for Asian Studies][1])

## 18.2 Long timers encourage social play

Happy Farm’s longer crop timers reduced what players could do on their own farm and pushed them toward visiting neighbors, pulling weeds, watering and stealing. ([Association for Asian Studies][1])

## 18.3 “Click love”

The genre relied on satisfying repeated clicks: click crop, get fruit; click pest, clean it; click friend farm, steal; click warehouse, sell. Wired describes this immediate click-to-reward feel as central to the genre’s appeal. ([WIRED][2])

---

# 19. Strategy/meta mechanics

Players optimized around:

```txt
profit per hour
XP per hour
crop maturity schedule
risk of being stolen from
number of active friends
daily helper action limits
fertilizer efficiency
land unlock order
premium vs free items
```

Modern QQ classic farm discussions still analyze crop choice by estimated sale price and harvest cycle; one article gives the example that wheat’s sale value and shorter cycle could make it more efficient over a 12-hour period. ([The Paper][5])

The same principle applies to your game:

```ts
profitPerHour = (sellPrice - seedPrice) / growHours;
xpPerHour = xpReward / growHours;
```

---

# 20. Anti-abuse / limits

Documented or strongly implied limits include:

```txt
daily XP cap for helping actions
daily action limits for watering/weeding/pest removal/stealing/sabotage
dog protection against theft
friend blacklists/whitelists in later tooling
steal limits per crop/plot
```

A QQ Farm automation project documents action categories and daily reset behavior for friend interactions such as helping, stealing, placing weeds and placing bugs. This source is about a bot for a later QQ Farm ecosystem, not original 2008 Happy Farm, but it reveals the underlying action categories and server-side limits. ([GitHub][6])

---

# 21. Later / variant mechanics

These are not necessarily part of the original Happy Farm, but appeared in later QQ Farm, clones, or modern revivals.

## 21.1 Crop mutation

The 2026 QQ classic farm revival reportedly added crop mutation, with over 100 crops and mutation-based planting surprises. ([Xhby][10])

## 21.2 Fish pond

Modern “classic farm” variants added fish ponds, unlocked at higher levels, including fishing and a friend-interaction equivalent of stealing/fish bombing. ([The Paper][5])

## 21.3 Task systems

Later versions often had:

```txt
main quests
daily tasks
task rewards
free gifts
fertilizer packs
daily sign-in rewards
```

Some of these appear in modern QQ Farm strategy snippets and bot documentation. ([Douyin][12])

## 21.4 Social status integration

The 2026 QQ revival integrated with QQ social features such as “poke” notifications, visible “farming” status, and friend recommendations. ([Xhby][10])

---

# 22. Complete mechanics checklist

Use this as your master list for design.

## Farm

```txt
[ ] Farm background
[ ] Fixed soil grid
[ ] Locked plots
[ ] Unlockable plots
[ ] Farm expansion
[ ] House
[ ] Dog house
[ ] Animal enclosure
[ ] Decoration layer
[ ] Pan/move tool
```

## Crops

```txt
[ ] Seed shop
[ ] Crop level requirements
[ ] Seed price
[ ] Sell price
[ ] XP reward
[ ] Growth duration
[ ] Real-time growth
[ ] Five growth stages
[ ] Multi-season crops
[ ] Mature state
[ ] Harvest action
[ ] Wither/death state
[ ] Remove dead crop with hoe
[ ] Health bar
[ ] Time-to-next-stage bar
[ ] Season/progress bar
```

## Crop care

```txt
[ ] Dryness/drought
[ ] Watering
[ ] Weeds
[ ] Remove weeds
[ ] Bugs/pests
[ ] Remove bugs/pests
[ ] Health loss from problems
[ ] Yield/progress penalty from poor care
[ ] Fertilizer
[ ] Multiple fertilizer strengths
[ ] Friend/love fertilizer
```

## Inventory/economy

```txt
[ ] Warehouse/deposit
[ ] Crop inventory
[ ] Animal product inventory
[ ] Sell one item
[ ] Sell all items
[ ] Unit price
[ ] Total value
[ ] Optional market fluctuation
[ ] Gold coins
[ ] Premium credits
[ ] VIP card
```

## Progression

```txt
[ ] XP
[ ] Level
[ ] Level thresholds
[ ] Crop unlocks
[ ] Flower unlocks
[ ] Animal unlocks
[ ] Decoration unlocks
[ ] Land unlocks
[ ] Daily XP/action caps
```

## Popularity/gifts

```txt
[ ] Popularity level
[ ] Flowers as gift items
[ ] Send flower to friend
[ ] Receive flower
[ ] Popularity increase from received flowers
[ ] Gift inbox
```

## Social

```txt
[ ] Friends list
[ ] Visit friend farm
[ ] Help friend water
[ ] Help friend remove weeds
[ ] Help friend remove bugs
[ ] Steal mature crop
[ ] Steal limit per crop/plot
[ ] Sabotage with weeds
[ ] Sabotage with bugs
[ ] Event log
[ ] Revenge loop
[ ] Notifications
[ ] Friend rewards
```

## Dog/security

```txt
[ ] Buy dog
[ ] Dog house
[ ] Feed dog
[ ] Dog catches thief
[ ] Thief loses coins
[ ] Owner receives fine
[ ] Dog inactive if unfed
```

## Animals

```txt
[ ] Buy animal
[ ] Productive animals
[ ] Growing animals
[ ] Feed animal
[ ] Animal food duration
[ ] Animal growth stages
[ ] Animal product timer
[ ] Animal expiration/lifespan
[ ] Sell animal product
[ ] Sell mature animal
[ ] Premium feed
```

## Decorations

```txt
[ ] Buy decoration
[ ] Place decoration
[ ] Move decoration
[ ] Store purchased decorations
[ ] XP from purchase
[ ] Optional expiration
[ ] Coin decorations
[ ] Premium decorations
```

## Daily/retention

```txt
[ ] Daily reward
[ ] Free seed reward
[ ] Free flower reward
[ ] Free fertilizer reward
[ ] Calendar events
[ ] Holiday sales
[ ] Limited-time items
[ ] Mature crop notifications
```

## UI tools

```txt
[ ] Harvest tool
[ ] Water tool
[ ] Remove weed tool
[ ] Remove pest tool
[ ] Pesticide tool
[ ] Hoe tool
[ ] Move/pan tool
[ ] Shop button
[ ] Warehouse button
[ ] Decorations button
[ ] My farm button
[ ] Friends farms button
[ ] Assistant/event log button
[ ] Gifts button
```

---

# 23. What I would prioritize for your recreation

For the version for your wife, I would not build all mechanics at once. The “real” emotional core is:

```txt
1. Plant
2. Wait real time
3. Harvest
4. Sell
5. Level up
6. Decorate
7. Visit family/friends
8. Help or steal a little
9. See event log
10. Receive daily reward
```

The most important mechanics to reproduce first are:

```txt
real-time crop growth
warehouse/selling
XP/levels
crop health
watering/weeds/bugs
friend visits
stealing
event log
daily reward
decorations
animals
```

Premium currency, VIP cards, expiring decorations and monetization can be ignored unless you want to study the original economy. For a private game, they add complexity without much emotional value.

[1]: https://www.asianstudies.org/publications/eaa/archives/chinas-happy-farm-and-the-impact-of-social-gaming/ "China's Happy Farm and the Impact of Social Gaming - Association for Asian Studies"
[2]: https://www.wired.com/2010/05/farm-wars "Farm Wars: How Facebook Games Harvest Big Bucks | WIRED"
[3]: https://pt.wikipedia.org/wiki/Colheita_Feliz "Colheita Feliz – Wikipédia, a enciclopédia livre"
[4]: https://www.gameres.com/131539.html "开心农场为什么这么火？ - GameRes游资网"
[5]: https://m.thepaper.cn/newsDetail_forward_30150856 "“偷菜热”卷土重来：00后上头，催生氪金暴利生意"
[6]: https://github.com/chuankkk/qq-farm-bot "GitHub - chuankkk/qq-farm-bot: QQ 农场多账号挂机 + Web 面板 | Node.js + Vue3 + Docker · GitHub"
[7]: https://news.4399.com/kaixinnongchang/youxigonglue/200911-23-48576.html?utm_source=chatgpt.com "开心农场——常见问题的解决方法（适合各级农场主参照）"
[8]: https://news.4399.com/kaixinnongchang/youxigonglue/200911-23-48564.html?utm_source=chatgpt.com "《开心农场》新手指南- 游戏攻略"
[9]: https://www.china.org.cn/china/2009-12/10/content_19044478.htm?utm_source=chatgpt.com "Crop-stealing on Happy Farm: an addiction to affiliation"
[10]: https://www.xhby.net/content/s69855fbbe4b0303f7f92463b.html "爷青回！QQ农场今日回归，偷菜快乐重启"
[11]: https://games.sina.com.cn/x/n/2010-04-15/1109391485.shtml?utm_source=chatgpt.com "QQ农场偷菜技巧:成为偷菜高手全攻略"
[12]: https://www.douyin.com/shipin/7637716653371033640?utm_source=chatgpt.com "微信qq经典农场怎么生存二维码"
