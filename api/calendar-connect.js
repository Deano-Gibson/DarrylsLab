import { calendarOAuth } from '../server/services/calendar-oauth.js';

const connection = calendarOAuth();
export const GET = () => connection.status();
export const POST = (request) => connection.start(request);
