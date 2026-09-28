from build_setup_guides import p, h, note, code, bullets, source, write_pdf, write_docx

pages = [
('Your Google Calendar setup', 'DL COACHING / DARRYL\'S WALKTHROUGH / 01', [
 p('Hi Darryl. Follow these steps to prepare your Google Calendar for online PT bookings. You will choose your calendar, create the Google connection details and approve access during a short setup session.'),
 p('<b>Built by:</b> <link href="https://www.dkdigitaldesigns.com/" color="#0B6FD6">DK Digital - www.dkdigitaldesigns.com</link>'),
 note('<b>Before you start:</b> use a laptop or desktop and have your Google sign-in and two-step verification available. Keep your password to yourself. This connection uses Google\'s permission process, called OAuth, rather than a basic API key.'),
 h('1. Choose the calendar you will use'),
 p('Open <link href="https://calendar.google.com/" color="#0B6FD6">Google Calendar</link> and sign in to the account you want to use for PT appointments. Choose your main calendar or an existing training calendar that you own.'),
 bullets('Make a note of the Google email address and calendar name.', 'Use a calendar that includes all the times you cannot train clients. The website currently checks just one calendar; events on other calendars will not block bookings.', 'Keep your calendar private. You do not need to make it public.'),
 h('2. Create a Google Cloud project'),
 p('Open <link href="https://console.cloud.google.com/" color="#0B6FD6">Google Cloud Console</link> using the same Google account. Click the project selector at the top, choose <b>New Project</b>, enter <b>DL Coaching Booking</b> and click <b>Create</b>. Select this project once it is ready.'),
 h('3. Switch on the Calendar API'),
 p('In the left menu, open <b>APIs &amp; Services &gt; Library</b>. Search for <b>Google Calendar API</b>, open it and click <b>Enable</b>. If you see Manage instead, it is already enabled.'),
 h('4. Set up the permission screen'),
 p('Open <b>Google Auth platform &gt; Branding</b> and choose <b>Get started</b> if prompted. Enter <b>DL Coaching Booking</b> as the app name and your monitored email address for support and contact details. Review Google\'s terms and complete the setup.'),
 p('For a normal Gmail account, choose <b>External</b> under Audience. If you use a business Google Workspace account and are unsure which option applies, check with DK Digital. While the app is in Testing, open <b>Audience &gt; Test users &gt; Add users</b> and add the exact Google email from step 1.'),
]),
('Create your connection details', 'DL COACHING / DARRYL\'S WALKTHROUGH / 02', [
 h('5. Select the Calendar permissions'),
 p('Go to <b>Google Auth platform &gt; Data Access &gt; Add or remove scopes</b>. Find or manually add these two permissions, then save. Copy each address exactly:'),
 code('https://www.googleapis.com/auth/calendar.events\nhttps://www.googleapis.com/auth/calendar.events.freebusy'),
 p('These allow the connection to check availability and work with calendar events. Google may describe permission to view, edit or delete events. Only continue if the permissions shown match this Calendar setup.'),
 h('6. Create an OAuth client'),
 bullets('Open <b>Google Auth platform &gt; Clients</b> and click <b>Create client</b>.', 'For Application type, choose <b>Web application</b>.', 'For Name, enter <b>DL Coaching Calendar Connection</b>.', 'Under <b>Authorised redirect URIs</b>, click <b>Add URI</b> and paste the address below. Put it in redirect URIs, not JavaScript origins.'),
 code('http://localhost:8765/callback'),
 p('Leave <b>Authorised JavaScript origins</b> empty and click <b>Create</b>. Save the <b>Client ID</b> and <b>Client secret</b> in your password manager, or save the downloaded client JSON securely if Google offers it. Keep the exact spelling, port and path shown above.'),
 h('7. Note which calendar to connect'),
 p('If you chose your main calendar, tell DK Digital: <b>Use my main calendar</b>, along with the Google email from step 1.'),
 p('If you chose another calendar, open <b>Google Calendar &gt; Settings</b>. Under <b>Settings for my calendars</b>, select it, open <b>Integrate calendar</b> and copy the <b>Calendar ID</b>. Do not copy the public URL or the secret iCal address.'),
 h('8. Hand over the connection details securely'),
 p('Tell DK Digital that your Google setup is ready. Arrange a password-manager secure share or a private setup session for the <b>Client ID and Client secret</b>. Also provide the Google email and chosen calendar name or Calendar ID.'),
 note('<b>Keep the secret private.</b> Do not put your Client secret in ordinary email, WhatsApp messages or screenshots. Never share your Google password or sign-in verification codes.'),
]),
('Approve access and finish', 'DL COACHING / DARRYL\'S WALKTHROUGH / 03', [
 h('9. Complete the guided connection session'),
 p('Arrange a short session with DK Digital. Wait until they tell you the connection is ready, then open the Google approval link on the computer agreed for that session. Do not forward the link to your phone or another computer.'),
 bullets('Sign in to the Google account you chose in step 1.', 'Check that the app is <b>DL Coaching Booking</b> and review the Calendar permissions.', 'Approve access yourself when you are satisfied the details are correct.', 'Wait for the message <b>Calendar authorization complete</b>, then tell DK Digital you have finished.'),
 p('If Google says the app is unverified or blocks access, pause and show DK Digital the message without exposing any secrets. Your initial setup is for testing; DK Digital will guide you through any further Google approval steps before launch.'),
 h('10. Confirm your booking availability'),
 p('Send DK Digital the details below so your available appointments can be set up:'),
 bullets('Your working days and start/finish times, in UK local time.', 'Your breaks, days off and any upcoming holidays.', 'The gym or meeting location for in-person sessions.'),
 p('Once a test booking is arranged, check that it appears on your chosen calendar at the correct time and that the appointment details are right. Tell DK Digital if anything looks wrong.'),
 h('Your completion checklist'),
 bullets('I have chosen my Google account and calendar.', 'I have enabled the Calendar API and created the OAuth client.', 'I have arranged secure handover of the Client ID and Client secret.', 'I have approved the connection during the setup session.', 'I have provided my hours and checked the test appointment.'),
 note('<b>After setup:</b> mark holidays and other unavailable time as Busy on the connected calendar. Contact DK Digital before disconnecting the app. Deleting a Calendar event does not currently cancel the website booking or return the customer\'s credit.'),
 h('Helpful links'),
 source('DK Digital - website and contact', 'https://www.dkdigitaldesigns.com/'),
 source('Google - consent screen and permissions', 'https://developers.google.com/workspace/guides/configure-oauth-consent'),
 source('Google - OAuth client setup', 'https://developers.google.com/workspace/guides/create-credentials'),
 p('Prepared for Darryl / DL Coaching on 22 September 2026. Google menu labels may vary slightly.'),
]),
]

name = 'google-calendar-setup-for-darryl'
write_pdf(name, pages)
write_docx(name, pages)
print('Updated Darryl-only Google Calendar guide: PDF and Word.')
