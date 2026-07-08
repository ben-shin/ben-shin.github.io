const STORAGE_KEY = "social-game-hub-v1";

const GAMES = [
  {
    id: "would-you-rather",
    title: "Would You Rather",
    icon: "⚖️",
    category: "choice",
    color: "#8cf2d0",
    tagline: "Two options. One questionable decision.",
    rules: "The active player picks one option and defends it. The group may interrogate the logic for up to one minute.",
    instruction: "Pick one, then justify it.",
    prompts: [
      ["warm", "Would you rather always be five minutes early or always arrive exactly on time but mildly stressed?"],
      ["warm", "Would you rather have perfect memory for names or perfect memory for directions?"],
      ["warm", "Would you rather only eat breakfast foods for dinner or dinner foods for breakfast?"],
      ["warm", "Would you rather be able to pause time for ten seconds once a day or rewind your last sentence once a day?"],
      ["warm", "Would you rather have a personal theme song or dramatic lighting whenever you enter a room?"],
      ["warm", "Would you rather never lose your keys again or never forget why you walked into a room?"],
      ["warm", "Would you rather have unlimited coffee or unlimited snacks, but only during work hours?"],
      ["medium", "Would you rather know exactly what people think of you for one day or never find out at all?"],
      ["medium", "Would you rather be respected by everyone but rarely invited out, or liked by everyone but rarely taken seriously?"],
      ["medium", "Would you rather be amazing at small talk or amazing at ending conversations smoothly?"],
      ["medium", "Would you rather have your search history shown to your friends or your group chat drafts shown to your family?"],
      ["medium", "Would you rather be able to detect lies or always know when someone is bored?"],
      ["medium", "Would you rather give up maps or give up online reviews forever?"],
      ["medium", "Would you rather be the funniest person in the group or the most trusted?"],
      ["medium", "Would you rather have one great story everyone already knows or ten mediocre stories nobody has heard?"],
      ["spicy", "Would you rather have everyone know your first impression of them or everyone know your current opinion of them?"],
      ["spicy", "Would you rather be unable to hide jealousy or unable to hide disappointment?"],
      ["spicy", "Would you rather your exes review you publicly or your friends review your dating choices publicly?"],
      ["spicy", "Would you rather always be slightly overconfident or always slightly undersell yourself?"],
      ["spicy", "Would you rather be remembered as charming but unreliable or reliable but forgettable?"],
      ["spicy", "Would you rather everyone here see your notes app or your camera roll from the last week?"],
      ["spicy", "Would you rather never be embarrassed again or never embarrass someone else again?"],
      ["chaos", "Would you rather fight one horse-sized pigeon or fifty pigeon-sized horses in a public square?"],
      ["chaos", "Would you rather every meal be judged by Gordon Ramsay or every outfit be judged by a sarcastic toddler?"],
      ["chaos", "Would you rather have to narrate your own life out loud or hear boss music whenever you make a bad decision?"],
      ["chaos", "Would you rather your inner monologue have subtitles or your dreams be reviewed on Letterboxd?"],
      ["chaos", "Would you rather all elevators play your most awkward voice note or all automatic doors refuse to open until you compliment them?"],
      ["chaos", "Would you rather be haunted by a ghost that only gives bad career advice or a ghost that rearranges your furniture by two inches every night?"]
    ]
  },
  {
    id: "most-likely",
    title: "Most Likely To",
    icon: "👀",
    category: "group",
    color: "#ffd166",
    tagline: "Point, accuse, defend, repeat.",
    rules: "Read the prompt. Everyone points to the person most likely to fit it. The winner must explain or deny the charge.",
    instruction: "Everyone points at once.",
    prompts: [
      ["warm", "Most likely to become weirdly good at a hobby nobody expected."],
      ["warm", "Most likely to accidentally start a group tradition."],
      ["warm", "Most likely to remember a tiny detail from three years ago."],
      ["warm", "Most likely to make friends with a stranger in a queue."],
      ["warm", "Most likely to send the perfect meme at the perfect time."],
      ["warm", "Most likely to survive a camping trip through pure optimism."],
      ["warm", "Most likely to make a spreadsheet for a holiday."],
      ["medium", "Most likely to say they are five minutes away when they have not left yet."],
      ["medium", "Most likely to become a niche internet micro-celebrity."],
      ["medium", "Most likely to turn a minor inconvenience into a full investigative report."],
      ["medium", "Most likely to get banned from a pub quiz for arguing with the host."],
      ["medium", "Most likely to talk themselves into buying something unnecessary."],
      ["medium", "Most likely to befriend the villain in a movie."],
      ["medium", "Most likely to overprepare and still forget the one important thing."],
      ["medium", "Most likely to have a secret ranking of everyone’s cooking."],
      ["spicy", "Most likely to be the reason a group chat gets muted."],
      ["spicy", "Most likely to flirt by being mildly annoying."],
      ["spicy", "Most likely to win an argument by exhausting everyone else."],
      ["spicy", "Most likely to have a surprisingly chaotic dating history."],
      ["spicy", "Most likely to say something brutal and technically correct."],
      ["spicy", "Most likely to forgive someone but keep the receipts."],
      ["spicy", "Most likely to be trusted with secrets but terrible with plans."],
      ["chaos", "Most likely to join a cult by accident and improve their branding."],
      ["chaos", "Most likely to survive a zombie apocalypse by becoming the zombies’ social coordinator."],
      ["chaos", "Most likely to start a business selling something nobody asked for and somehow succeed."],
      ["chaos", "Most likely to be exposed as three raccoons in a coat."],
      ["chaos", "Most likely to negotiate with aliens using vibes alone."],
      ["chaos", "Most likely to get adopted by a rich elderly person after one conversation."]
    ]
  },
  {
    id: "debate-roulette",
    title: "Debate Roulette",
    icon: "🎙️",
    category: "argument",
    color: "#a78bfa",
    tagline: "Low-stakes arguments with high-stakes confidence.",
    rules: "One player argues for the prompt. Another argues against. The group votes on who made the more convincing case, not who was right.",
    instruction: "Argue the assigned side for 60 seconds.",
    prompts: [
      ["warm", "Breakfast is the most overrated meal."],
      ["warm", "A bad movie with friends is better than a good movie alone."],
      ["warm", "Public transport etiquette should be taught in schools."],
      ["warm", "Every friend group needs a designated planner."],
      ["warm", "Board games reveal more about people than personality tests."],
      ["warm", "The best holidays have loose plans, not detailed itineraries."],
      ["medium", "Being interesting is more useful than being impressive."],
      ["medium", "Most people are worse at texting than they think."],
      ["medium", "A little delusion is necessary for success."],
      ["medium", "You should judge people by how they behave when plans change."],
      ["medium", "Taste is mostly just confidence with vocabulary."],
      ["medium", "Everyone should work one service job before turning 25."],
      ["medium", "The aux cable should go to the person with the narrowest music taste."],
      ["medium", "Convenience has made everyone slightly less competent."],
      ["spicy", "Loyalty is sometimes just fear of change."],
      ["spicy", "Chemistry is less important than timing."],
      ["spicy", "Being too self-aware can make you boring."],
      ["spicy", "You can tell a lot about someone from how they handle rejection."],
      ["spicy", "Most people do not want honesty; they want flattering precision."],
      ["spicy", "Your standards are only real if they cost you something."],
      ["spicy", "The friend who gives the harshest advice is not always the wisest."],
      ["chaos", "Soup is a beverage."],
      ["chaos", "Chairs are just tables for people."],
      ["chaos", "Every wedding should include a formal objection round."],
      ["chaos", "If a dog wears trousers, it should wear four-legged trousers."],
      ["chaos", "Restaurants should have a button for ‘bring the bill and no more eye contact.’"],
      ["chaos", "The moon is suspiciously well-lit and we should discuss it."],
      ["chaos", "All group chats need a constitution."]
    ]
  },
  {
    id: "confession-roulette",
    title: "Confession Roulette",
    icon: "🗝️",
    category: "reveal",
    color: "#ff7a90",
    tagline: "Small truths, big reactions.",
    rules: "The active player answers honestly, vaguely, or with a story. They may pass once per round without penalty.",
    instruction: "Answer, dodge elegantly, or tell the story.",
    prompts: [
      ["warm", "What is a small thing that instantly improves your mood?"],
      ["warm", "What is a harmless habit you refuse to fix?"],
      ["warm", "What is something you are weirdly proud of?"],
      ["warm", "What is one opinion you changed your mind about?"],
      ["warm", "What is a compliment you still remember?"],
      ["warm", "What is the most unnecessary thing you know a lot about?"],
      ["warm", "What is something you liked before it was cool?"],
      ["medium", "What is a social situation you are secretly bad at?"],
      ["medium", "What is something you pretend to understand but do not fully understand?"],
      ["medium", "What is a tiny lie you tell more often than you should?"],
      ["medium", "What is a decision you overthought for no reason?"],
      ["medium", "What is something you want to be seen as better at?"],
      ["medium", "What is your most specific irrational annoyance?"],
      ["medium", "What is something you judge people for even though you know you should not?"],
      ["spicy", "What is a red flag you have ignored because the person was fun?"],
      ["spicy", "What is a time you were the problem but only realized later?"],
      ["spicy", "What is a compliment you wanted from someone but never got?"],
      ["spicy", "What is something you act chill about but are not chill about?"],
      ["spicy", "What is an insecurity you hide with humor?"],
      ["spicy", "What is the worst reason you kept talking to someone?"],
      ["spicy", "What is a lesson you learned embarrassingly late?"],
      ["chaos", "What is the dumbest hill you would still die on?"],
      ["chaos", "What is a completely irrational rule your future household would have?"],
      ["chaos", "What would your villain origin story be if it had to start with a minor inconvenience?"],
      ["chaos", "What is the most cursed thing you would confidently cook for the group?"],
      ["chaos", "What is your most suspiciously specific survival plan?"],
      ["chaos", "What is something you would do if embarrassment was illegal for one day?"]
    ]
  },
  {
    id: "bad-pitch-night",
    title: "Bad Pitch Night",
    icon: "📈",
    category: "improv",
    color: "#6ee7ff",
    tagline: "Sell terrible ideas like a founder with funding.",
    rules: "The active player has one minute to pitch the idea as if it deserves investment. The group asks one investor question, then votes.",
    instruction: "Pitch it like it is worth £10 million.",
    prompts: [
      ["warm", "A subscription service for socks that intentionally do not match."],
      ["warm", "A gym where every machine gives emotional encouragement."],
      ["warm", "An app that tells you whether your leftovers are morally still edible."],
      ["warm", "A coffee shop that only serves drinks at suspiciously specific temperatures."],
      ["warm", "A dating app for people who hate making profiles."],
      ["warm", "A smart fridge that compliments your grocery choices."],
      ["medium", "A coworking space for people who only want to look busy."],
      ["medium", "A travel agency that books holidays based only on your enemies’ jealousy."],
      ["medium", "A meal kit that ships ingredients and a passive-aggressive note from a chef."],
      ["medium", "An alarm clock that calls your friends if you snooze twice."],
      ["medium", "A personal trainer that only uses reverse psychology."],
      ["medium", "A browser extension that replaces corporate jargon with medieval insults."],
      ["medium", "A wearable that vibrates when you are about to overshare."],
      ["spicy", "A service that writes breakup texts in the style of legal notices."],
      ["spicy", "An app that rates your friends’ excuses for cancelling plans."],
      ["spicy", "A restaurant where the waiter chooses your order based on your aura."],
      ["spicy", "A dating app where your friends control your profile for 24 hours."],
      ["spicy", "A social network where every post expires unless someone argues with it."],
      ["spicy", "A productivity app that locks your phone until you apologize to your to-do list."],
      ["chaos", "Uber, but for being carried dramatically from room to room."],
      ["chaos", "A mattress company that sells beds optimized for revenge naps."],
      ["chaos", "A haunted smart speaker that gives motivational speeches at 3 a.m."],
      ["chaos", "A theme park where every ride is based on a mildly awkward social interaction."],
      ["chaos", "A luxury brand that only sells empty boxes and confidence."],
      ["chaos", "A pet translation app that always makes the animal sound disappointed."],
      ["chaos", "A startup that monetizes the silence after someone says something weird."]
    ]
  },
  {
    id: "red-green-flag",
    title: "Red Flag / Green Flag",
    icon: "🚩",
    category: "judgment",
    color: "#f97316",
    tagline: "The group decides whether it is cute, cursed, or context-dependent.",
    rules: "Read the behavior. Everyone votes red flag, green flag, beige flag, or depends. The active player must defend the minority position.",
    instruction: "Vote, then defend the least popular answer.",
    prompts: [
      ["warm", "They know the birthdays of all their close friends."],
      ["warm", "They bring a book to every trip just in case."],
      ["warm", "They have a very specific preferred seat in every room."],
      ["warm", "They remember everyone’s coffee order."],
      ["warm", "They say hello to dogs before people."],
      ["warm", "They make playlists for tiny life events."],
      ["medium", "They are always the first person to leave a party."],
      ["medium", "They claim they are ‘bad at texting’ but are always online."],
      ["medium", "They have strong opinions about fonts."],
      ["medium", "They never use recipes but always say cooking is easy."],
      ["medium", "They keep every ticket, receipt, and wristband as a memory."],
      ["medium", "They ask follow-up questions so intensely it feels like an interview."],
      ["medium", "They can apologize well but rarely change behavior."],
      ["spicy", "They say all their exes were crazy."],
      ["spicy", "They are charming to strangers but impatient with friends."],
      ["spicy", "They are proud of never needing anyone."],
      ["spicy", "They treat being busy as a personality."],
      ["spicy", "They only become affectionate when they think they might lose you."],
      ["spicy", "They are brutally honest, but only about other people."],
      ["spicy", "They make every apology include an explanation of their intentions."],
      ["chaos", "They own a sword but insist it is decorative."],
      ["chaos", "They have a ranking system for supermarket meal deals."],
      ["chaos", "They clap when the plane lands and make eye contact while doing it."],
      ["chaos", "They have named every plant in their house and assigned them personalities."],
      ["chaos", "They describe themselves as an empath before giving the worst advice imaginable."],
      ["chaos", "They say ‘I am very normal about this’ before explaining a conspiracy board."]
    ]
  },
  {
    id: "explain-lying",
    title: "Explain Like You’re Lying",
    icon: "🧪",
    category: "improv",
    color: "#34d399",
    tagline: "Confident nonsense. Educationally illegal.",
    rules: "The active player explains the topic with total confidence, but the explanation must be mostly false. Bonus point for sounding plausible.",
    instruction: "Explain with confidence. Accuracy is optional and discouraged.",
    prompts: [
      ["warm", "Explain how Wi‑Fi works."],
      ["warm", "Explain why cats knock things off tables."],
      ["warm", "Explain why we dream."],
      ["warm", "Explain how elevators decide where to go."],
      ["warm", "Explain why toast lands butter-side down."],
      ["warm", "Explain how birds know where to migrate."],
      ["medium", "Explain the stock market."],
      ["medium", "Explain how airport security machines work."],
      ["medium", "Explain what happens inside a dishwasher."],
      ["medium", "Explain why people get déjà vu."],
      ["medium", "Explain how protein folding works."],
      ["medium", "Explain why time feels faster as you get older."],
      ["medium", "Explain how recommendation algorithms know too much."],
      ["spicy", "Explain why your friend’s last bad decision was actually scientifically inevitable."],
      ["spicy", "Explain how flirting works using only physics terminology."],
      ["spicy", "Explain why someone has not texted back yet."],
      ["spicy", "Explain why everyone secretly needs drama."],
      ["spicy", "Explain why confidence can replace competence in 37% of situations."],
      ["spicy", "Explain why your worst habit is adaptive evolution."],
      ["chaos", "Explain why pigeons are government interns."],
      ["chaos", "Explain why socks disappear in the laundry."],
      ["chaos", "Explain why the moon follows cars."],
      ["chaos", "Explain how chairs domesticated humans."],
      ["chaos", "Explain why every group has one person who attracts weird incidents."],
      ["chaos", "Explain why soup is the original cloud storage."],
      ["chaos", "Explain why ghosts would be terrible landlords."]
    ]
  },
  {
    id: "defend-worst-opinion",
    title: "Defend The Worst Opinion",
    icon: "🛡️",
    category: "argument",
    color: "#fb7185",
    tagline: "Take the cursed side and make it sound reasonable.",
    rules: "The active player must defend the prompt sincerely for 45 seconds. The group awards points for rhetorical skill, not moral correctness.",
    instruction: "Defend it with a straight face.",
    prompts: [
      ["warm", "Emails should have read receipts by default."],
      ["warm", "Every meeting should start with an icebreaker."],
      ["warm", "Restaurants should ban menu substitutions."],
      ["warm", "The middle seat on a plane has hidden advantages."],
      ["warm", "Spoilers make movies better."],
      ["warm", "Group projects are good, actually."],
      ["medium", "Everyone should have to retake a driving test every five years."],
      ["medium", "Birthday weeks are reasonable."],
      ["medium", "Voice notes are superior to texts."],
      ["medium", "People should be allowed to rate parties publicly."],
      ["medium", "The person who plans the holiday should control the itinerary completely."],
      ["medium", "All restaurants should have a maximum conversation volume."],
      ["spicy", "Sometimes ghosting is efficient project management."],
      ["spicy", "Jealousy is just market research."],
      ["spicy", "Being mysterious is mostly poor communication with better lighting."],
      ["spicy", "Everyone needs one harmless enemy to stay motivated."],
      ["spicy", "You should judge people by their Notes app titles."],
      ["spicy", "Petty revenge builds community."],
      ["chaos", "All houses should have one room nobody explains to guests."],
      ["chaos", "The loser of any argument should have to wear a tiny cape."],
      ["chaos", "Every office should have a workplace mascot chosen by combat."],
      ["chaos", "People should introduce themselves with a warning label."],
      ["chaos", "The group chat should elect a monarch every month."],
      ["chaos", "Anyone who says ‘quick question’ should be legally timed."],
      ["chaos", "Forks are too specialized and should be replaced by tiny tongs."]
    ]
  },
  {
    id: "ranking-room",
    title: "The Ranking Room",
    icon: "🏆",
    category: "group",
    color: "#facc15",
    tagline: "Rank absurd categories and expose the group’s values.",
    rules: "The active player gives their top three. The group can challenge one placement. Award points for the most convincing ranking.",
    instruction: "Give a top three and defend the order.",
    prompts: [
      ["warm", "Rank the top three best ways to spend a rainy day."],
      ["warm", "Rank the top three superior potato forms."],
      ["warm", "Rank the top three low-effort comfort meals."],
      ["warm", "Rank the top three things that make a home feel like home."],
      ["warm", "Rank the top three acceptable reasons to cancel plans."],
      ["warm", "Rank the top three animals that seem like they know secrets."],
      ["medium", "Rank the top three worst places to run into someone you know."],
      ["medium", "Rank the top three green flags in a friend."],
      ["medium", "Rank the top three signs someone is about to make a bad decision."],
      ["medium", "Rank the top three social skills that are underrated."],
      ["medium", "Rank the top three small luxuries that improve life disproportionately."],
      ["medium", "Rank the top three most dangerous sentences in a group chat."],
      ["spicy", "Rank the top three most forgivable red flags."],
      ["spicy", "Rank the top three reasons people stay in situations too long."],
      ["spicy", "Rank the top three personality traits that are attractive but risky."],
      ["spicy", "Rank the top three ways people reveal insecurity."],
      ["spicy", "Rank the top three compliments that would actually work on you."],
      ["chaos", "Rank the top three animals that would run the best restaurant."],
      ["chaos", "Rank the top three objects in this room as potential weapons in a fantasy quest."],
      ["chaos", "Rank the top three jobs a ghost would be surprisingly good at."],
      ["chaos", "Rank the top three foods that would make the worst perfume."],
      ["chaos", "Rank the top three crimes a duck could plausibly commit."],
      ["chaos", "Rank the top three household appliances by emotional intelligence."]
    ]
  },
  {
    id: "story-stitch",
    title: "Story Stitch",
    icon: "🧵",
    category: "improv",
    color: "#c084fc",
    tagline: "Build a story one ridiculous constraint at a time.",
    rules: "Each player adds one sentence to the story while obeying the prompt. If they break the constraint, the group may assign a penalty point.",
    instruction: "Add one sentence to the story.",
    prompts: [
      ["warm", "Start a story with: ‘Nobody expected the pigeon to be invited.’"],
      ["warm", "Continue the story, but include a mysterious sandwich."],
      ["warm", "Continue the story, but make the next character overly polite."],
      ["warm", "Continue the story, but reveal that the room has a secret button."],
      ["warm", "Continue the story, but the sentence must include the word ‘umbrella.’"],
      ["medium", "Continue the story, but someone misunderstands the entire situation."],
      ["medium", "Continue the story, but make it sound like a documentary narration."],
      ["medium", "Continue the story, but introduce a betrayal over something trivial."],
      ["medium", "Continue the story, but the villain has a reasonable complaint."],
      ["medium", "Continue the story, but the sentence must end with ‘obviously.’"],
      ["medium", "Continue the story, but make the stakes suddenly much lower."],
      ["spicy", "Continue the story, but add romantic tension between two inappropriate objects."],
      ["spicy", "Continue the story, but someone admits they planned this all along."],
      ["spicy", "Continue the story, but make it passive-aggressive."],
      ["spicy", "Continue the story, but reveal the hero has a deeply petty motive."],
      ["spicy", "Continue the story, but someone sends a text to the wrong person."],
      ["chaos", "Continue the story, but aliens arrive and care only about soup."],
      ["chaos", "Continue the story, but the narrator becomes unreliable and offended."],
      ["chaos", "Continue the story, but the plot is now legally about a duck."],
      ["chaos", "Continue the story, but everyone discovers the floor is judging them."],
      ["chaos", "Continue the story, but add a prophecy that is extremely mundane."],
      ["chaos", "End the story in a way that makes the title ‘The Accountant’s Revenge.’"]
    ]
  },
  {
    id: "moral-microwave",
    title: "Moral Microwave",
    icon: "🔥",
    category: "judgment",
    color: "#f43f5e",
    tagline: "Tiny dilemmas, instant overthinking.",
    rules: "The active player answers what they would do. The group decides if the answer is noble, practical, cowardly, or unhinged.",
    instruction: "Say what you would actually do, not what sounds good.",
    prompts: [
      ["warm", "You find £20 on the floor of a busy cafe. No one seems to be looking for it. What do you do?"],
      ["warm", "A friend cooked something bad and asks for your honest opinion. What do you say?"],
      ["warm", "Someone cuts the queue but looks genuinely confused. Do you say something?"],
      ["warm", "You get undercharged at a small shop. Do you correct it?"],
      ["medium", "Your friend is about to send a risky text. Do you intervene?"],
      ["medium", "You know a secret that would explain someone’s behavior, but it is not yours to share. What do you do?"],
      ["medium", "A stranger has food in their teeth before an important meeting. Do you tell them?"],
      ["medium", "You are invited to two events on the same night. One sounds more fun, one friend needs you more. Where do you go?"],
      ["medium", "Your group is splitting the bill evenly, but one person ordered far more. Do you object?"],
      ["spicy", "You see a friend’s partner behaving suspiciously but not conclusively. Do you say something?"],
      ["spicy", "You overhear someone misrepresenting your work or achievement. Do you correct them publicly?"],
      ["spicy", "A friend asks for advice but clearly only wants validation. What do you do?"],
      ["spicy", "Someone apologizes well but has repeated the same behavior before. Do you accept it?"],
      ["spicy", "A friend is being embarrassing in public but having a great time. Do you stop them?"],
      ["chaos", "You can mildly inconvenience one enemy every day with no consequences. Do you use the power?"],
      ["chaos", "A wizard offers you perfect charisma but only when you are lying. Do you accept?"],
      ["chaos", "You can read one person’s mind for ten minutes, but they can read yours for ten minutes later. Who do you choose?"],
      ["chaos", "You can become famous for something you did not do, but nobody is harmed. Do you correct the record?"],
      ["chaos", "You can erase one awkward memory from everyone else, but you must keep it. Which memory goes?"]
    ]
  }
];

