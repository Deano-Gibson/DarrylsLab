from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / 'output' / 'pdf'
WORD = ROOT / 'output' / 'docx'
PDF.mkdir(parents=True, exist_ok=True)
WORD.mkdir(parents=True, exist_ok=True)

# The guides contain instructions and illustrative identifiers only, never credentials.
def p(text): return ('p', text)
def h(text): return ('h', text)
def note(text): return ('note', text)
def code(text): return ('code', text)
def bullets(*items): return ('bullets', items)
def table(headers, rows): return ('table', headers, rows)
def source(label, url): return ('source', label, url)

google = [
('Connect Google Calendar', '01 / DARRYL + DEVELOPER / GET STARTED', [
 p('A walkthrough for DL Coaching. Once connected, the website can check your busy times, add a confirmed PT appointment and send your customer a calendar invitation.'),
 note('<b>This needs OAuth, not a basic API key.</b> OAuth means you sign in to Google and give the website permission. A basic API key cannot authorise access to your private calendar. Customers do not need to connect their own Google accounts. [G1]'),
 h('Who does what'),
 table(['Darryl', 'Developer'], [
 ('Owns the Google account and Cloud project; chooses the calendar; approves access.', 'Helps configure Google, runs the connection helper and stores the credentials.'),
 ('Confirms working hours, blocked dates and the training location.', 'Publishes available slots and tests a booking before launch.'),
 ]),
 h('Before you begin'),
 bullets('Use a laptop or desktop and the Google account that owns your training calendar.', 'Keep Google sign-in and two-step verification to yourself. Arrange a setup session with your developer.', 'Decide which calendar will hold PT sessions. The current website checks only that one calendar. Personal commitments on another calendar will not block bookings automatically.'),
 h('1. Create the project and enable Calendar'),
 p('Open <link href="https://console.cloud.google.com/" color="#0B6FD6">Google Cloud Console</link>. Select the project picker at the top, then <b>New Project</b>. Name it <b>DL Coaching Booking</b> and create it. Make sure this project is selected.'),
 p('Go to <b>APIs &amp; Services &gt; Library</b>, search for <b>Google Calendar API</b>, open it and select <b>Enable</b>. [G2]'),
 h('2. Set up the Google permission screen'),
 p('Open <b>Google Auth platform &gt; Branding &gt; Get started</b>. Use <b>DL Coaching Booking</b> as the app name and your own monitored email for support and contact details. Review Google\'s terms yourself. [G3]'),
 p('For a normal Gmail account, select <b>External</b> under Audience. Use Internal only if available and all authorising accounts belong to your Google Workspace organisation. While testing, add the exact Google email you will use under <b>Audience &gt; Test users</b>. [G3]'),
]),
('Create the connection', '02 / DARRYL + DEVELOPER / GOOGLE SETTINGS', [
 h('3. Add the two Calendar permissions'),
 p('Open <b>Google Auth platform &gt; Data Access</b>, then <b>Add or remove scopes</b>. Add the following scopes and save. These are the exact permissions requested by this website\'s helper. [G3, G4]'),
 code('https://www.googleapis.com/auth/calendar.events\nhttps://www.googleapis.com/auth/calendar.events.freebusy'),
 p('The first permits viewing and editing events on calendars you can access; the second permits checking availability. Google may describe a broader ability to change or delete events. The current website uses these permissions to check busy times and create bookings. It does not offer cancellation or rescheduling yet.'),
 h('4. Create an OAuth client'),
 p('Go to <b>Google Auth platform &gt; Clients &gt; Create client</b>. Choose <b>Web application</b> and name it <b>DL Coaching Calendar Connection</b>. Under <b>Authorised redirect URIs</b>, add this exact address: [G1]'),
 code('http://localhost:8765/callback'),
 p('Leave Authorised JavaScript origins empty for this server-side helper. Create the client. Securely save its <b>Client ID</b> and <b>Client secret</b> (or the downloaded client JSON). Do not choose API key or Desktop app for the current implementation. [G1, G5]'),
 h('5. Approve the connection with your developer'),
 bullets('Your developer runs the project\'s connection helper on the computer used for this setup session.', 'Open the generated Google link in a browser on that same computer. The localhost callback returns to the machine running the helper; forwarding the link to a phone or another computer will not finish the connection.', 'Sign in with the Google account chosen in step 2. Review the app name and Calendar permissions, then approve them if correct.', 'The browser should show "Calendar authorization complete". The developer securely stores the refresh token printed in the terminal.'),
 note('<b>If Google says the app is unverified or blocked:</b> pause and have the developer check the project, test-user list and verification requirements. Do not approve an unfamiliar app or permissions you do not recognise.'),
 p('<b>Checkpoint:</b> Client ID, client secret and refresh token are stored securely. Your Google password has not been shared.'),
]),
('Developer handoff', '03 / DEVELOPER / CONNECT THE WEBSITE', [
 h('Store these server-side settings'),
 table(['Setting', 'Value / purpose'], [
 ('GOOGLE_CLIENT_ID', 'The OAuth Web application client ID.'),
 ('GOOGLE_CLIENT_SECRET', 'The matching client secret. Confidential.'),
 ('GOOGLE_REFRESH_TOKEN', 'The token produced after Darryl approves access. Confidential.'),
 ('GOOGLE_CALENDAR_ID', 'Use primary for the authorised account\'s main calendar, or the chosen calendar\'s exact Calendar ID.'),
 ]),
 p('For another calendar, open Google Calendar settings, select that calendar and look under <b>Integrate calendar &gt; Calendar ID</b>. The authorised account needs permission to create events there. Use the ID, not its display name, public URL or private iCal feed. Keep the calendar private.'),
 h('Run the existing authorisation helper'),
 p('With Node.js and the project dependencies installed, put the client ID and secret in the project\'s ignored local <b>.env</b> file. From the project folder run:'),
 code('node --env-file=.env scripts/connect-google-calendar.js'),
 p('The helper listens on port 8765 and requests offline access. Store its output as GOOGLE_REFRESH_TOKEN; do not paste the token into chat, email, screenshots or this document. Close the setup terminal when finished. [G5]'),
 p('Add all four Google settings to the chosen deployment\'s server environment and redeploy. For this repository\'s intended Vercel hosting, use the project\'s environment variables. Do not prefix these settings with VITE_. Local .env values are not deployed automatically.'),
 h('Prepare a lasting connection'),
 p('External apps left in <b>Testing</b> receive Calendar refresh tokens that expire after seven days. Before launch, review <b>Audience &gt; Publishing status</b> and move to production when ready. Obtain a fresh token after changing status. Production status does not guarantee verification or permanent tokens. [G6]'),
 p('The developer must check Google\'s verification requirements, branding and privacy-policy needs. A setup where only Darryl authorises may qualify for an exception; do not assume the exception applies if other coaches will connect calendars. Complete any required review. [G7]'),
 h('Publish working hours separately'),
 p('Google Calendar removes busy periods from slots already published in the website database; it does not generate opening hours. Get Darryl\'s schedule, breaks and holidays, then publish one-hour slots. The current site displays UK time, requires at least 12 hours\' notice and lists availability within 60 days.'),
]),
('Check it together', '04 / DARRYL + DEVELOPER / FINISH & TROUBLESHOOT', [
 h('Connection acceptance checklist'),
 bullets('The developer confirms the deployed server can read busy times from the chosen calendar.', 'Publish a test slot and mark the same time Busy in that calendar. It must disappear from the website.', 'After clearing the test conflict, book using a test account with a valid test session credit. Exactly one credit must be used.', 'Confirm the appointment is on the correct calendar, at the correct UK time, with the intended customer email invited.', 'Confirm a customer cannot book the same slot twice and a calendar outage does not produce a false confirmation.'),
 h('Common problems'),
 table(['What you see', 'What to check'], [
 ('redirect_uri_mismatch', 'The Web client must contain exactly http://localhost:8765/callback - including the port and path.'),
 ('Callback cannot open', 'Keep the helper running; open the consent link on that same computer; check that port 8765 is free.'),
 ('Access denied', 'Correct Google account, test-user list, granted scopes and any Workspace administrator restrictions.'),
 ('It stopped after a week', 'Check External/Testing status, then re-authorise after the developer resolves production readiness.'),
 ('No available times', 'Check published slots, the 12-hour cutoff, busy events and calendar access. Connecting Google alone creates no slots.'),
 ]),
 note('<b>Ongoing use:</b> mark time off as Busy on the connected calendar. Tell your developer before revoking access or changing Google settings. Editing or deleting a Calendar event does not currently reschedule a website booking or return its credit.'),
 h('Official help'),
 source('G1 - Credential types and OAuth client setup', 'https://developers.google.com/workspace/guides/create-credentials'),
 source('G2 - Enable the Calendar API', 'https://developers.google.com/workspace/calendar/api/quickstart/go'),
 source('G3 - Consent screen, audience and scopes', 'https://developers.google.com/workspace/guides/configure-oauth-consent'),
 source('G4 - Calendar permissions', 'https://developers.google.com/workspace/calendar/api/auth'),
 source('G5 - Server-side OAuth and offline access', 'https://developers.google.com/identity/protocols/oauth2/web-server'),
 source('G6 - Refresh-token expiry', 'https://developers.google.com/identity/protocols/oauth2'),
 source('G7 - Verification and exceptions', 'https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification'),
]),
]

