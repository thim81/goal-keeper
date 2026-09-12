import { handleCalendarRequest } from '../../src/lib/calendar-api';

export const onRequestPost: PagesFunction = async ({ request }) => handleCalendarRequest(request);