let state = {
  players: [],
  scores: {},
  currentPlayerIndex: 0,
  activeGameId: GAMES[0].id,
  intensity: "medium",
  timerSeconds: 60,
  scoring: "casual",
  seen: {},
  history: [],
  favorites: [],
  customPrompts: [],
  activeTab: "history",
  settings: {
    avoidRepeat: true,
    autoAdvance: true,
    sound: false,
    theme: "dark"
  },
  currentPrompt: null,
  currentFilter: "all"
};

let timerInterval = null;
let remainingSeconds = 0;

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const els = {
  totalPromptsCount: $("#totalPromptsCount"),
  sessionVibe: $("#sessionVibe"),
  themeBtn: $("#themeBtn"),
  openSettingsBtn: $("#openSettingsBtn"),
  settingsDialog: $("#settingsDialog"),
  quickStartBtn: $("#quickStartBtn"),
  randomGameBtn: $("#randomGameBtn"),
  clearSessionBtn: $("#clearSessionBtn"),
  playerInput: $("#playerInput"),
  addPlayerBtn: $("#addPlayerBtn"),
  playerChips: $("#playerChips"),
  intensitySelect: $("#intensitySelect"),
  timerSelect: $("#timerSelect"),
  scoringSelect: $("#scoringSelect"),
  categoryFilters: $("#categoryFilters"),
  gameGrid: $("#gameGrid"),
  activeCategory: $("#activeCategory"),
  playTitle: $("#playTitle"),
  promptCounter: $("#promptCounter"),
  promptCard: $("#promptCard"),
  turnPlayer: $("#turnPlayer"),
  promptIntensity: $("#promptIntensity"),
  promptText: $("#promptText"),
  promptInstruction: $("#promptInstruction"),
  timerDisplay: $("#timerDisplay"),
  drawBtn: $("#drawBtn"),
  skipBtn: $("#skipBtn"),
  favoriteBtn: $("#favoriteBtn"),
  resetDeckBtn: $("#resetDeckBtn"),
  gameRules: $("#gameRules"),
  scoreboard: $("#scoreboard"),
  resetScoresBtn: $("#resetScoresBtn"),
  customGameSelect: $("#customGameSelect"),
  customIntensitySelect: $("#customIntensitySelect"),
  customPromptText: $("#customPromptText"),
  addCustomPromptBtn: $("#addCustomPromptBtn"),
  exportBtn: $("#exportBtn"),
  copySummaryBtn: $("#copySummaryBtn"),
  sessionList: $("#sessionList"),
  avoidRepeatToggle: $("#avoidRepeatToggle"),
  autoAdvanceToggle: $("#autoAdvanceToggle"),
  soundToggle: $("#soundToggle"),
  wipeStorageBtn: $("#wipeStorageBtn"),
  toast: $("#toast")
};