stripe = [
('Set up Stripe payments', '01 / DARRYL / BUSINESS ACCOUNT', [
 p('A walkthrough for DL Coaching. Customers will buy a single session or a package through Stripe Checkout. Once Stripe confirms payment to the website, the customer receives session credits and can book available times.'),
 note('<b>Start with a sandbox.</b> It lets you test without moving real money. Live payments stay off until the developer has verified payment, credits and booking together. [S1]'),
 h('Who does what'),
 table(['Darryl', 'Developer'], [
 ('Owns the Stripe account; enters business, identity and bank details directly into Stripe.', 'Connects the website, configures payment notifications and checks the full test flow.'),
 ('Approves the public business details, prices and cancellation/refund policy.', 'Stores secrets, switches the approved deployment to live mode and verifies configuration.'),
 ]),
 h('1. Create or open your business account'),
 p('Open <link href="https://dashboard.stripe.com/register" color="#0B6FD6">Stripe registration</link>, or sign in to your existing account. Use an email you control. Complete Stripe\'s account setup prompts with accurate business information and the correct country and business type. [S2]'),
 p('Have the business address, support contact, business description, payout bank information and any identity documents Stripe requests ready. Enter these yourself in Stripe; you do not need to send them to the developer. Complete any outstanding activation requirements before accepting real payments. [S2]'),
 h('2. Check what customers will see'),
 p('Review the business name, website, support details and statement descriptor in Stripe. Use details that customers will recognise as DL Coaching. Review receipt settings and confirm the business policies that will be published on the website. [S2]'),
 h('The prices this website uses'),
 table(['Offer', 'Sessions', 'One-off price'], [
 ('Single session', '1', '£45'), ('Starter', '4', '£150'),
 ('Transformation', '8', '£250'), ('Complete Transformation', '16', '£450'),
 ]),
 p('These are one-off GBP payments, not subscriptions. The current website creates the Checkout line items itself. You do not need to create Payment Links, recurring plans or separate Stripe products manually.'),
]),
('Connect the test environment', '02 / DARRYL + DEVELOPER / KEYS & NOTIFICATIONS', [
 h('3. Open a Stripe sandbox'),
 p('In Stripe\'s account picker, choose <b>Sandboxes</b>, then create or open a sandbox for DL Coaching. Stay inside that sandbox for both the key and webhook setup. Existing integrations may use test mode instead; do not mix keys and events from different environments. [S1]'),
 h('4. Store the secret API key'),
 p('Open the sandbox\'s <b>API keys</b> page (search for API keys if the menu differs). Copy its secret key, normally starting <b>sk_test_</b>, to the agreed secure secret store. The developer will set <b>STRIPE_SECRET_KEY</b>. This website does not need a publishable key for its hosted Checkout redirect. [S3]'),
 p('Keep secret keys out of WhatsApp, ordinary email, source code and screenshots. Use a password-manager secure share or enter them directly in the deployment environment with the developer. Darryl keeps ownership of the Stripe account.'),
 h('5. Create the payment notification destination'),
 p('A webhook is Stripe\'s message to the website confirming payment. The developer must first provide a deployed HTTPS address that can receive Stripe requests. Do not use the local preview address.'),
 p('In <b>Workbench &gt; Webhooks</b>, choose <b>Create an event destination</b>. Select <b>Your account</b>. For this handler, use snapshot events and an API version agreed with the developer. Select these two events only: [S4]'),
 code('checkout.session.completed\ncheckout.session.async_payment_succeeded'),
 p('Choose <b>Continue &gt; Webhook endpoint</b>. Enter the confirmed website address followed by the path below, then create the destination. Replace YOUR-CONFIRMED-DOMAIN; it is a placeholder. [S4]'),
 code('https://YOUR-CONFIRMED-DOMAIN/api/stripe-webhook'),
 p('Open the destination, reveal its signing secret, and securely store the <b>whsec_...</b> value as <b>STRIPE_WEBHOOK_SECRET</b>. This is a different secret from the API key. [S4]'),
 note('<b>Checkpoint:</b> the test API key, webhook and signing secret all belong to the same Stripe sandbox or test environment. The developer has deployed the settings before you try checkout.'),
]),
('Test, then go live', '03 / DARRYL + DEVELOPER / APPROVAL TO LAUNCH', [
 h('6. Make a test purchase through the website'),
 bullets('The developer provides the test website, connected to a separate test database/Auth environment. Test purchases must not create spendable credits in the live customer database.', 'Create a test customer account and choose Starter. Confirm Stripe displays £150 and the correct offer. Check that you are in the sandbox/test environment.', 'Use the test card below. After payment, return to the website and refresh if needed. Your balance should increase by exactly four credits.', 'Repeat for the other offers: one, eight and sixteen credits respectively. The developer checks successful webhook delivery and confirms that replaying a notification does not add credits again.'),
 code('Test card: 4242 4242 4242 4242\nExpiry: any future date   |   CVC: any three digits'),
 p('Use Stripe test cards only in the sandbox/test environment. Also test a decline using <b>4000 0000 0000 0002</b>; no credits should be awarded. [S5]'),
 p('Finish by booking a published slot with a test credit and confirming the Google Calendar event and invitation. Tell any test recipient in advance. Payment success by itself does not prove booking works.'),
 h('7. Switch to live only after the checks pass'),
 bullets('Darryl completes Stripe activation, payout-bank setup and any outstanding verification. Confirm support details, business policies and approved prices.', 'In the live Stripe account, create or obtain the live secret key (normally sk_live_). Store it securely when shown; newly created live secrets may only be displayed once. [S3]', 'Create the live webhook destination for the confirmed production domain, with the same two events. Store its own whsec_ signing secret; the test secret cannot be reused.', 'The developer sets the live keys only in Production, sets PUBLIC_SITE_URL to the exact live HTTPS origin, confirms the live database/Auth settings, then redeploys.', 'Darryl and the developer confirm the launch checklist is complete. Keep Preview and local development on test credentials and a test database.'),
 note('<b>Refunds need coordination.</b> The current website does not automatically remove credits or cancel bookings when a payment is refunded in Stripe. Darryl must coordinate the refund and account correction with the developer.'),
]),
('Developer handoff & help', '04 / DEVELOPER / CONFIGURATION & TROUBLESHOOTING', [
 h('Required server settings'),
 table(['Setting', 'What belongs here'], [
 ('STRIPE_SECRET_KEY', 'The secret API key for the selected test or live environment.'),
 ('STRIPE_WEBHOOK_SECRET', 'The signing secret for that environment\'s exact webhook endpoint.'),
 ('PUBLIC_SITE_URL', 'The confirmed HTTPS website origin, without a page path. Used for checkout return URLs.'),
 ]),
 p('Add settings to the intended hosting project and redeploy. Keep secrets server-side; never use a VITE_ prefix. Neon database/Auth must already work. For local API testing use <b>vercel dev</b>; the Vite preview alone cannot run the payment endpoints.'),
 h('Implementation checks specific to this website'),
 bullets('Use the website\'s actual Checkout flow to test fulfillment. A generic test event may lack the user and package metadata the handler requires.', 'The current Stripe SDK uses API version 2026-01-28.clover. Match the webhook version where available, or verify compatibility before choosing another version.', 'The webhook validates GBP and the exact package amount. Do not add discounts or tax on top of these amounts without updating and testing the payment validation.', 'A payment-return URL alone never awards credits. Only a signed, paid Checkout event can do that. A delayed webhook may require a page refresh.'),
 h('Common problems'),
 table(['What you see', 'What to check'], [
 ('Checkout will not open', 'Customer sign-in, deployed API routes, STRIPE_SECRET_KEY and PUBLIC_SITE_URL.'),
 ('Payment made; no credits', 'Workbench > Webhooks > Event deliveries, signing secret, metadata and database errors. Do not ask the customer to pay again.'),
 ('Webhook returns 400', 'Correct endpoint secret and raw-body signature verification; check test/live environment pairing.'),
 ('Webhook returns 401/403/404', 'Confirm the URL, route deployment and hosting protection. Stripe must reach this route; retain signature verification.'),
 ]),
 h('Official help'),
 source('S1 - Sandboxes and environment separation', 'https://docs.stripe.com/sandboxes'),
 source('S2 - Business account setup', 'https://docs.stripe.com/get-started/account/set-up'),
 source('S3 - API keys and secure storage', 'https://docs.stripe.com/keys'),
 source('S4 - Webhook setup and delivery logs', 'https://docs.stripe.com/webhooks'),
 source('S5 - Test cards and declines', 'https://docs.stripe.com/testing'),
]),
]

