import axios from 'axios';
import 'dotenv/config';
import { writeToFile } from './util/writeToFile.js';

const BASE_URL = 'https://www.warcraftlogs.com/api/v2/client';
const HEADERS = (access_token) => ({
  headers: {
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
  }
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/*
Encounter IDs:
  Plexus Sentinel 3129
  Loom'ithar 3131
  Soulbinder Naazindhri 3130
  Forgeweaver Araz 3132
  Soul Hunters 3122
  Fractillus 3133
  Nexus-King Saldahaar 3134
  Dimensius 3135
*/

/* ------------------------------------- */
/* ! EDIT ME BEFORE YOU RUN THE SCRIPT ! */
/* ------------------------------------- */
/*
  NOTABLE RESTRICTION: Haven't yet coded the ability to handle if the same encounter is tested
  several times. Will handle that once it happens (needs some timestamp logic).
  */
// 42 = Liberation of Undermine, 44 = Manaforge Omega
const WCL_RAID_ZONE_ID = 44;
// See comment above for encounter IDs
const ENCOUNTER_ID = 3134;
// Heroic = 4, Mythic = 5
const DIFFICULTY_ID = 4;
// In the case of scaling aura missing ingame causing skewed data.
// Set this to a value slightly above raid ilvl scaling
const REQUIRED_RAID_ILVL = 680; 
// Minimum fight duration in seconds to reduce data load
const BASELINE_MIN_FIGHT_DURATION = 60;
const BLACKLISTED_SPELL_IDS = [
  // 467230, // (Vexie) Blaze of Glory: Damage from hitting boss with bikes
]
/* ------------------------------------- */
/* ! EDIT ME BEFORE YOU RUN THE SCRIPT ! */
/* ------------------------------------- */

const outputGQLErrors = (out) => {
  if (out && out.errors) {
    console.log(out.errors)
    console.log(out.errors[0].locations)
    console.log(out.errors[0].extensions)
    return true
  }
}

const parseIndividualDamage = (data, start, end, isKill, reportCode, fightId) => {
  // Important items for output:
  // Encounter ID, PlayerName, Class, DPS, Fight Time, Wipe/Kill, Report Code, Fight ID

  console.debug(' > > > Creating data line for', data.name, '(code/fightId', reportCode, fightId, ')');
  return [
    ENCOUNTER_ID,
    data.name,
    data.icon, // Icon provides a full Class-Spec definition, for w/e reason
    Number(data.total / ((end - start) / 1000)).toFixed(0), // DPS
    ((end - start) / 1000).toFixed(0),
    isKill ? 'Kill' : ' ',
    reportCode,
    fightId
  ]
};

const individualFightParser = async (access_token, code, fightId) => {
  const fightDataGQL = `query getFightData {
    reportData {
      report(code: "${code}") {
        code
        table(
          fightIDs: [${fightId}]
          encounterID: ${ENCOUNTER_ID}
          dataType: DamageDone
          ${BLACKLISTED_SPELL_IDS.length > 0 ? `filterExpression: "${
            BLACKLISTED_SPELL_IDS.map(id => `ability.id != ${id}`).join(' and ')
          }"` : ''} 
        )
        fights(fightIDs: [${fightId}]) {
          startTime
          endTime
          kill
        }
      }
    }
  }`;

  return await axios.post(BASE_URL, {
    operationName: 'getFightData',
    query: fightDataGQL,
    variables: {},
  }, HEADERS(access_token)).then(
    (resp) => {
      const { startTime, endTime, kill } = resp.data.data.reportData.report.fights[0];
      const output = (resp?.data?.data?.reportData?.report?.table?.data?.entries || [])
        .map(entry => {
          if ((endTime - startTime) / 1000 < BASELINE_MIN_FIGHT_DURATION) return;
          return parseIndividualDamage(entry, startTime, endTime, kill, code, fightId)
        })
        .filter(Boolean);
      return output;
    },
    (err) => console.log(err),
  );
}

const codeIdParser = async (access_token, fightFinderOutput) => {
  /*
    fightFinderOutput structure is of form
    {
      code: string,
      fights: {
        id: number,
        averageItemLevel: number
      }[]
    }
  */
  
  console.debug('Starting fight code parsing');
  const data = []
  for (let report of fightFinderOutput) {
    console.debug(' > Parsing report', report.code);
    const { code, fights } = report;
    if (!fights) { 
      console.debug(' > > No fights found for report', code);
      continue;
    }

    for (let fight of fights) {
      if (fight.averageItemLevel > REQUIRED_RAID_ILVL) continue;

      console.debug(' > > Parsing fight', fight.id, '(code:', code, ')');
      data.push(
        ...(await individualFightParser(access_token, code, fight.id))
      );
      await wait(500);
    }
  }

  console.log('Finalizing output...');
  const csvData = data.map(row => row.join(',')).join('\n');
  writeToFile(
    csvData,
    {
      filePath: `./output/output_${ENCOUNTER_ID}_${DIFFICULTY_ID}.json`,
      alreadyString: true
    }
);
}

const handleFightFinder = async (access_token) => {
  console.log('Token acquired', access_token)
  let page = 1;
  const data = []
  while (page) {
    console.debug('Grabbing page', page, 'of fight data for encounter ID', ENCOUNTER_ID)
    const fightIdsGQL = `query fetchFightIds {
      reportData {
        reports(zoneID: ${WCL_RAID_ZONE_ID}, page: ${page}) {
          has_more_pages
          data {
            code
            fights(
              encounterID: ${ENCOUNTER_ID}
              difficulty: ${DIFFICULTY_ID}
              translate: true
            ) {
              averageItemLevel
              id
            }
          }
          total
        }
      }
    }`

    await axios.post(BASE_URL, {
      operationName: 'fetchFightIds',
      query: fightIdsGQL,
      variables: {},
    }, HEADERS(access_token)).then(
      (resp) => {
        const responseData = resp.data.data.reportData.reports;
        const morePages = Boolean(responseData.has_more_pages);
        if (morePages) {
          page++;
        } else {
          page = 0; // Leave the loop
        }
        data.push(...responseData.data);
      },
      (err) => console.log(err),
    );

    // Wait before continuing to help alleviate rate limiting issues
    await wait(1000);
  }

  codeIdParser(access_token, data);
}

const getToken = () => {
  return axios.post(`https://www.warcraftlogs.com/oauth/token`, {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: 'client_credentials',
  }).then(
    (resp) => {
      handleFightFinder(resp.data.access_token)
    },
    (err) => console.log(err),
  );
};

getToken();