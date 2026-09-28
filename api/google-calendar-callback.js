import { calendarOAuth } from '../server/services/calendar-oauth.js';

const connection = calendarOAuth();
export const GET = (request) => connection.callback(request);