BLUE = colors.HexColor('#0B6FD6')
INK = colors.HexColor('#102237')
MUTED = colors.HexColor('#536477')
PALE = colors.HexColor('#EDF5FC')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='GuideTitle', fontName='Helvetica-Bold', fontSize=27, leading=31, textColor=INK, spaceAfter=14))
styles.add(ParagraphStyle(name='GuideEyebrow', fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=BLUE, spaceAfter=8))
styles.add(ParagraphStyle(name='GuideH', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=INK, spaceBefore=10, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name='GuideP', fontName='Helvetica', fontSize=10, leading=14, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name='GuideBullet', parent=styles['GuideP'], leftIndent=12, firstLineIndent=-10, spaceAfter=5))
styles.add(ParagraphStyle(name='GuideCell', parent=styles['GuideP'], fontSize=9, leading=12, spaceAfter=0))
styles.add(ParagraphStyle(name='GuideCode', fontName='Courier', fontSize=8.5, leading=12, textColor=INK, spaceAfter=0))
styles.add(ParagraphStyle(name='GuideSource', fontName='Helvetica', fontSize=8, leading=10.5, textColor=MUTED, spaceAfter=4))

class NumberedCanvas(canvas.Canvas):
    def __init__(self,*a,**kw):
        super().__init__(*a,**kw); self.states=[]
    def showPage(self):
        self.linkURL('https://www.dkdigitaldesigns.com/',(42,23,315,37),relative=0)
        self.states.append(dict(self.__dict__)); self._startPage()
    def save(self):
        total=len(self.states)
        for state in self.states:
            self.__dict__.update(state)
            self.setStrokeColor(colors.HexColor('#DCE5EE')); self.line(42,40,A4[0]-42,40)
            self.setFont('Helvetica',8); self.setFillColor(MUTED)
            self.drawString(42,27,'Built by: DK Digital  |  www.dkdigitaldesigns.com')
            self.drawRightString(A4[0]-42,27,f'{self._pageNumber} / {total}')
            super().showPage()
        super().save()

