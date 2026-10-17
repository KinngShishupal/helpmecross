import { IMAGES } from '../assets/images';
import { Character, Level } from './types';

// ---------------------------------------------------------------- helpers --

const has = (ids: string[], id: string) => ids.includes(id);
const any = (ids: string[], prefix: string) => ids.some(id => id.startsWith(prefix));
const count = (ids: string[], prefix: string) => ids.filter(id => id.startsWith(prefix)).length;

const COUPLES = [
  { n: 1, husband: 'Adam', wife: 'Amy', color: '#e53935' },
  { n: 2, husband: 'Ben', wife: 'Bella', color: '#43a047' },
  { n: 3, husband: 'Carl', wife: 'Cara', color: '#1e88e5' },
  { n: 4, husband: 'Dan', wife: 'Dana', color: '#fb8c00' },
];
const HUSBANDS = [IMAGES.husband1, IMAGES.husband2, IMAGES.husband3, IMAGES.husband4];
const WIVES = [IMAGES.wife1, IMAGES.wife2, IMAGES.wife3, IMAGES.wife4];

// cast ---------------------------------------------------------------------

const farmer = (): Character => ({ id: 'farmer', name: 'Farmer', image: IMAGES.farmer, canRow: true });
const animal = (id: string, name: keyof typeof IMAGES, label: string): Character => ({
  id,
  name: label,
  image: IMAGES[name],
  canRow: false,
});
const missionaries = (n: number, canRow = true): Character[] =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i + 1}`, name: 'Missionary', image: IMAGES.missionary, canRow }));
const cannibals = (n: number, rowers = n): Character[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: 'Cannibal', image: IMAGES.cannibal, canRow: i < rowers }));
const couples = (n: number, wivesRow = true): Character[] => [
  ...COUPLES.slice(0, n).map(c => ({
    id: `h${c.n}`,
    name: c.husband,
    image: HUSBANDS[c.n - 1],
    canRow: true,
    tag: { label: String(c.n), color: c.color },
  })),
  ...COUPLES.slice(0, n).map(c => ({
    id: `w${c.n}`,
    name: c.wife,
    image: WIVES[c.n - 1],
    canRow: wivesRow,
    tag: { label: String(c.n), color: c.color },
  })),
];
const person = (id: string, name: string, image: keyof typeof IMAGES, canRow: boolean, weight?: number): Character => ({
  id,
  name,
  image: IMAGES[image],
  canRow,
  ...(weight ? { weight, tag: { label: String(weight), color: '#546e7a' } } : {}),
});

// rules --------------------------------------------------------------------

type Rule = (ids: string[]) => string | null;

/** Each [hunter, prey] pair may not be together unless a guardian is present. Ids match by prefix. */
const predators =
  (guardians: string[], pairs: [string, string, string][]): Rule =>
  ids => {
    if (guardians.some(g => has(ids, g))) {
      return null;
    }
    const pair = pairs.find(([a, b]) => any(ids, a) && any(ids, b));
    return pair ? pair[2] : null;
  };

const outnumbered: Rule = ids => {
  const m = count(ids, 'm');
  return m > 0 && count(ids, 'c') > m ? 'The cannibals outnumbered the missionaries!' : null;
};

const jealous =
  (n: number): Rule =>
  ids => {
    for (const c of COUPLES.slice(0, n)) {
      const otherMan = COUPLES.slice(0, n).some(o => o.n !== c.n && has(ids, `h${o.n}`));
      if (has(ids, `w${c.n}`) && !has(ids, `h${c.n}`) && otherMan) {
        return `${c.wife} was left with another man while ${c.husband} was away!`;
      }
    }
    return null;
  };

const familyRules: Rule = ids => {
  if (has(ids, 'father') && !has(ids, 'mother') && any(ids, 'daughter')) {
    return 'The father was left with a daughter without the mother!';
  }
  if (has(ids, 'mother') && !has(ids, 'father') && any(ids, 'son')) {
    return 'The mother was left with a son without the father!';
  }
  return null;
};

const FAMILY = ['father', 'mother', 'son', 'daughter'];
const thiefRule: Rule = ids =>
  has(ids, 'thief') && !has(ids, 'police') && FAMILY.some(f => any(ids, f))
    ? 'The thief robbed the family while the police officer was away!'
    : null;

const all =
  (...rules: Rule[]): Rule =>
  ids => {
    for (const rule of rules) {
      const result = rule(ids);
      if (result) {
        return result;
      }
    }
    return null;
  };

const weightLimit =
  (characters: Character[], max: number): Rule =>
  ids => {
    const total = characters.filter(c => ids.includes(c.id)).reduce((sum, c) => sum + (c.weight ?? 0), 0);
    return total > max ? `Too heavy! The boat carries at most ${max} kg (this load is ${total} kg).` : null;
  };

const WEIGHT_NOTE = 'The grey badge shows each person\'s weight in kg.';

// ----------------------------------------------------------------- levels --

const TIME_COLOR = '#ef6c00';

/** Someone crossing the night bridge; the badge shows their minutes. */
const walker = (id: string, name: string, image: keyof typeof IMAGES, minutes: number, canCarryTorch = true): Character => ({
  id,
  name,
  image: IMAGES[image],
  canRow: canCarryTorch,
  minutes,
  tag: { label: String(minutes), color: TIME_COLOR },
});

/** A Bridge & Torch stage: timed, walked at night with a single torch. */
function bridge(
  base: Pick<Level, 'id' | 'title' | 'cover' | 'description' | 'characters'> & {
    timeLimit: number;
    boatCapacity?: number;
    extraRules?: string[];
    /** The level uses its own badge colours (explained in extraRules). */
    customBadges?: boolean;
  },
  checkGroup: Rule = () => null,
): Level {
  const { extraRules = [], customBadges, boatCapacity = 2, ...rest } = base;
  return {
    ...rest,
    difficulty: 'Medium',
    setting: 'bridge',
    boatCapacity,
    checkGroup,
    rules: [
      `At most ${boatCapacity === 2 ? 'two' : 'three'} people can be on the bridge at once.`,
      'Whoever crosses must carry the torch, so someone always has to bring it back.',
      'A group walks at the pace of its slowest member.',
      `Everyone must be across within ${base.timeLimit} minutes.`,
      ...extraRules,
      ...(customBadges ? [] : ['The orange badge shows how many minutes each person needs to cross.']),
    ],
  };
}


function weighted(
  base: Omit<Level, 'checkGroup' | 'boatCheck' | 'boatCapacity'> & { max: number; boatCapacity?: number },
  checkGroup: Rule = () => null,
): Level {
  const { max, ...rest } = base;
  return {
    boatCapacity: 2,
    ...rest,
    checkGroup,
    boatCheck: weightLimit(base.characters, max),
  };
}

const soldiers = (n: number) => Array.from({ length: n }, (_, i) => person(`soldier${i + 1}`, 'Soldier', 'soldier', true, 80));
const boys = (n: number) => Array.from({ length: n }, (_, i) => person(`boy${i + 1}`, 'Boy', 'son', true, 40));

const ALL_LEVELS: Level[] = [
  {
    id: 'farmer',
    title: 'Wolf, Goat & Cabbage',
    cover: [IMAGES.wolf, IMAGES.farmer, IMAGES.goat],
    difficulty: 'Easy',
    description: 'A farmer has to get a wolf, a goat and a cabbage safely across the river.',
    rules: [
      'The boat carries the farmer plus at most one passenger.',
      'Only the farmer can row.',
      'Left alone together, the wolf eats the goat.',
      'Left alone together, the goat eats the cabbage.',
    ],
    boatCapacity: 2,
    characters: [farmer(), animal('wolf', 'wolf', 'Wolf'), animal('goat', 'goat', 'Goat'), animal('cabbage', 'cabbage', 'Cabbage')],
    checkGroup: predators(['farmer'], [
      ['wolf', 'goat', 'The wolf ate the goat!'],
      ['goat', 'cabbage', 'The goat ate the cabbage!'],
    ]),
  },
  {
    id: 'missionaries',
    title: 'Missionaries & Cannibals II',
    cover: [IMAGES.missionary, IMAGES.cannibal, IMAGES.missionary],
    difficulty: 'Medium',
    description: 'The classic: three missionaries and three cannibals, and a boat that holds two.',
    rules: [
      'The boat carries at most two people, and anyone can row.',
      'If cannibals outnumber missionaries on a bank (with at least one missionary there), the missionaries get eaten.',
      'People in a docked boat count as being on that bank.',
    ],
    boatCapacity: 2,
    characters: [...missionaries(3), ...cannibals(3)],
    checkGroup: outnumbered,
  },
  weighted({
    id: 'soldiers-2',
    title: 'Two Soldiers & Two Boys',
    cover: [IMAGES.soldier, IMAGES.son, IMAGES.soldier],
    difficulty: 'Medium',
    description: 'Now two soldiers must borrow the boys\' little boat.',
    rules: ['The boat carries at most 80 kg: one soldier, or two boys.', 'Everyone can row.', WEIGHT_NOTE],
    characters: [...soldiers(2), ...boys(2)],
    max: 80,
  }),
  {
    id: 'escort',
    title: 'Police Escort',
    cover: [IMAGES.police, IMAGES.thief, IMAGES.father],
    difficulty: 'Medium',
    description: 'A police officer is escorting a thief across, along with a father and his son.',
    rules: [
      'The boat carries at most two people.',
      'Only the Police officer and the Father can row.',
      'The Thief cannot be with the Father or Son unless the Police officer is present.',
      'These rules apply on both banks and inside the boat.',
    ],
    boatCapacity: 2,
    characters: [
      person('father', 'Father', 'father', true),
      person('son', 'Son', 'son', false),
      person('police', 'Police', 'police', true),
      person('thief', 'Thief', 'thief', false),
    ],
    checkGroup: thiefRule,
  },
  {
    id: 'couples',
    title: 'Jealous Couples II',
    cover: [IMAGES.husband1, IMAGES.wife1, IMAGES.husband3],
    difficulty: 'Hard',
    description: 'Three couples need to cross, but the husbands are very jealous.',
    rules: [
      'The boat carries at most two people, and anyone can row.',
      'A wife may never be with another man unless her own husband is there too, on a bank or in the boat.',
      'Matching colour badges show who is married to whom.',
    ],
    boatCapacity: 2,
    characters: couples(3),
    checkGroup: jealous(3),
  },
  {
    id: 'babysitter',
    title: 'The Babysitter',
    cover: [IMAGES.son, IMAGES.dog, IMAGES.daughter],
    difficulty: 'Medium',
    description: 'Mum and Dad must bring the kids and an excitable dog across.',
    rules: [
      'The boat carries at most two.',
      'Only the Father and the Mother can row.',
      'The dog cannot be with the children unless a parent is there.',
    ],
    boatCapacity: 2,
    characters: [
      person('father', 'Father', 'father', true),
      person('mother', 'Mother', 'mother', true),
      person('son', 'Son', 'son', false),
      person('daughter', 'Daughter', 'daughter', false),
      animal('dog', 'dog', 'Dog'),
    ],
    checkGroup: predators(['father', 'mother'], [
      ['dog', 'son', 'The dog knocked the son over!'],
      ['dog', 'daughter', 'The dog knocked the daughter over!'],
    ]),
  },
  {
    id: 'mc-big',
    title: 'Missionaries & Cannibals III',
    cover: [IMAGES.cannibal, IMAGES.missionary, IMAGES.cannibal],
    difficulty: 'Hard',
    description: 'Four of each, and a bigger boat that holds three.',
    rules: [
      'The boat carries at most three people, and anyone can row.',
      'If cannibals outnumber missionaries anywhere (with at least one missionary there), the missionaries get eaten. This includes the boat.',
    ],
    boatCapacity: 3,
    characters: [...missionaries(4), ...cannibals(4)],
    checkGroup: outnumbered,
  },
  {
    id: 'mc-rower',
    title: 'One Cannibal Rows',
    cover: [IMAGES.cannibal, IMAGES.missionary, IMAGES.missionary],
    difficulty: 'Hard',
    description: 'The classic puzzle again, but only one cannibal knows how to row.',
    rules: [
      'The boat carries at most two people.',
      'All the missionaries can row, but only one cannibal can (gold paddle badge).',
      'If cannibals outnumber missionaries on a bank (with at least one missionary there), the missionaries get eaten.',
    ],
    boatCapacity: 2,
    characters: [...missionaries(3), ...cannibals(3, 1)],
    checkGroup: outnumbered,
  },
  {
    id: 'family-outing',
    title: 'Family Outing',
    cover: [IMAGES.father, IMAGES.son, IMAGES.mother],
    difficulty: 'Hard',
    description: 'A strict family of six is crossing for a picnic.',
    rules: [
      'The boat carries at most two people.',
      'Everyone can row.',
      'The Father cannot be with a daughter unless the Mother is present.',
      'The Mother cannot be with a son unless the Father is present.',
    ],
    boatCapacity: 2,
    characters: [
      person('father', 'Father', 'father', true),
      person('mother', 'Mother', 'mother', true),
      person('son1', 'Son', 'son', true),
      person('son2', 'Son', 'son', true),
      person('daughter1', 'Daughter', 'daughter', true),
      person('daughter2', 'Daughter', 'daughter', true),
    ],
    checkGroup: familyRules,
  },
  weighted(
    {
      id: 'family-weight-2',
      title: 'Heavy Picnic',
      cover: [IMAGES.father, IMAGES.dog, IMAGES.mother],
      difficulty: 'Hard',
      description: 'The whole family and the dog, with a boat that sinks if overloaded.',
      boatCapacity: 3,
      rules: [
        'The boat carries at most 110 kg.',
        'Everyone except the dog can row.',
        'The dog cannot be with the children unless a parent is there.',
        WEIGHT_NOTE,
      ],
      characters: [
        person('father', 'Father', 'father', true, 90),
        person('mother', 'Mother', 'mother', true, 70),
        person('son', 'Son', 'son', true, 50),
        person('daughter', 'Daughter', 'daughter', true, 40),
        { ...animal('dog', 'dog', 'Dog'), weight: 20, tag: { label: '20', color: '#546e7a' } },
      ],
      max: 110,
    },
    predators(['father', 'mother'], [
      ['dog', 'son', 'The dog knocked the son over!'],
      ['dog', 'daughter', 'The dog knocked the daughter over!'],
    ]),
  ),
  {
    id: 'pets-3',
    title: 'Noah\'s Little Ark',
    cover: [IMAGES.cat, IMAGES.goat, IMAGES.mouse],
    difficulty: 'Expert',
    description: 'The farmer has collected quite a menagerie.',
    rules: [
      'The boat carries the farmer plus up to two animals.',
      'Only the farmer can row.',
      'Without the farmer: the dog chases the cat, the cat catches the mouse, the wolf eats the goat, and the dog fights the wolf.',
    ],
    boatCapacity: 3,
    characters: [
      farmer(),
      animal('dog', 'dog', 'Dog'),
      animal('cat', 'cat', 'Cat'),
      animal('mouse', 'mouse', 'Mouse'),
      animal('wolf', 'wolf', 'Wolf'),
      animal('goat', 'goat', 'Goat'),
    ],
    checkGroup: predators(['farmer'], [
      ['dog', 'cat', 'The dog chased the cat away!'],
      ['cat', 'mouse', 'The cat caught the mouse!'],
      ['wolf', 'goat', 'The wolf ate the goat!'],
      ['dog', 'wolf', 'The dog and the wolf got into a fight!'],
    ]),
  },
  {
    id: 'couples-4',
    title: 'Jealous Couples III',
    cover: [IMAGES.husband4, IMAGES.wife4, IMAGES.husband2],
    difficulty: 'Expert',
    description: 'Four couples, and a boat that holds three.',
    rules: [
      'The boat carries at most three people, and anyone can row.',
      'A wife may never be with another man unless her own husband is there too, on a bank or in the boat.',
      'Matching colour badges show who is married to whom.',
    ],
    boatCapacity: 3,
    characters: couples(4),
    checkGroup: jealous(4),
  },
  {
    id: 'family',
    title: 'Family, Police & Thief',
    cover: [IMAGES.thief, IMAGES.police, IMAGES.daughter],
    difficulty: 'Expert',
    description: 'The grand finale: a family of six, a police officer and a thief.',
    rules: [
      'The boat carries at most two people.',
      'Only the Father, the Mother and the Police officer can row.',
      'The Father cannot be with a daughter unless the Mother is present.',
      'The Mother cannot be with a son unless the Father is present.',
      'The Thief cannot be with any family member unless the Police officer is present.',
      'These rules apply on both banks and inside the boat.',
    ],
    boatCapacity: 2,
    characters: [
      person('father', 'Father', 'father', true),
      person('mother', 'Mother', 'mother', true),
      person('son1', 'Son', 'son', false),
      person('son2', 'Son', 'son', false),
      person('daughter1', 'Daughter', 'daughter', false),
      person('daughter2', 'Daughter', 'daughter', false),
      person('police', 'Police', 'police', true),
      person('thief', 'Thief', 'thief', false),
    ],
    checkGroup: all(thiefRule, familyRules),
  },
  bridge({
    id: 'bridge-3',
    title: 'Night Walk',
    cover: [IMAGES.son, IMAGES.mother, IMAGES.grandpa],
    description: 'Three walkers, one torch and a rickety rope bridge.',
    characters: [walker('son', 'Son', 'son', 1), walker('mother', 'Mother', 'mother', 3), walker('grandpa', 'Grandpa', 'grandpa', 6)],
    timeLimit: 10,
  }),
  bridge({
    id: 'bridge',
    title: 'Bridge & Torch',
    cover: [IMAGES.daughter, IMAGES.grandpa, IMAGES.son],
    description: 'The classic: four people with very different paces, and only 17 minutes.',
    characters: [
      walker('son', 'Son', 'son', 1),
      walker('daughter', 'Daughter', 'daughter', 2),
      walker('father', 'Father', 'father', 5),
      walker('grandpa', 'Grandpa', 'grandpa', 10),
    ],
    timeLimit: 17,
  }),
  bridge(
    {
      id: 'bridge-dog',
      title: 'Walking the Dog',
      cover: [IMAGES.father, IMAGES.dog, IMAGES.grandma],
      description: 'The dog is quick, but it cannot carry the torch and must never be left alone.',
      characters: [
        walker('son', 'Son', 'son', 1),
        walker('father', 'Father', 'father', 4),
        walker('grandma', 'Grandma', 'grandma', 8),
        walker('dog', 'Dog', 'dog', 2, false),
      ],
      timeLimit: 16,
      extraRules: ['The dog cannot carry the torch.', 'The dog must never be left on its own.'],
    },
    ids => (ids.length === 1 && ids[0] === 'dog' ? 'The dog was left alone and wandered off!' : null),
  ),
  bridge({
    id: 'bridge-wide',
    title: 'The Wide Bridge',
    cover: [IMAGES.mother, IMAGES.grandma, IMAGES.son],
    description: 'This bridge holds three at once. Six walkers need to cross.',
    boatCapacity: 3,
    characters: [
      walker('son', 'Son', 'son', 1),
      walker('daughter', 'Daughter', 'daughter', 2),
      walker('father', 'Father', 'father', 4),
      walker('father', 'Father', 'father', 4),
      walker('mother', 'Mother', 'mother', 5),
      walker('grandma', 'Grandma', 'grandma', 8),
      walker('grandpa', 'Grandpa', 'grandpa', 10),
    ],
    timeLimit: 19,
  }),
  bridge(
    {
      id: 'bridge-thief',
      title: 'Escort by Night',
      cover: [IMAGES.police, IMAGES.thief, IMAGES.son],
      description: 'A police officer escorts a thief over the bridge, with a father and son.',
      characters: [
        walker('son', 'Son', 'son', 1),
        walker('police', 'Police', 'police', 2),
        walker('thief', 'Thief', 'thief', 3, false),
        walker('father', 'Father', 'father', 5),
      ],
      timeLimit: 13,
      extraRules: [
        'The thief is not trusted with the torch.',
        'The thief cannot be with the father or son unless the police officer is there.',
      ],
    },
    thiefRule,
  ),
  bridge({
    id: 'bridge-5',
    title: 'Five by Torchlight',
    cover: [IMAGES.father, IMAGES.grandpa, IMAGES.mother],
    description: 'Five walkers and a torch that is burning low.',
    characters: [
      walker('son', 'Son', 'son', 1),
      walker('daughter', 'Daughter', 'daughter', 3),
      walker('mother', 'Mother', 'mother', 6),
      walker('father', 'Father', 'father', 8),
      walker('grandpa', 'Grandpa', 'grandpa', 12),
    ],
    timeLimit: 29,
  }),
  bridge(
    {
      id: 'bridge-couples',
      title: 'Moonlit Couples',
      cover: [IMAGES.husband1, IMAGES.wife2, IMAGES.husband2],
      description: 'Two jealous couples share one torch on a narrow bridge.',
      characters: couples(2).map((c, i) => ({ ...c, minutes: [1, 4, 2, 7][i], tag: { label: String([1, 4, 2, 7][i]), color: c.tag!.color } })),
      timeLimit: 16,
      customBadges: true,
      extraRules: [
        'A wife may never be with another man unless her own husband is there too.',
        'The badge colour shows who is married to whom; its number is the minutes needed to cross.',
      ],
    },
    jealous(2),
  ),
  bridge({
    id: 'bridge-grandparents',
    title: 'Slow and Steady',
    cover: [IMAGES.grandma, IMAGES.daughter, IMAGES.grandpa],
    description: 'Both grandparents are visiting, and they take their time.',
    characters: [
      walker('son', 'Son', 'son', 1),
      walker('daughter', 'Daughter', 'daughter', 2),
      walker('father', 'Father', 'father', 6),
      walker('grandma', 'Grandma', 'grandma', 9),
      walker('grandpa', 'Grandpa', 'grandpa', 10),
    ],
    timeLimit: 24,
  }),
  bridge({
    id: 'bridge-6',
    title: 'Six by Torchlight',
    cover: [IMAGES.soldier, IMAGES.grandpa, IMAGES.police],
    description: 'Six walkers, a narrow bridge and a single torch.',
    characters: [
      walker('son', 'Son', 'son', 1),
      walker('soldier', 'Soldier', 'soldier', 3),
      walker('police', 'Police', 'police', 4),
      walker('mother', 'Mother', 'mother', 6),
      walker('grandma', 'Grandma', 'grandma', 8),
      walker('grandpa', 'Grandpa', 'grandpa', 9),
    ],
    timeLimit: 31,
  }),
  {
    ...weighted({
      id: 'tide',
      title: 'Beat the Tide',
      cover: [IMAGES.soldier, IMAGES.son, IMAGES.soldier],
      difficulty: 'Hard',
      description: 'Two soldiers and two boys must cross before the tide turns.',
      rules: [
        'The boat carries at most 80 kg: one soldier, or two boys.',
        'Everyone can row. A crossing takes as long as the slowest rower aboard.',
        `Everyone must be across within 19 minutes.`,
        'Soldiers weigh 80 kg and boys 40 kg. The orange badge shows minutes per crossing.',
      ],
      characters: [
        { ...person('soldier1', 'Soldier', 'soldier', true, 80), minutes: 3, tag: { label: '3', color: TIME_COLOR } },
        { ...person('soldier2', 'Soldier', 'soldier', true, 80), minutes: 4, tag: { label: '4', color: TIME_COLOR } },
        { ...person('boy1', 'Boy', 'son', true, 40), minutes: 1, tag: { label: '1', color: TIME_COLOR } },
        { ...person('boy2', 'Boy', 'son', true, 40), minutes: 2, tag: { label: '2', color: TIME_COLOR } },
      ],
      max: 80,
    }),
    timeLimit: 19,
  },
  bridge({
    id: 'bridge-kids',
    title: 'Little Ones',
    cover: [IMAGES.son, IMAGES.grandma, IMAGES.daughter],
    description: 'The children are quick on their feet, but too young to carry the torch.',
    characters: [
      walker('son', 'Son', 'son', 1, false),
      walker('daughter', 'Daughter', 'daughter', 2, false),
      walker('mother', 'Mother', 'mother', 3),
      walker('grandma', 'Grandma', 'grandma', 7),
    ],
    timeLimit: 19,
    extraRules: ['The children cannot carry the torch.'],
  }),
];

/** Play order, easiest first, with the difficulty shown for each stage. */
const ORDER: [string, Level['difficulty']][] = [
  ['farmer', 'Easy'],
  ['bridge-3', 'Easy'],
  ['escort', 'Easy'],
  ['bridge-kids', 'Easy'],
  ['babysitter', 'Medium'],
  ['bridge', 'Medium'],
  ['soldiers-2', 'Medium'],
  ['missionaries', 'Medium'],
  ['bridge-dog', 'Medium'],
  ['family-weight-2', 'Medium'],
  ['bridge-thief', 'Medium'],
  ['pets-3', 'Hard'],
  ['bridge-wide', 'Hard'],
  ['mc-big', 'Hard'],
  ['family-outing', 'Hard'],
  ['bridge-5', 'Hard'],
  ['couples', 'Hard'],
  ['tide', 'Hard'],
  ['bridge-couples', 'Hard'],
  ['mc-rower', 'Expert'],
  ['bridge-grandparents', 'Expert'],
  ['couples-4', 'Expert'],
  ['bridge-6', 'Expert'],
  ['family', 'Expert'],
];

export const LEVELS: Level[] = ORDER.map(([id, difficulty]) => {
  const level = ALL_LEVELS.find(l => l.id === id);
  if (!level) {
    throw new Error(`Unknown level ${id}`);
  }
  return { ...level, difficulty };
});
