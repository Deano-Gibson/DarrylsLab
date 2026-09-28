import { loadEnvFile } from 'node:process';
import { db } from '../server/platform.js';
import { publishTrainingSlots } from '../server/services/training-schedule.js';
loadEnvFile('.env');
const inserted = await publishTrainingSlots(db());
console.log(
  `Published ${inserted} new training slots. Existing closed and booked times were preserved.`,
);