def make_table(headers, rows, width):
    # Keep setting identifiers on one line without squeezing their descriptions.
    if len(headers)==3: widths=[width*.54,width*.18,width*.28]
    elif headers[0]=='Setting': widths=[width*.43,width*.57]
    elif headers[0]=='What you see': widths=[width*.30,width*.70]
    else: widths=[width/2,width/2]
    data=[[Paragraph('<b>'+escape(x)+'</b>',styles['GuideCell']) for x in headers]]
    data += [[Paragraph(escape(x),styles['GuideCell']) for x in row] for row in rows]
    t=Table(data,colWidths=widths,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#DCE5EE'))]))
    return t

def plain(s):
    import html
    return html.unescape(re.sub('<[^>]+>','',s))

def hyperlink(paragraph, label, url):
    part=paragraph.part
    rid=part.relate_to(url,'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',is_external=True)
    tag=OxmlElement('w:hyperlink'); tag.set(qn('r:id'),rid)
    run=OxmlElement('w:r'); prop=OxmlElement('w:rPr'); col=OxmlElement('w:color'); col.set(qn('w:val'),'0B6FD6'); prop.append(col); run.append(prop)
    txt=OxmlElement('w:t'); txt.text=label; run.append(txt); tag.append(run); paragraph._p.append(tag)

def write_docx(name,pages):
    d=Document(); sec=d.sections[0]
    sec.page_width=Inches(8.27); sec.page_height=Inches(11.69)
    sec.top_margin=sec.bottom_margin=Inches(.65); sec.left_margin=sec.right_margin=Inches(.65)
    normal=d.styles['Normal']; normal.font.name='Calibri'; normal.font.size=Pt(10)
    normal.paragraph_format.space_after=Pt(6)
    for sty,size in [('Title',27),('Heading 1',12)]:
        d.styles[sty].font.name='Calibri'; d.styles[sty].font.size=Pt(size); d.styles[sty].font.color.rgb=RGBColor.from_string('102237')
    sec.header.paragraphs[0].text='DL COACHING / GOOGLE CALENDAR'
    hyperlink(sec.footer.paragraphs[0], 'Built by: DK Digital | www.dkdigitaldesigns.com', 'https://www.dkdigitaldesigns.com/')
    d.core_properties.author='DK Digital'
    d.core_properties.title=pages[0][0]+' | DL Coaching'
    for i,(title,eyebrow,blocks) in enumerate(pages):
        if i: d.add_page_break()
        d.add_paragraph(eyebrow,'Subtitle'); d.add_paragraph(title,'Title')
        for b in blocks:
            kind=b[0]
            if kind=='h': d.add_paragraph(b[1],'Heading 1')
            elif kind in ('p','note','code'):
                para=d.add_paragraph()
                position=0
                for match in re.finditer(r'<link href="([^"]+)"[^>]*>(.*?)</link>',b[1]):
                    para.add_run(plain(b[1][position:match.start()]))
                    hyperlink(para,plain(match[2]),match[1])
                    position=match.end()
                para.add_run(plain(b[1][position:]))
                if kind=='code':
                    for run in para.runs: run.font.name='Consolas'; run.font.size=Pt(9)
                if kind=='note':
                    for run in para.runs: run.bold=True
            elif kind=='bullets':
                for item in b[1]: d.add_paragraph(plain(item),'List Bullet')
            elif kind=='table':
                t=d.add_table(rows=1, cols=len(b[1])); t.style='Light Shading Accent 1'
                for cell,text in zip(t.rows[0].cells,b[1]): cell.text=text
                for row in b[2]:
                    for cell,text in zip(t.add_row().cells,row): cell.text=text
                d.add_paragraph()
            elif kind=='source': hyperlink(d.add_paragraph(),b[1],b[2])
    d.save(WORD/f'{name}.docx')

def write_pdf(name,pages):
    width=A4[0]-84; story=[]
    for i,(title,eyebrow,blocks) in enumerate(pages):
        if i: story.append(PageBreak())
        story += [Paragraph(eyebrow,styles['GuideEyebrow']),Paragraph(title,styles['GuideTitle'])]
        for b in blocks:
            kind=b[0]
            if kind in ('p','h'): story.append(Paragraph(b[1],styles['GuideP' if kind=='p' else 'GuideH']))
            elif kind=='bullets':
                for item in b[1]: story.append(Paragraph('• '+item,styles['GuideBullet']))
            elif kind=='table': story += [make_table(b[1],b[2],width),Spacer(1,7)]
            elif kind in ('note','code'):
                text=b[1] if kind=='note' else escape(b[1]).replace('\n','<br/>')
                t=Table([[Paragraph(text,styles['GuideP' if kind=='note' else 'GuideCode'])]],colWidths=[width])
                t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),.5,colors.HexColor('#D4E6F8')),('LEFTPADDING',(0,0),(-1,-1),11),('RIGHTPADDING',(0,0),(-1,-1),11),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
                story += [t,Spacer(1,8)]
            elif kind=='source':
                story.append(Paragraph(f'<link href="{b[2]}" color="#0B6FD6">{escape(b[1])}</link>',styles['GuideSource']))
    doc=SimpleDocTemplate(str(PDF/f'{name}.pdf'),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=42,bottomMargin=54,title=pages[0][0]+' | DL Coaching',author='DK Digital',subject='Darryl\'s Google Calendar setup checklist; prepared 22 September 2026')
    doc.build(story,canvasmaker=NumberedCanvas)

if __name__ == '__main__':
    for name,pages in [('google-calendar-setup-for-darryl',google),('stripe-setup-for-darryl',stripe)]:
        write_pdf(name,pages)
        write_docx(name,pages)
        print(name)