function flattenPrompts(game) {
  const builtIns = game.prompts.map((entry, idx) => ({
    id: `${game.id}-built-${idx}`,
    gameId: game.id,
    intensity: entry[0],
    text: entry[1],
    custom: false
  }));
  const custom = state.customPrompts.filter(p => p.gameId === game.id);
  return [...builtIns, ...custom];
}

function getGame(id = state.activeGameId) {
  return GAMES.find(game => game.id === id) || GAMES[0];
}

function getAvailablePrompts(game = getGame()) {
  const all = flattenPrompts(game).filter(prompt => state.intensity === "all" || prompt.intensity === state.intensity);
  if (!state.settings.avoidRepeat) return all;
  const seenIds = new Set(state.seen[game.id] || []);
  const unseen = all.filter(prompt => !seenIds.has(prompt.id));
  return unseen.length ? unseen : all;
}

function totalPromptCount() {
  return GAMES.reduce((sum, game) => sum + game.prompts.length, 0) + state.customPrompts.length;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state = {
      ...state,
      ...saved,
      settings: { ...state.settings, ...(saved.settings || {}) }
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(els.toast._timeout);
  els.toast._timeout = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function tinyBeep() {
  if (!state.settings.sound) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 440;
    gain.gain.value = 0.025;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {}
}

function renderTheme() {
  document.documentElement.classList.toggle("light", state.settings.theme === "light");
  els.themeBtn.textContent = state.settings.theme === "light" ? "Dark mode" : "Light mode";
}

function renderPlayers() {
  els.playerChips.innerHTML = "";
  if (!state.players.length) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "No players yet — pass-and-play still works";
    els.playerChips.appendChild(chip);
  } else {
    state.players.forEach((name, idx) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<span>${idx === state.currentPlayerIndex ? "▶ " : ""}${escapeHtml(name)}</span><button aria-label="Remove ${escapeHtml(name)}" data-remove-player="${idx}">×</button>`;
      els.playerChips.appendChild(chip);
    });
  }
  renderScoreboard();
  updateTurnPlayer();
}

function renderScoreboard() {
  els.scoreboard.innerHTML = "";
  if (!state.players.length) {
    els.scoreboard.innerHTML = `<p class="muted">Add players to track points.</p>`;
    return;
  }
  state.players.forEach(name => {
    if (state.scores[name] === undefined) state.scores[name] = 0;
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `<span class="score-name">${escapeHtml(name)}</span><span class="score-value">${state.scores[name]}</span><button data-score-name="${escapeAttr(name)}" data-score-delta="1">+</button>`;
    els.scoreboard.appendChild(row);
  });
}

function renderCategoryFilters() {
  const categories = ["all", ...new Set(GAMES.map(game => game.category))];
  els.categoryFilters.innerHTML = "";
  categories.forEach(category => {
    const btn = document.createElement("button");
    btn.className = `filter-pill ${state.currentFilter === category ? "active" : ""}`;
    btn.type = "button";
    btn.dataset.categoryFilter = category;
    btn.textContent = category === "all" ? "All" : titleCase(category);
    els.categoryFilters.appendChild(btn);
  });
}

function renderGameGrid() {
  els.gameGrid.innerHTML = "";
  GAMES.filter(game => state.currentFilter === "all" || game.category === state.currentFilter).forEach(game => {
    const count = flattenPrompts(game).length;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `game-card ${game.id === state.activeGameId ? "active" : ""}`;
    card.dataset.gameId = game.id;
    card.style.setProperty("--game-color", game.color);
    card.innerHTML = `
      <span class="game-icon">${game.icon}</span>
      <h3>${escapeHtml(game.title)}</h3>
      <p>${escapeHtml(game.tagline)}</p>
      <div class="card-footer"><span>${escapeHtml(titleCase(game.category))}</span><span>${count} cards</span></div>
    `;
    els.gameGrid.appendChild(card);
  });
}

function renderCustomSelects() {
  els.customGameSelect.innerHTML = GAMES.map(game => `<option value="${game.id}">${escapeHtml(game.title)}</option>`).join("");
  els.customGameSelect.value = state.activeGameId;
}

function renderActiveGame() {
  const game = getGame();
  document.documentElement.style.setProperty("--accent", game.color);
  els.activeCategory.textContent = `${game.icon} ${titleCase(game.category)}`;
  els.playTitle.textContent = game.title;
  els.gameRules.textContent = game.rules;
  els.promptInstruction.textContent = game.instruction;
  els.customGameSelect.value = game.id;
  updatePromptCounter();
  renderGameGrid();
}

function updatePromptCounter() {
  const game = getGame();
  const all = flattenPrompts(game).filter(prompt => state.intensity === "all" || prompt.intensity === state.intensity);
  const seen = (state.seen[game.id] || []).filter(id => all.some(prompt => prompt.id === id)).length;
  els.promptCounter.textContent = `${seen} / ${all.length} seen`;
}

function updateTurnPlayer() {
  if (!state.players.length) {
    els.turnPlayer.textContent = "Pass-and-play";
    return;
  }
  const name = state.players[state.currentPlayerIndex % state.players.length];
  els.turnPlayer.textContent = `Turn: ${name}`;
}

function drawPrompt({ skipped = false } = {}) {
  const game = getGame();
  const pool = getAvailablePrompts(game);
  if (!pool.length) {
    toast("No prompts match this filter.");
    return;
  }
  const prompt = pool[Math.floor(Math.random() * pool.length)];
  state.currentPrompt = {
    ...prompt,
    gameTitle: game.title,
    player: state.players[state.currentPlayerIndex] || "Group",
    timestamp: new Date().toISOString(),
    skipped
  };

  if (!state.seen[game.id]) state.seen[game.id] = [];
  if (!state.seen[game.id].includes(prompt.id)) state.seen[game.id].push(prompt.id);

  if (!skipped) {
    state.history.unshift(state.currentPrompt);
    state.history = state.history.slice(0, 80);
  }

  renderPrompt();
  updatePromptCounter();
  renderSessionList();
  startTimer();
  tinyBeep();

  if (state.settings.autoAdvance && state.players.length) {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  }
  renderPlayers();
  saveState();
}

function renderPrompt() {
  const prompt = state.currentPrompt;
  if (!prompt) return;
  els.promptText.textContent = prompt.text;
  els.promptIntensity.textContent = titleCase(prompt.intensity);
  els.promptCard.animate([
    { transform: "translateY(8px) scale(.985)", opacity: .72 },
    { transform: "translateY(0) scale(1)", opacity: 1 }
  ], { duration: 180, easing: "ease-out" });
  els.sessionVibe.textContent = `${prompt.gameTitle} · ${titleCase(prompt.intensity)}`;
}

function startTimer() {
  clearInterval(timerInterval);
  remainingSeconds = Number(state.timerSeconds) || 0;
  if (!remainingSeconds) {
    els.timerDisplay.textContent = "No timer";
    return;
  }
  renderTimer();
  timerInterval = setInterval(() => {
    remainingSeconds -= 1;
    renderTimer();
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      els.timerDisplay.textContent = "Time";
      toast("Time.");
      tinyBeep();
    }
  }, 1000);
}

function renderTimer() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = String(remainingSeconds % 60).padStart(2, "0");
  els.timerDisplay.textContent = `${mins}:${secs}`;
}

function favoriteCurrent() {
  if (!state.currentPrompt) {
    toast("Draw a prompt first.");
    return;
  }
  const exists = state.favorites.some(item => item.id === state.currentPrompt.id && item.text === state.currentPrompt.text);
  if (exists) {
    toast("Already favorited.");
    return;
  }
  state.favorites.unshift(state.currentPrompt);
  state.favorites = state.favorites.slice(0, 80);
  renderSessionList();
  saveState();
  toast("Favorited.");
}

function renderSessionList() {
  const list = state.activeTab === "history" ? state.history : state.favorites;
  els.sessionList.innerHTML = "";
  if (!list.length) {
    els.sessionList.innerHTML = `<div class="list-item"><strong>No ${state.activeTab} yet</strong><p>Draw and favorite prompts during the session.</p></div>`;
    return;
  }
  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<strong>${escapeHtml(item.gameTitle || getGame(item.gameId).title)} · ${escapeHtml(titleCase(item.intensity))}</strong><p>${escapeHtml(item.text)}</p>`;
    els.sessionList.appendChild(div);
  });
}

function addPlayer() {
  const name = els.playerInput.value.trim();
  if (!name) return;
  if (state.players.some(p => p.toLowerCase() === name.toLowerCase())) {
    toast("That player is already in.");
    return;
  }
  state.players.push(name);
  state.scores[name] = state.scores[name] || 0;
  els.playerInput.value = "";
  renderPlayers();
  saveState();
}

function removePlayer(index) {
  const [name] = state.players.splice(index, 1);
  delete state.scores[name];
  state.currentPlayerIndex = Math.min(state.currentPlayerIndex, Math.max(0, state.players.length - 1));
  renderPlayers();
  saveState();
}

function awardCurrent(delta) {
  if (!state.players.length) {
    toast("Add players first.");
    return;
  }
  const recipient = state.currentPrompt?.player && state.currentPrompt.player !== "Group"
    ? state.currentPrompt.player
    : state.players[(state.currentPlayerIndex + state.players.length - 1) % state.players.length];
  state.scores[recipient] = (state.scores[recipient] || 0) + Number(delta);
  renderScoreboard();
  saveState();
  toast(`${recipient} ${Number(delta) > 0 ? "+" : ""}${delta}`);
}

function addCustomPrompt() {
  const text = els.customPromptText.value.trim();
  if (!text) {
    toast("Write a prompt first.");
    return;
  }
  const gameId = els.customGameSelect.value;
  const prompt = {
    id: `${gameId}-custom-${Date.now()}`,
    gameId,
    intensity: els.customIntensitySelect.value,
    text,
    custom: true
  };
  state.customPrompts.push(prompt);
  els.customPromptText.value = "";
  renderGameGrid();
  updatePromptCounter();
  saveState();
  toast("Custom prompt added.");
}

function resetActiveDeck() {
  state.seen[state.activeGameId] = [];
  updatePromptCounter();
  saveState();
  toast("Deck reset.");
}

function resetScores() {
  Object.keys(state.scores).forEach(name => state.scores[name] = 0);
  renderScoreboard();
  saveState();
}

function clearSession() {
  state.history = [];
  state.favorites = [];
  state.seen = {};
  state.currentPrompt = null;
  clearInterval(timerInterval);
  els.promptText.textContent = "Session cleared. Draw a new prompt when ready.";
  els.timerDisplay.textContent = "--";
  renderSessionList();
  updatePromptCounter();
  saveState();
  toast("Session cleared.");
}

function exportSession() {
  const payload = {
    exportedAt: new Date().toISOString(),
    players: state.players,
    scores: state.scores,
    history: state.history,
    favorites: state.favorites,
    customPrompts: state.customPrompts
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `social-game-hub-session-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copySummary() {
  const lines = [
    "Social Game Hub session",
    "",
    "Scores:",
    ...state.players.map(name => `- ${name}: ${state.scores[name] || 0}`),
    "",
    "Favorite prompts:",
    ...(state.favorites.length ? state.favorites.slice(0, 12).map(item => `- [${item.gameTitle}] ${item.text}`) : ["- None"])
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    toast("Summary copied.");
  } catch {
    toast("Copy failed. Export instead.");
  }
}

function quickStart() {
  if (!state.players.length) {
    ["Alex", "Sam", "Jordan"].forEach(name => {
      if (!state.players.includes(name)) {
        state.players.push(name);
        state.scores[name] = 0;
      }
    });
  }
  state.activeGameId = "most-likely";
  state.intensity = "medium";
  els.intensitySelect.value = state.intensity;
  renderPlayers();
  renderActiveGame();
  drawPrompt();
  document.querySelector(".play-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function randomGame() {
  const filtered = GAMES.filter(game => state.currentFilter === "all" || game.category === state.currentFilter);
  const game = filtered[Math.floor(Math.random() * filtered.length)] || GAMES[0];
  state.activeGameId = game.id;
  renderActiveGame();
  drawPrompt();
  document.querySelector(".play-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function wipeStorage() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function titleCase(value) {
  return String(value).replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function bindEvents() {
  els.themeBtn.addEventListener("click", () => {
    state.settings.theme = state.settings.theme === "light" ? "dark" : "light";
    renderTheme();
    saveState();
  });
  els.openSettingsBtn.addEventListener("click", () => els.settingsDialog.showModal());
  els.quickStartBtn.addEventListener("click", quickStart);
  els.randomGameBtn.addEventListener("click", randomGame);
  els.clearSessionBtn.addEventListener("click", clearSession);
  els.addPlayerBtn.addEventListener("click", addPlayer);
  els.playerInput.addEventListener("keydown", event => {
    if (event.key === "Enter") addPlayer();
  });
  els.playerChips.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-player]");
    if (button) removePlayer(Number(button.dataset.removePlayer));
  });
  els.intensitySelect.addEventListener("change", event => {
    state.intensity = event.target.value;
    updatePromptCounter();
    saveState();
  });
  els.timerSelect.addEventListener("change", event => {
    state.timerSeconds = Number(event.target.value);
    saveState();
  });
  els.scoringSelect.addEventListener("change", event => {
    state.scoring = event.target.value;
    saveState();
  });
  els.categoryFilters.addEventListener("click", event => {
    const btn = event.target.closest("[data-category-filter]");
    if (!btn) return;
    state.currentFilter = btn.dataset.categoryFilter;
    renderCategoryFilters();
    renderGameGrid();
  });
  els.gameGrid.addEventListener("click", event => {
    const card = event.target.closest("[data-game-id]");
    if (!card) return;
    state.activeGameId = card.dataset.gameId;
    renderActiveGame();
    saveState();
    document.querySelector(".play-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.drawBtn.addEventListener("click", () => drawPrompt());
  els.skipBtn.addEventListener("click", () => drawPrompt({ skipped: true }));
  els.favoriteBtn.addEventListener("click", favoriteCurrent);
  els.resetDeckBtn.addEventListener("click", resetActiveDeck);
  els.resetScoresBtn.addEventListener("click", resetScores);
  document.addEventListener("click", event => {
    const scoreButton = event.target.closest("[data-score-name]");
    if (scoreButton) {
      const name = scoreButton.dataset.scoreName;
      state.scores[name] = (state.scores[name] || 0) + Number(scoreButton.dataset.scoreDelta);
      renderScoreboard();
      saveState();
    }
    const awardButton = event.target.closest(".award-btn");
    if (awardButton) awardCurrent(awardButton.dataset.award);
  });
  els.addCustomPromptBtn.addEventListener("click", addCustomPrompt);
  els.exportBtn.addEventListener("click", exportSession);
  els.copySummaryBtn.addEventListener("click", copySummary);
  $$(".tab").forEach(tab => tab.addEventListener("click", () => {
    state.activeTab = tab.dataset.tab;
    $$(".tab").forEach(t => t.classList.toggle("active", t === tab));
    renderSessionList();
  }));
  els.avoidRepeatToggle.addEventListener("change", event => {
    state.settings.avoidRepeat = event.target.checked;
    saveState();
  });
  els.autoAdvanceToggle.addEventListener("change", event => {
    state.settings.autoAdvance = event.target.checked;
    saveState();
  });
  els.soundToggle.addEventListener("change", event => {
    state.settings.sound = event.target.checked;
    saveState();
  });
  els.wipeStorageBtn.addEventListener("click", wipeStorage);
}

function syncControls() {
  els.intensitySelect.value = state.intensity;
  els.timerSelect.value = String(state.timerSeconds);
  els.scoringSelect.value = state.scoring;
  els.avoidRepeatToggle.checked = state.settings.avoidRepeat;
  els.autoAdvanceToggle.checked = state.settings.autoAdvance;
  els.soundToggle.checked = state.settings.sound;
}

function init() {
  loadState();
  bindEvents();
  syncControls();
  renderTheme();
  els.totalPromptsCount.textContent = totalPromptCount();
  renderCategoryFilters();
  renderGameGrid();
  renderCustomSelects();
  renderPlayers();
  renderActiveGame();
  renderSessionList();
}

init();
