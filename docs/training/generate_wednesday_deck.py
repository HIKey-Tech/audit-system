import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_wednesday_deck(output_path):
    prs = Presentation()
    # 16:9 Widescreen slides (13.333 x 7.5 inches)
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # IAMS System Color Palette (Exact Colors from frontend tailwind.config.ts)
    PRIMARY_GREEN = RGBColor(0, 135, 81)       # #008751 (System Primary Green)
    DARK_FOREST   = RGBColor(0, 56, 35)        # #003823 (Deep Green Header)
    ACCENT_MINT   = RGBColor(0, 166, 81)       # #00A651 (System Accent Green)
    LIGHT_BG_TINT = RGBColor(240, 253, 244)    # Emerald-50 tint
    DARK_TEXT     = RGBColor(15, 23, 42)       # Slate 900
    MUTED_TEXT    = RGBColor(71, 85, 105)      # Slate 600
    CARD_BG       = RGBColor(255, 255, 255)    # Clean White
    BORDER_COLOR  = RGBColor(203, 213, 225)    # Slate 300
    CRITICAL_RED  = RGBColor(220, 38, 38)      # #DC2626 (Danger Red)

    blank_layout = prs.slide_layouts[6]

    def add_header(slide, title_text, category_text, time_badge=""):
        # Top Header Bar in System Green
        bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(1.15))
        bar.fill.solid()
        bar.fill.fore_color.rgb = PRIMARY_GREEN
        bar.line.fill.background()

        # Accent line below banner
        stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(1.15), Inches(13.333), Inches(0.06))
        stripe.fill.solid()
        stripe.fill.fore_color.rgb = ACCENT_MINT
        stripe.line.fill.background()

        # Category Tracker Badge
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.12), Inches(8.5), Inches(0.3))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = RGBColor(229, 246, 236) # Pale Mint

        # Slide Main Title (Large, Bold, High Legibility)
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.38), Inches(9.8), Inches(0.65))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(24)
        p_title.font.bold = True
        p_title.font.color.rgb = RGBColor(255, 255, 255)

        # Time / Timing Badge
        if time_badge:
            badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.8), Inches(0.32), Inches(1.8), Inches(0.5))
            badge.fill.solid()
            badge.fill.fore_color.rgb = DARK_FOREST
            badge.line.fill.background()
            p_b = badge.text_frame.paragraphs[0]
            p_b.text = time_badge
            p_b.font.size = Pt(13)
            p_b.font.bold = True
            p_b.font.color.rgb = RGBColor(255, 255, 255)
            p_b.alignment = PP_ALIGN.CENTER

    def add_card(slide, left, top, width, height, title, items, is_highlight=False):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = LIGHT_BG_TINT if is_highlight else CARD_BG
        card.line.color.rgb = PRIMARY_GREEN if is_highlight else BORDER_COLOR
        card.line.width = Pt(2 if is_highlight else 1.5)

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.3)
        tf.margin_right = Inches(0.3)
        tf.margin_top = Inches(0.28)
        tf.margin_bottom = Inches(0.2)

        # Card Title (Large 18pt)
        p_title = tf.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(18)
        p_title.font.bold = True
        p_title.font.color.rgb = DARK_FOREST if is_highlight else PRIMARY_GREEN
        p_title.space_after = Pt(12)

        # Content Bullets (Large 14pt-15pt, Clear & Readable)
        for item in items:
            p = tf.add_paragraph()
            p.text = item
            p.font.size = Pt(14)
            p.font.color.rgb = DARK_TEXT
            p.space_after = Pt(8)

    def set_notes(slide, notes_text):
        tf = slide.notes_slide.notes_text_frame
        tf.text = notes_text

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = PRIMARY_GREEN
    bg1.line.fill.background()

    # White Title Card Box
    center_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(1.4), Inches(10.333), Inches(4.7))
    center_card.fill.solid()
    center_card.fill.fore_color.rgb = CARD_BG
    center_card.line.color.rgb = ACCENT_MINT
    center_card.line.width = Pt(3)

    tf1 = center_card.text_frame
    tf1.word_wrap = True
    tf1.margin_left = Inches(0.8)
    tf1.margin_right = Inches(0.8)
    tf1.margin_top = Inches(0.6)

    p1 = tf1.paragraphs[0]
    p1.text = "WEDNESDAY MASTER TRAINING · 60 MINS"
    p1.font.size = Pt(14)
    p1.font.bold = True
    p1.font.color.rgb = PRIMARY_GREEN
    p1.space_after = Pt(10)

    p2 = tf1.add_paragraph()
    p2.text = "The Full Audit Lifecycle: Execution, Gates & Governance"
    p2.font.size = Pt(32)
    p2.font.bold = True
    p2.font.color.rgb = DARK_FOREST
    p2.space_after = Pt(14)

    p3 = tf1.add_paragraph()
    p3.text = "Galaxy Backbone Limited — Internal Audit Management System (IAMS)"
    p3.font.size = Pt(17)
    p3.font.color.rgb = MUTED_TEXT
    p3.space_after = Pt(20)

    p4 = tf1.add_paragraph()
    p4.text = "Simulating the complete journey: Plan Item → Engagement Setup → Fieldwork Testing → Working Paper Approvals → 3-Tier Report Sign-Off → Finding Remediation & Automated Closure."
    p4.font.size = Pt(14)
    p4.font.color.rgb = DARK_TEXT

    set_notes(s1, """FACILITATOR OPENING SCRIPT (1 MINUTE):
"Welcome everyone to Wednesday's hands-on masterclass.
Yesterday, we built our planning foundation: we populated the Audit Universe, scored the Risk Register, registered operational Assets, explored the System Audit toolkit, and formally approved the FY2026 Audit Programme.
Today is the capstone: we execute a real audit from beginning to end with your own accounts in this room.
We will see how an engagement is created, how fieldwork is performed with cryptographic evidence, how working papers and findings are managed, how the 3-level executive report approval chain works, and how finding remediation closes the entire loop back to the audit universe.
Let's begin by understanding the rules of the system."
""")

    # =========================================================================
    # SLIDE 2: THE MAP — 4 APPROVAL GATES & THE "TWO BUTTONS" RULE
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "The Map: 4 Approval Gates & The 'Two Buttons' Rule", "Module 1: Authority Architecture", "5 Mins")

    add_card(s2, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "The 4 Immutable Approval Gates", [
                 "1. ANNUAL AUDIT PLAN (1 Level):",
                 "   • Signed off by CAE (plan:approve). Sets the departmental commitment.",
                 "",
                 "2. WORKING PAPERS (1 Level):",
                 "   • Approved specifically by the named Audit Manager for that engagement.",
                 "",
                 "3. AUDIT REPORT (3 Sequential Levels):",
                 "   • Level 1: Engagement Manager (content & scope).",
                 "   • Level 2: Director (report:approve:oversight).",
                 "   • Level 3: Chief Audit Executive (report:approve:final).",
                 "",
                 "4. FINDING CLOSURE (2-Step Gate):",
                 "   • Lead Auditor verifies remediation (followup:verify).",
                 "   • Engagement Manager approves formal closure."
             ])

    add_card(s2, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "The 'Two Buttons' Rule & Auto-Advancement", [
                 "ONLY TWO MANUAL FORWARD BUTTONS EXIST:",
                 "• Button 1: 'Start fieldwork' (planned → in_progress).",
                 "  Recorded by Lead or Manager. Instantly loads control checklist.",
                 "• Button 2: 'Issue report' (under_review → reported).",
                 "  Executed exclusively by CAE (report:issue). Makes findings official.",
                 "",
                 "THE SYSTEM AUTO-ADVANCES EVERYTHING ELSE:",
                 "• ⚙ To Under Review (QA): Advances automatically once ALL checklist items are tested AND ALL working papers approved.",
                 "• ⚙ To Reported: Advances automatically when report is issued.",
                 "• ⚙ To Closed: Advances automatically when the last open finding is approved closed — stamping last_audited_at on the universe!"
             ], is_highlight=True)

    set_notes(s2, """FACILITATOR SCRIPT FOR MODULE 1:
"Before we click anything, memorize this single principle:
In IAMS, human beings do not push audits forward with arbitrary status buttons.
Only TWO buttons in the entire lifecycle are manually pressed by a person:
1. 'Start fieldwork' — which starts the clock and loads the checklist.
2. 'Issue report' — which officially releases the report and triggers remediation.
Everything else in IAMS advances on its own through configurable GATES.
If you ever wonder 'Why is this audit stuck? Where is the button to send it to review?', there is NO button! Look at the 'What's Next' panel on your screen. It will tell you: '2 of 10 controls not yet tested' or '1 working paper awaiting manager approval'.
Once those conditions are met, the system moves itself into Quality Assurance."
""")

    # =========================================================================
    # SLIDE 3: ENGAGEMENT SETUP & FIELDWORK INITIATION
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Engagement Setup & Starting Fieldwork", "Module 2: Launching the Audit", "8 Mins")

    add_card(s3, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "1. Creation from Approved Plan Item", [
                 "SEAMLESS INHERITANCE (ZERO DUPLICATION):",
                 "• Select the approved Plan Item (e.g., 'Treasury Operations Audit').",
                 "• Auto-Inherited: Universe Entity, Audit Type (Financial), Priority.",
                 "",
                 "ASSIGNING REAL COLLEAGUES (THE CORE ROLES):",
                 "• Lead Auditor: Trainee leading day-to-day fieldwork (role: audit_lead).",
                 "• Audit Manager: Trainee supervising & approving papers (role: audit_manager).",
                 "• Auditee: Head of Department / Process Owner (role: auditee / staff).",
                 "• Supporting Auditor: Trainee assisting with audit tests (role: auditor).",
                 "",
                 "AUTOMATED ASSIGNMENT EMAIL & IN-APP ALERTS:",
                 "• Auditee immediately receives email explaining audit scope & cooperation.",
                 "• Lead, Manager & Team receive assignment emails with OLA target date."
             ])

    add_card(s3, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "2. Launching Fieldwork (Hands-On)", [
                 "CLICKING 'START FIELDWORK' (BUTTON 1):",
                 "1. Open the created engagement (Status: 'planned').",
                 "2. Review the team and linked asset (AST-001 Treasury System).",
                 "3. Click the prominent 'Start fieldwork' button in What's Next.",
                 "",
                 "WHAT THE SYSTEM EXECUTES IN ONE TRANSACTION:",
                 "• Status changes: planned → in_progress.",
                 "• Actual start date is stamped into the audit trail.",
                 "• Checklist Engine triggers: Auto-populates controls matching the audit type (ISO 27001, COBIT, Financial Regulations).",
                 "• 'What's Next' panel dynamically updates with checklist tests!"
             ], is_highlight=True)

    set_notes(s3, """FACILITATOR WALKTHROUGH INSTRUCTIONS (MODULE 2):
- Open IAMS as Audit Manager (or have the designated Audit Manager trainee log in with their real corporate account).
- Navigate to: Audit -> Plans -> Open the approved FY2026 Annual Plan.
- Find 'Treasury Operations' item -> Click 'Initialize Engagement'.
- In the wizard:
  - Lead Auditor: Select the Lead Auditor trainee sitting in the room.
  - Audit Manager: Select the Audit Manager trainee sitting in the room.
  - Auditee: Select the Auditee trainee (Department Head) sitting in the room.
  - Asset in scope: AST-001 (Treasury Management System)
  - Schedule: Set start date today, end date next month, OLA deadline.
- Click 'Create'. The engagement opens at status 'planned'.
- INSTRUCT TRAINEES: 'Check your email inboxes right now!'
  - Auditee sees: 'Internal Audit Notification: Treasury Operations — Treasury Operations Audit'.
  - Lead Auditor sees: 'Lead Auditor Assignment: Treasury Operations Audit' with OLA deadline.
  - Audit Manager sees: 'Audit Manager Assignment: Treasury Operations Audit'.
- Lead Auditor trainee opens the engagement on their screen and clicks 'Start fieldwork' (Button 1).
- Point out: Status changes to 'in_progress' and the Checklist tab auto-populates with controls!
""")

    # =========================================================================
    # SLIDE 4: FIELDWORK, EVIDENCE & WORKING PAPERS
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Fieldwork: Evidence, Checklists & Working Papers", "Module 3: Hands-On Execution", "17 Mins")

    add_card(s4, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "1. Evidence Requests & SHA-256 Seal", [
                 "REQUESTING EVIDENCE (PBC WORKFLOW):",
                 "• Lead Auditor clicks 'Request evidence' in the Evidence tab.",
                 "• System dispatches email & in-app alert to the assigned Auditee.",
                 "",
                 "AUDITEE UPLOAD EXPERIENCE:",
                 "• Auditee opens IAMS Home page -> sees 'What you need to do here'.",
                 "• Directly uploads requested document (Excel, Word, PDF).",
                 "",
                 "IMMUTABLE CRYPTOGRAPHIC SEAL:",
                 "• Auditor reviews and clicks 'Accept'.",
                 "• IAMS calculates & permanently stamps a SHA-256 hash.",
                 "• Guarantees file tamper-evidence for external oversight."
             ])

    add_card(s4, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "2. Working Papers & Quality Gate", [
                 "THE 5-STEP WORKING PAPER LIFECYCLE:",
                 "1. Authoring: Lead creates Working Paper (WP-01).",
                 "2. Submission: Creator submits for manager review.",
                 "3. Rejection / Feedback: Manager reviews and rejects with note:",
                 "   'Please attach sample test sheets for February variance.'",
                 "4. Resubmission: Lead updates content and clicks 'Resubmit'.",
                 "5. Approval: Manager clicks 'Approve' (or Approve-with-edit).",
                 "",
                 "⚙ THE AUTOMATIC QA ADVANCEMENT:",
                 "• When last control is tested AND all working papers approved:",
                 "• Engagement automatically jumps to 'under_review'!",
                 "• What's Next panel updates: 'Fieldwork complete — moving to QA'."
             ], is_highlight=True)

    set_notes(s4, """FACILITATOR DEMO SCRIPT (MODULE 3 - 17 MINS):
Guide the real trainees sitting in the room:
1. Lead Auditor Trainee:
   - On your laptop: Evidence Tab -> 'Request evidence' -> Title: 'Q1 Bank Reconciliations' -> Assign to Auditee trainee.
2. Auditee Trainee:
   - Check your IAMS screen and inbox. Notice the banner: 'What you need to do here'.
   - Open the request -> Upload sample reconciliation file (.xlsx or .pdf) -> Click Submit.
3. Lead Auditor Trainee:
   - Review uploaded file -> Click 'Accept'. Point out the SHA-256 cryptographic seal!
   - Checklist Tab -> Mark control failed -> Click 'Raise finding'. Fill in Condition and Recommendation -> Save.
   - ASK THE ROOM: 'Can the Auditee see this finding right now? NO! Draft findings remain strictly confidential to the audit team until the final report is formally issued.'
4. Working Papers Tab:
   - Lead Auditor creates WP-01 -> Click 'Submit'.
5. Audit Manager Trainee:
   - Open WP-01 -> Click 'Reject' -> Type: 'Please clarify sample testing methodology.'
   - Lead Auditor edits -> Click 'Resubmit'.
   - Audit Manager clicks 'Approve'.
6. POINT AT THE PROJECTOR: 'WATCH THE STATUS BADGE! It just turned to UNDER REVIEW automatically with NO button pressed!'
""")

    # =========================================================================
    # SLIDE 5: AUDIT REVIEW & 3-LEVEL EXECUTIVE APPROVAL CHAIN
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Audit Review & 3-Tier Executive Approval", "Module 4: Quality Assurance & Issuance", "12 Mins")

    add_card(s5, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "1. Report Auto-Assembly & Drafting", [
                 "ONE REPORT PER ENGAGEMENT (IN QA):",
                 "• Lead opens 'Report / Review' tab in the engagement.",
                 "• Auto-Assembled Content (Guaranteed 100% Alignment):",
                 "  • Executive Summary template.",
                 "  • Findings Summary Table: Grouped by Severity.",
                 "  • Assets in Scope Table: Auto-populated from scope.",
                 "  • Methodology and Sampling records.",
                 "• Zero manual copying between register and report!",
                 "",
                 "SUBMISSION FOR EXECUTIVE SIGN-OFF:",
                 "• Lead completes executive summary and clicks 'Submit review'.",
                 "• The 3-tier sequential approval chain activates instantly."
             ])

    add_card(s5, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "2. The 3-Tier Sign-off & Issuing (Button 2)", [
                 "SEQUENTIAL 3-TIER EXECUTIVE CHAIN (GATE 3):",
                 "1. Level 1 — Manager (Audit Manager Trainee):",
                 "   • Reviews full content -> Signs with signature image.",
                 "2. Level 2 — Director Oversight (Director Trainee):",
                 "   • Reviews risk alignment -> Signs Level 2.",
                 "3. Level 3 — CAE Final (Chief Audit Executive Trainee):",
                 "   • Final executive sign-off -> Approves Level 3.",
                 "",
                 "▶ ISSUING THE REPORT (BUTTON 2 — CAE ONLY):",
                 "• CAE clicks 'Issue report' (report:issue):",
                 "  • Report is permanently locked & branded PDF created.",
                 "  • Engagement advances to 'reported'.",
                 "  • Follow-up loop opens on every finding.",
                 "  • ✱ Auditee is notified and can NOW see findings!"
             ], is_highlight=True)

    set_notes(s5, """FACILITATOR SCRIPT FOR MODULE 4 (12 MINS):
"Now watch the review compile itself with ZERO typing:
1. Lead Auditor Trainee:
   - Open Report / Review tab. Point out how findings and assets were auto-populated without manual copying.
   - Click 'Submit review'.
2. Audit Manager Trainee:
   - Open Approvals Inbox -> Review report -> Sign and Approve (Level 1).
3. Director Trainee:
   - Notice Level 2 is ready for signature.
   - Point out: 'Could Director have approved Level 2 before Manager signed Level 1? No, the chain is strictly sequential.'
   - Sign and Approve Level 2.
4. CAE Trainee:
   - Approve Level 3.
   - Point out: 'The report status is Approved. Is it issued yet? NO! Approving confirms accuracy; issuing makes it official.'
5. The Second Button:
   - CAE clicks 'Issue report' (Button 2 in our lifecycle rule).
   - Status moves to 'reported'.
   - Download the generated PDF and show the cover page, findings matrix, and signature blocks."
""")

    # =========================================================================
    # SLIDE 6: REMEDIATION FOLLOW-UP & CLOSING THE LOOP
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Remediation Follow-up & The Closed Loop", "Module 5: Follow-up & Auto-Closure", "12 Mins")

    add_card(s6, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "1. Auditee Action & Auditor Verification", [
                 "THE VISIBILITY FLIP (REPORT ISSUED):",
                 "• Auditee trainee refreshes Findings -> Finding is now visible!",
                 "• Management Response:",
                 "  • Auditee enters corrective action plan & implementation date.",
                 "  • Status moves: open → management_response_received.",
                 "",
                 "REMEDIATION & PROOF UPLOAD:",
                 "• Auditee implements controls and uploads proof (e.g. policy/log).",
                 "• Status moves: in_remediation → pending_verification.",
                 "",
                 "VERIFICATION GATE (AUDITOR ONLY):",
                 "• Lead Auditor inspects evidence -> Clicks 'Verify'.",
                 "• Guardrail: Auditee CANNOT verify their own remediation!"
             ])

    add_card(s6, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "2. Closure Approval & Universe Re-stamping", [
                 "GATE 4: FORMAL FINDING CLOSURE SIGN-OFF:",
                 "• Lead Auditor requests closure of verified finding.",
                 "• Audit Manager approves closure in workflow inbox.",
                 "• Finding status updates to 'closed'.",
                 "",
                 "⚙ THE FINAL AUTOMATIC ENGAGEMENT CLOSURE:",
                 "• When the LAST open finding on the engagement is closed:",
                 "• Engagement status advances automatically: reported → closed!",
                 "• Actual end date stamped.",
                 "",
                 "CLOSING THE ENTERPRISE LOOP:",
                 "• System stamps last_audited_at on the Universe Entity!",
                 "• Directly feeds next year's annual plan risk calculation."
             ], is_highlight=True)

    set_notes(s6, """FACILITATOR SCRIPT FOR MODULE 5:
"An audit does not end when a report is issued. It ends when the risk is remediated.
Let's complete the cycle with the trainees:
1. Auditee Trainee:
   - Go to Findings -> Open the Treasury finding.
   - Notice: It is visible now! Type Management Response: 'Dual-authorization reconciliation implemented' -> Set target date -> Save.
   - Under Follow-up, upload a sample file as Remediation Proof.
2. Lead Auditor Trainee:
   - Open Follow-up tab -> Review the uploaded proof -> Click 'Verify Remediation'.
   - Point out: 'If Auditee tried to click verify, the system throws 403 Forbidden. Auditees cannot verify their own fixes.'
   - Click 'Request Closure'.
3. Audit Manager Trainee:
   - Approvals -> Finding Closure -> Click 'Approve Closure'.
4. Open the Engagement Overview on the main screen:
   - Point out: 'The engagement is now CLOSED! Look at actual end date — stamped today! Look at Treasury Operations in Audit Universe — last_audited_at is stamped today!'
The loop is completely closed."
""")

    # =========================================================================
    # SLIDE 7: FIVE THINGS TRAINEES ALWAYS GET WRONG
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Five Things Trainees Always Get Wrong & Guardrails", "Module 6: Governance & Traps", "6 Mins")

    add_card(s7, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Top Trainee Misconceptions (1 - 3)", [
                 "1. 'I HAVE THE PERMISSION, WHY CAN'T I APPROVE?'",
                 "   • Trainees forget Segregation of Duties (SoD).",
                 "   • Rule: You can NEVER approve what you submitted.",
                 "   • Creator of a WP / Report cannot be its approver.",
                 "",
                 "2. 'APPROVING THE REPORT ISSUES IT.'",
                 "   • Level 3 approval verifies technical completeness.",
                 "   • Only 'report:issue' (Button 2) formally issues report,",
                 "     locks data, and opens follow-up.",
                 "",
                 "3. 'AUDITEE CANNOT SEE DRAFT FINDINGS (A BUG?)'",
                 "   • Working papers & draft findings are STRICTLY CONFIDENTIAL",
                 "     to the audit team until final issuance."
             ])

    add_card(s7, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Misconceptions (4 - 5) & Auditee Architecture", [
                 "4. 'ENGAGEMENT IS STUCK — WHERE IS THE ADVANCE BUTTON?'",
                 "   • Human beings only press 2 buttons in the entire lifecycle!",
                 "   • Check 'What's Next' panel for pending tests or approvals.",
                 "",
                 "5. 'ROLE X CAN DO Y' (TEACH PERMISSIONS, NOT TITLES):",
                 "   • Roles are configurable permission bundles.",
                 "   • Teach the permission slugs: 'working_paper:create',",
                 "     'report:approve', 'followup:verify', 'report:issue'.",
                 "",
                 "KEY CONCEPT: HOW AUDITEE CONTEXT WORKS:",
                 "• Assigning an Auditee DOES NOT mutate their system role.",
                 "• IAMS uses Dynamic Contextual Scoping:",
                 "  Restricted from internal WPs; tailored Home banner & requests."
             ], is_highlight=True)

    set_notes(s7, """FACILITATOR SCRIPT FOR MODULE 6:
"Spend 6 minutes walking through these 5 traps. These are the exact questions trainees ask during UAT:
- Trap 1: When someone creates a working paper as Manager and tries to approve it, it fails. Why? SoD! Always have Lead create, Manager approve.
- Trap 2: Why are approving and issuing separate? Because the CAE might approve the draft on Monday, but wait until the Board Audit Committee convenes on Thursday to formally issue it.
- Trap 3: Auditees calling the helpline saying 'I can't see the finding my auditor talked about'. Explain that until the CAE issues the report, draft findings are confidential to the audit team.
- Question on Auditee: Explain clearly: When you assign a colleague as Auditee on Treasury, their user profile does NOT change to an 'auditee' role globally. Rather, the system scopes their session: on that engagement, they cannot see working papers or draft evidence, but on their home page, their findings and evidence requests appear automatically."
""")

    # =========================================================================
    # SLIDE 8: FACILITATOR RUNBOOK & ROLE-PLAY CHEAT SHEET
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Facilitator Runbook: Real Trainee Roles & Live Workflow", "Facilitator Cheat Sheet", "Reference")

    add_card(s8, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Real Trainee Setup (Roles & Permissions)", [
                 "1. LEAD AUDITOR TRAINEE (Role: audit_lead):",
                 "   • Permissions: working_paper:create, evidence:request,",
                 "     finding:create, followup:verify.",
                 "   • Duties: Starts fieldwork, tests controls, writes WPs, verifies fixes.",
                 "",
                 "2. AUDIT MANAGER TRAINEE (Role: audit_manager):",
                 "   • Permissions: engagement:create, working_paper:approve,",
                 "     report:approve (L1), finding:close.",
                 "   • Duties: Creates engagement, approves WPs, signs L1 report.",
                 "",
                 "3. SUPPORTING AUDITOR TRAINEE (Role: auditor):",
                 "   • Permissions: working_paper:create, evidence:upload.",
                 "   • Duties: Assigned to team, executes audit test procedures.",
                 "",
                 "4. AUDITEE TRAINEE (Dept Head / Business User):",
                 "   • Scoping: Dynamically granted when assigned as Auditee.",
                 "   • Duties: Receives audit email, uploads PBC docs, responds to findings.",
                 "",
                 "5. DIRECTOR / CAE TRAINEES (Roles: director / cae):",
                 "   • Permissions: report:approve (L2/L3), report:issue.",
                 "   • Duties: Signs oversight approvals; CAE formally issues report."
             ])

    add_card(s8, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Live Multi-Seat Classroom Choreography", [
                 "AUTOMATED ASSIGNMENT EMAIL NOTIFICATIONS:",
                 "• When Manager assigns colleagues, Auditee, Lead & Manager",
                 "  immediately receive emails with scope, schedule & login links!",
                 "",
                 "PHASE 1: START FIELDWORK & EVIDENCE (Seats A & C)",
                 "• Manager trainee creates engagement -> Lead clicks 'Start fieldwork'.",
                 "• Lead requests evidence -> Auditee checks inbox & uploads file.",
                 "",
                 "PHASE 2: WORKING PAPERS & AUTO-QA (Seats A & B)",
                 "• Lead creates WP-01 -> Manager rejects -> Lead resubmits -> Manager approves.",
                 "• System auto-advances engagement to Under Review!",
                 "",
                 "PHASE 3: 3-TIER APPROVAL & ISSUANCE (Seats B, D, E)",
                 "• Manager signs L1 -> Director signs L2 -> CAE signs L3 & clicks 'Issue report'!",
                 "",
                 "PHASE 4: REMEDIATION & FULL CLOSURE (Seats C, A, B)",
                 "• Auditee responds & uploads proof -> Lead verifies -> Manager closes.",
                 "• Engagement auto-closes & updates Audit Universe date!"
             ], is_highlight=True)

    set_notes(s8, """FACILITATOR RUNBOOK SUMMARY (KEEP ON YOUR PHONE):
How to choreograph the live classroom with real colleagues on their own accounts:
1. Pre-Session: In Settings -> Users, ensure your colleagues have their roles assigned:
   - Trainee A -> audit_lead
   - Trainee B -> audit_manager
   - Trainee C -> auditee (or regular employee)
   - Trainee D -> auditor
   - Trainee E -> director / cae
2. Engagement Creation: Have Manager trainee initialize the engagement from Plan, selecting Trainees A, B, and C by name.
3. Observe live: Point out that Trainee C (Auditee) gets an automated notification email right then in the room!
4. Call on each trainee in sequence to perform their role from their own laptops.
5. Watch the system automations trigger live without manual status overrides!
6. End on the Audit Universe page showing the newly updated 'Last Audited Date'."""
)

    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == "__main__":
    out = "Wednesday_Training_Full_Audit_Lifecycle.pptx"
    if len(sys.argv) > 1:
        out = sys.argv[1]
    create_wednesday_deck(out)
