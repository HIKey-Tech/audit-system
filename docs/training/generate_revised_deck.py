import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck(output_path):
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

    # Dark Forest accent stripe
    accent_bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(4.5), Inches(13.333), Inches(0.12))
    accent_bar.fill.solid()
    accent_bar.fill.fore_color.rgb = DARK_FOREST
    accent_bar.line.fill.background()

    tb = s1.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.3), Inches(2.6))
    tf1 = tb.text_frame
    tf1.word_wrap = True

    p0 = tf1.paragraphs[0]
    p0.text = "GALAXY BACKBONE LIMITED — INTERNAL AUDIT MANAGEMENT SYSTEM (IAMS)"
    p0.font.size = Pt(15)
    p0.font.bold = True
    p0.font.color.rgb = RGBColor(220, 252, 231) # Mint light
    p0.space_after = Pt(12)

    p1 = tf1.add_paragraph()
    p1.text = "Tuesday: Planning Inputs & Specialist Toolkits"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = RGBColor(255, 255, 255)
    p1.space_after = Pt(12)

    p2 = tf1.add_paragraph()
    p2.text = "Standard Operating Guide for the Internal Audit Department (1-Hour Masterclass)"
    p2.font.size = Pt(20)
    p2.font.color.rgb = RGBColor(226, 232, 240)

    # Sub-box
    tb_sub = s1.shapes.add_textbox(Inches(1.0), Inches(5.0), Inches(11.3), Inches(1.8))
    tf_sub = tb_sub.text_frame
    p_meta1 = tf_sub.paragraphs[0]
    p_meta1.text = "🎯 Purpose: Setting up the auditable entities, risks, assets, sampling, and controls that we audit tomorrow."
    p_meta1.font.size = Pt(15)
    p_meta1.font.bold = True
    p_meta1.font.color.rgb = RGBColor(255, 255, 255)
    p_meta1.space_after = Pt(6)

    p_meta2 = tf_sub.add_paragraph()
    p_meta2.text = "⏱️ Duration: 60 Minutes | Audience: Internal Auditors, Audit Managers, Head of Audit (CAE)"
    p_meta2.font.size = Pt(14)
    p_meta2.font.color.rgb = RGBColor(203, 213, 225)

    set_notes(s1, """FACILITATOR OPENING SCRIPT (1 MINUTE):
"Good morning colleagues. Today is Tuesday, and our focus is 'Planning Inputs and the Specialist Toolkits.'
As professional auditors, we know that an audit is only as good as its planning.
In IAMS, our annual audit plan and fieldwork rely directly on:
1. The Audit Universe (what exists to audit)
2. The Risk Register & 5x5 Heat Map (what threatens the business)
3. Assets & Custodian Attestations (the systems and infrastructure we test)
4. Standard Controls & Statistical Sampling
5. Specialist System Audit tools (Data Analytics, Access Reviews, Security Testing)
6. Forensic Integrity & Programme Approvals.

Everything we create in today's 60-minute session will be directly audited in Wednesday's fieldwork session."
""")

    # =========================================================================
    # SLIDE 2: TODAY'S 5 AUDIT DELIVERABLES
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Today's Agenda: 5 Operational Audit Milestones", "Master Training Schedule", "Total: 60 Min")

    add_card(s2, Inches(0.8), Inches(1.5), Inches(5.6), Inches(2.6),
             "1. Universe, Risks & Assets (15 Min)", [
                 "• Audit Universe: Mapping departmental boundaries & frequency.",
                 "• 5x5 Risk Scoring & Heat Map: Prioritizing Critical risks.",
                 "• Asset Registry & Attestation: Preventing ghost assets.",
                 "• Live Build: 'Treasury Operations', Risk (Score 20), AST-001."
             ])

    add_card(s2, Inches(6.8), Inches(1.5), Inches(5.6), Inches(2.6),
             "2. Controls, Sampling & Evidence (10 Min)", [
                 "• Control Library: Standardizing NDPR, ISO 27001, Financial tests.",
                 "• 3 Audit Modules: System/IT, Financial, and Compliance tracks.",
                 "• Statistical Sampling: Defensible sample sizes vs auditor guesswork.",
                 "• Evidence Vault: Eliminating lost email attachments."
             ])

    add_card(s2, Inches(0.8), Inches(4.35), Inches(5.6), Inches(2.7),
             "3. Specialist System Audit Toolkit (20 Min)", [
                 "• Data Analytics: Automated rule scans on population CSVs.",
                 "• User Access Review (UAR): Run -> Decide -> Justify -> Sign off.",
                 "• Security Testing SoD: Why test coordinators cannot self-approve.",
                 "• Continuous Monitoring: Catching exceptions between annual audits."
             ])

    add_card(s2, Inches(6.8), Inches(4.35), Inches(5.6), Inches(2.7),
             "4 & 5. Oversight & Programme Sign-Off (15 Min)", [
                 "• Board Committee Pack: 1-Click Executive PDF with risk charts.",
                 "• Cryptographic Hash Chain: Proving zero database tampering.",
                 "• IMOC Integration: Ingesting incident tickets as audit evidence.",
                 "• FY2026 Programme Approval: Submit -> CAE Reject -> Resubmit -> Approve. (Ready for Wednesday)."
             ], is_highlight=True)

    set_notes(s2, """TIMING & STRUCTURE:
- Emphasize to the class that each module directly reflects their actual day-to-day audit responsibilities.
- The first 25 minutes set up the audit foundation.
- The next 20 minutes cover technical IT audit tools.
- The final 15 minutes demonstrate executive board reporting and formal plan approval.
""")

    # =========================================================================
    # SLIDE 3: MODULE 1: UNIVERSE, RISKS & ASSETS
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Audit Universe, 5x5 Risk Scoring & Asset Attestation", "Module 1: Planning Inputs", "15 Minutes")

    add_card(s3, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "How the Audit Department Uses This", [
                 "1. AUDIT UNIVERSE (The Boundary):",
                 "   • Master directory of every auditable department, process, and system.",
                 "   • Sets audit frequency (Annual, Quarterly) so high-risk entities are never overlooked during annual planning.",
                 "",
                 "2. RISK REGISTER & 5x5 HEAT MAP (The Compass):",
                 "   • Professional auditing is risk-based: we prioritize audit resources where risks are Critical (Likelihood x Impact >= 20).",
                 "   • Eliminates subjective opinions: provides mathematical risk justification to executive leadership and the Board.",
                 "",
                 "3. ASSET REGISTRY & ATTESTATION (The Reality Check):",
                 "   • Technical applications (like payment systems) drive financial loss.",
                 "   • Auditee Attestation forces business owners to certify that the asset is active and ratings are accurate before we audit it."
             ])

    add_card(s3, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Live System Walkthrough (Hands-On)", [
                 "STEP 1: CREATE AUDIT UNIVERSE ENTITY",
                 "• Navigate: Audit Modules -> Audit Universe -> '+ New Entity'",
                 "• Name: Treasury Operations | Category: Department",
                 "• Owner: Chisom Okafor (Auditee) | Frequency: Annual -> Save.",
                 "",
                 "STEP 2: LOG CRITICAL RISK ON THE HEAT MAP",
                 "• Navigate: Risk Register -> '+ New Risk'",
                 "• Title: Unauthorised payment release | Category: Financial",
                 "• Entity: Treasury Operations | Owner: Ibrahim Musa",
                 "• Likelihood: 4 (Likely) x Impact: 5 (Catastrophic) = Score: 20 (Critical)",
                 "• Switch to 'Heat Map' tab: Point out the top-right red cell!",
                 "",
                 "STEP 3: REGISTER ASSET & COMPLETE ATTESTATION",
                 "• Navigate: Assets -> Asset Registry -> '+ New Asset'",
                 "• Tag: AST-001 | Name: Treasury Payment System | Owner: Chisom",
                 "• Open AST-001 -> 'Attestations' tab -> Click 'Attest Asset' -> Confirmed."
             ], is_highlight=True)

    set_notes(s3, """FACILITATOR SCRIPT FOR MODULE 1:
"Why do we need the Universe, Risk Register, and Assets together?
Because tomorrow morning, when we launch our audit engagement, we don't start with a blank screen.
We will audit 'Treasury Operations', focusing on the risk of 'Unauthorised payment release', and testing the controls on asset 'AST-001'.
Notice the Attestation: When Chisom Okafor attests AST-001 as 'Confirmed', she takes legal responsibility for the asset inventory. That is standard audit evidence."
""")

    # =========================================================================
    # SLIDE 4: MODULE 2: CONTROLS, SAMPLING & EVIDENCE
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Control Library, Testing Tracks & Scientific Sampling", "Module 2: Standards & Testing", "10 Minutes")

    add_card(s4, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "How the Audit Department Uses This", [
                 "1. STANDARDIZED CONTROL LIBRARY:",
                 "   • Eliminates individual auditor bias: standardizes testing procedures across NDPR, ISO 27001, and Financial Regulations.",
                 "   • Coverage Tracking: Displays which corporate controls were tested this year, highlighting organizational blind spots.",
                 "",
                 "2. THE 3 AUDIT TRACKS (Modules):",
                 "   • System/IT Audit: Cybersecurity, Active Directory, server configs.",
                 "   • Financial Audit: Treasury, General Ledger, procurement vouchers.",
                 "   • Compliance Audit: Statutory mandates and regulatory directives.",
                 "",
                 "3. DETERMINISTIC STATISTICAL SAMPLING:",
                 "   • External regulators (CBN, Auditor-General) reject arbitrary samples.",
                 "   • IAMS uses seeded algorithms (Random, Interval, High-Value) so any sample can be scientifically defended and reproduced."
             ])

    add_card(s4, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Live System Walkthrough (Hands-On)", [
                 "STEP 1: BROWSE THE CONTROL LIBRARY",
                 "• Navigate: Compliance Frameworks -> Controls.",
                 "• Filter by: 'ISO 27001' and 'NDPR'.",
                 "• Open: 'Dual Authorization on Payments' (FIN-CTL-01).",
                 "• Point out the Pre-defined Test Procedure & Coverage Gauge.",
                 "",
                 "STEP 2: RUN STATISTICAL SAMPLING",
                 "• Open an Engagement -> Sampling Tab.",
                 "• Method: High-Value Threshold (> ₦5,000,000 = 100% testing) + Simple Random for remaining population.",
                 "• Input Sample Calculator: 95% Confidence, 1% Expected Deviation.",
                 "• Click 'Draw Sample' -> Generates reproducible sample workpaper.",
                 "",
                 "STEP 3: CENTRAL EVIDENCE REPOSITORY",
                 "• Navigate: Evidence Repository -> Show central indexing of all receipts and logs by Engagement, Auditee, and SHA-256 Hash."
             ], is_highlight=True)

    set_notes(s4, """FACILITATOR SCRIPT FOR MODULE 2:
"In traditional auditing, an auditor might pick 10 invoices that they like. An auditee or external regulator can challenge that.
With IAMS deterministic sampling, the mathematics are documented directly in the workpaper: confidence level, tolerable error rate, and seed formula.
Furthermore, all evidence uploaded flows into the Central Evidence Repository, ending lost emails and missing receipts."
""")

    # =========================================================================
    # SLIDE 5: MODULE 3A: SYSTEM AUDIT DATA ANALYTICS
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Specialist System Audit: Automated Data Analytics", "Module 3A: Technical Toolkit", "10 Minutes")

    add_card(s5, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "How the Audit Department Uses This", [
                 "1. AUTOMATED EXCEPTION DETECTION:",
                 "   • Audit teams cannot manually review 5,000 Active Directory accounts or 100,000 transaction rows by eye.",
                 "   • IAMS Data Analytics executes pre-built compliance rule packs against raw system dumps in seconds.",
                 "",
                 "2. CORE RULE PACKS IN IAMS:",
                 "   • Dormant Privileged Accounts: Users with administrative rights who haven't logged in for >90 days.",
                 "   • Departed Staff with Active Access: Cross-checks HR termination lists with live Active Directory accounts.",
                 "   • Segregation of Duties (SoD) Conflicts: Identifies users holding conflicting roles (e.g. Initiator AND Approver).",
                 "",
                 "3. SEAMLESS AUDIT ACTION:",
                 "   • Flagged exceptions feed directly into working papers and User Access Reviews without re-keying data."
             ])

    add_card(s5, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Live System Walkthrough (Hands-On)", [
                 "STEP 1: LAUNCH NEW ANALYSIS RUN",
                 "• Navigate: System Audit -> Analytics.",
                 "• Click: '+ New Analysis Run'.",
                 "• Analysis Type: 'User Access Listing'.",
                 "",
                 "STEP 2: INGEST DATASET & SELECT RULE PACKS",
                 "• Source: Upload sample population CSV (e.g. `gbb_staff_ad_dump.csv`).",
                 "• Select Rule Packs:",
                 "   ☑ Privileged Account Scanning",
                 "   ☑ Dormancy Check (>90 days inactive)",
                 "   ☑ Terminated Staff Conflict Check",
                 "• Click: 'Run Analysis'.",
                 "",
                 "STEP 3: EVALUATE RESULTS & RAISE EXCEPTIONS",
                 "• Review the Analysis Dashboard: Total Processed vs Exceptions.",
                 "• Inspect flagged high-risk accounts.",
                 "• Click: 'Convert Exceptions to Access Review Worklist'."
             ], is_highlight=True)

    set_notes(s5, """FACILITATOR SCRIPT FOR MODULE 3A:
"Notice how fast this is. In traditional audits, auditors spent 3 weeks writing VLOOKUP formulas in Excel.
In IAMS, the auditor uploads the raw system extract, selects the standardized rule pack, and gets verified exceptions immediately.
These exceptions become our formal audit findings."
""")

    # =========================================================================
    # SLIDE 6: MODULE 3B: ACCESS REVIEWS & SECURITY TESTING
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Access Reviews & Security Testing Controls", "Module 3B: Technical Toolkit", "10 Minutes")

    add_card(s6, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "How the Audit Department Uses This", [
                 "1. USER ACCESS REVIEW (UAR):",
                 "   • Mandatory compliance control under ISO 27001 & NDPR.",
                 "   • The 4-Step Cycle: Run -> Decide -> Justify -> Sign Off.",
                 "   • CODE ENFORCEMENT: If an auditor or manager selects 'Revoke' or 'Modify', the system strictly forces a written justification before submission.",
                 "",
                 "2. SECURITY TESTING (Penetration Testing):",
                 "   • Penetration tests involve deliberate intrusive attacks that could impact Galaxy Backbone's national network infrastructure.",
                 "   • STRICT SEGREGATION OF DUTIES (SoD):",
                 "     The test coordinator/creator CANNOT authorize their own test!",
                 "     An independent authority (CAE or Director) must review and approve."
             ])

    add_card(s6, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Live System Walkthrough (Hands-On)", [
                 "STEP 1: EXECUTE USER ACCESS REVIEW",
                 "• Navigate: System Audit -> Access Reviews -> Open Active Run.",
                 "• Account 1 (Active Controller): Select 'Appropriate'.",
                 "• Account 2 (Ex-Contractor): Select 'Revoke'.",
                 "   ⚠️ Test: Try saving without a note -> Form blocks you with:",
                 "   'Say what access should be removed or changed'.",
                 "   Enter justification note -> Save -> Click 'Complete & Sign Off'.",
                 "",
                 "STEP 2: PLAN SECURITY TEST & TEST SoD BLOCK",
                 "• Navigate: System Audit -> Security Testing -> '+ New Test'.",
                 "• Scope: 'External DMZ 197.159.79.0/24' | Coordinator: Adaeze.",
                 "• Click 'Create Test' (Status: Planned).",
                 "• ⚠️ Try to click 'Authorise Test' as Adaeze -> System throws:",
                 "   'Forbidden: Test must be authorised by someone other than creator'.",
                 "• Switch user to CAE (Fatima) -> Click 'Authorise Test' -> Authorised!"
             ], is_highlight=True)

    set_notes(s6, """FACILITATOR SCRIPT FOR MODULE 3B:
"Look at the discipline built into IAMS:
First, a manager cannot just arbitrarily revoke access without documenting an audit reason. The code enforces it.
Second, an auditor cannot secretly launch a penetration test on government servers. The segregation of duties rule blocks self-authorization.
This protects both the organization and the audit department."
""")

    # =========================================================================
    # SLIDE 7: MODULE 4: OVERSIGHT, HASH CHAINS & IMOC
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Executive Oversight, Forensic Chains & IMOC Integration", "Module 4: Oversight & Forensics", "10 Minutes")

    add_card(s7, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "How the Audit Department Uses This", [
                 "1. BOARD AUDIT COMMITTEE PACK (PDF):",
                 "   • Generates the formal Board Audit Committee report in 1 click.",
                 "   • Automatically pulls engagement completion rates, overdue findings aging (<30, 30-90, >90 days), and top enterprise risks.",
                 "",
                 "2. CRYPTOGRAPHIC HASH-CHAIN AUDIT LOGS:",
                 "   • How do we prove audit independence to regulators?",
                 "   • Every user action writes a JSON log with Before/After diffs, sealed using SHA-256 blockchain-style chaining (row_hash = SHA256(prev_hash + data)).",
                 "   • If a DBA tampers with an audit finding in the database, the chain breaks! 'Verify Chain' proves 100% record integrity.",
                 "",
                 "3. IMOC ITSM INTEGRATION: Pulls live incident tickets as evidence."
             ])

    add_card(s7, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Live System Walkthrough (Hands-On)", [
                 "STEP 1: GENERATE COMMITTEE PACK (PDF)",
                 "• Navigate: Analytics in sidebar.",
                 "• Point out KPI cards: Engagement progress & Aging buckets.",
                 "• Click top-right button: 'Committee pack (PDF)'.",
                 "• Open downloaded PDF: Show executive charts & risk heatmaps.",
                 "",
                 "STEP 2: VERIFY FORENSIC HASH CHAIN",
                 "• Navigate: Audit Logs.",
                 "• Open any log entry: Show side-by-side 'Before' and 'After' JSON diffs.",
                 "• Click: 'Verify Chain Integrity'.",
                 "• Point out verification badge: 'Chain verified: 0 broken links.'",
                 "",
                 "STEP 3: IMOC INCIDENT TICKET INGESTION",
                 "• Navigate: Integrations -> IMOC -> Filter by 'SLA Breached'.",
                 "• Click: 'Capture as Evidence' -> Attaches directly to audit!"
             ], is_highlight=True)

    set_notes(s7, """FACILITATOR SCRIPT FOR MODULE 4:
"In traditional audit departments, preparing the quarterly Board Audit Committee pack took 2 weeks of manual PowerPoint formatting.
In IAMS, clicking 'Committee pack (PDF)' compiles real-time data across all engagements in seconds.
And look at the Audit Logs: When an external regulator asks 'Can your database administrator tamper with audit findings?', we click 'Verify Chain Integrity'. The SHA-256 cryptographic proof proves mathematically that no record has been altered."
""")

    # =========================================================================
    # SLIDE 8: MODULE 5: FY2026 AUDIT PROGRAMME APPROVAL
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "The FY2026 Audit Programme Lifecycle & Tomorrow's Fieldwork", "Module 5: Grand Finale", "5 Minutes")

    add_card(s8, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "The 4-Step Approval Lifecycle", [
                 "STEP 1: MANAGER CREATES & SUBMITS",
                 "• Log in as Manager (Adaeze Okonkwo).",
                 "• Go to: Audit Modules -> Audit Plans / Programmes -> '+ New Programme'.",
                 "• Title: FY 2026 Financial Audit Programme | Year: 2026 | Type: Financial.",
                 "• Add Plan Item: Select 'Treasury Operations' (Created in Module 1!).",
                 "• Click: 'Submit for Approval' -> Status: 'Submitted'.",
                 "",
                 "STEP 2: CAE REJECTS WITH AUDIT FEEDBACK",
                 "• Switch user to CAE (Fatima Bello).",
                 "• Open programme -> Click 'Reject' -> Reason:",
                 "  'Please adjust planned schedule to align with Q4 financial close.'",
                 "• Status changes to 'Rejected' (shown in red).",
                 "",
                 "STEP 3: MANAGER RESUBMITS & CAE APPROVES",
                 "• Manager sees red rejection banner -> Clicks 'Submit for Approval'.",
                 "• CAE clicks 'Approve & Sign' -> Draws legal signature -> Approved!"
             ])

    add_card(s8, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "The Punchline: What We Audit Tomorrow", [
                 "🎉 CONGRATULATIONS: TUESDAY COMPLETE!",
                 "",
                 "In 60 minutes today, we have configured every foundational input in IAMS:",
                 "✅ Auditable Entity: Treasury Operations",
                 "✅ Critical Risk: Unauthorised payment release (Score 20)",
                 "✅ Attested Asset: AST-001 (Treasury Payment System)",
                 "✅ Testing Benchmarks: Controls, Sampling, Analytics, UAR",
                 "✅ Approved Plan: FY 2026 Financial Audit Programme",
                 "",
                 "🚀 TOMORROW (WEDNESDAY): FIELDWORK TO REPORT",
                 "• We launch the live engagement for Treasury Operations.",
                 "• We test controls on AST-001 and request evidence.",
                 "• We raise formal audit findings for unauthorized payments.",
                 "• We draft and sign working paper WP-01.",
                 "• We issue the signed Galaxy Backbone Audit Report!",
                 "",
                 "👉 'This approved programme is what we audit tomorrow!'"
             ], is_highlight=True)

    set_notes(s8, """FACILITATOR CLOSING SCRIPT (1 MINUTE):
"Colleagues, observe what we have built:
We did not just learn software features; we executed the formal governance lifecycle of an internal audit department.
The Audit Programme was submitted, challenged by the CAE, revised, and digitally signed.
Treasury Operations is now locked into the approved FY 2026 plan.
Tomorrow morning, we open the engagement for Treasury Operations, execute fieldwork on AST-001, test the risk of unauthorized payments, and issue the final GBB audit report.
Thank you everyone, and see you tomorrow morning!"
""")

    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else "Tuesday_Training_Planning_Inputs_and_Specialist_Toolkits.pptx"
    create_deck(out)
