import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_deck(output_path):
    prs = Presentation()
    # 16:9 Widescreen slides
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Theme colors
    PRIMARY = RGBColor(0, 48, 135)       # Galaxy Navy #003087
    SECONDARY = RGBColor(79, 98, 40)     # GBB Olive #4F6228
    ACCENT = RGBColor(202, 138, 4)       # Gold #CA8A04
    DARK_TEXT = RGBColor(15, 23, 42)     # Slate 900
    MUTED_TEXT = RGBColor(71, 85, 105)   # Slate 600
    BG_LIGHT = RGBColor(248, 250, 252)   # Slate 50
    CARD_BG = RGBColor(255, 255, 255)
    BORDER_COLOR = RGBColor(226, 232, 240)
    CRITICAL_RED = RGBColor(225, 29, 72)

    blank_layout = prs.slide_layouts[6] # Blank slide

    def add_header(slide, title_text, category_text, time_badge=""):
        # Top banner background
        top_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(1.15))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = PRIMARY
        top_bar.line.fill.background()

        # Accent thin stripe
        stripe = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(1.15), Inches(13.333), Inches(0.08))
        stripe.fill.solid()
        stripe.fill.fore_color.rgb = SECONDARY
        stripe.line.fill.background()

        # Category / Module label
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.12), Inches(8), Inches(0.3))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(10)
        p_cat.font.bold = True
        p_cat.font.color.rgb = ACCENT

        # Title text
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.38), Inches(9.5), Inches(0.65))
        tf_title = title_box.text_frame
        tf_title.word_wrap = True
        p_title = tf_title.paragraphs[0]
        p_title.text = title_text
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = RGBColor(255, 255, 255)

        # Time badge if provided
        if time_badge:
            badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.8), Inches(0.32), Inches(1.8), Inches(0.5))
            badge.fill.solid()
            badge.fill.fore_color.rgb = SECONDARY
            badge.line.fill.background()
            p_badge = badge.text_frame.paragraphs[0]
            p_badge.text = time_badge
            p_badge.font.size = Pt(12)
            p_badge.font.bold = True
            p_badge.font.color.rgb = RGBColor(255, 255, 255)
            p_badge.alignment = PP_ALIGN.CENTER

    def add_card(slide, left, top, width, height, title, items, badge=""):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        card.line.width = Pt(1.5)

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.25)
        tf.margin_right = Inches(0.25)
        tf.margin_top = Inches(0.25)
        tf.margin_bottom = Inches(0.2)

        # Title paragraph
        p_title = tf.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(15)
        p_title.font.bold = True
        p_title.font.color.rgb = PRIMARY
        p_title.space_after = Pt(10)

        # Bullet paragraphs
        for item in items:
            p = tf.add_paragraph()
            p.text = "• " + item
            p.font.size = Pt(11.5)
            p.font.color.rgb = DARK_TEXT
            p.space_after = Pt(6)

    def set_notes(slide, notes_text):
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes_text

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = PRIMARY
    bg1.line.fill.background()

    # Decorative olive banner
    bar1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(4.5), Inches(13.333), Inches(0.12))
    bar1.fill.solid()
    bar1.fill.fore_color.rgb = SECONDARY
    bar1.line.fill.background()

    tb = s1.shapes.add_textbox(Inches(1.2), Inches(1.6), Inches(11), Inches(2.5))
    tf = tb.text_frame
    tf.word_wrap = True
    p0 = tf.paragraphs[0]
    p0.text = "GALAXY BACKBONE LIMITED — INTERNAL AUDIT MANAGEMENT SYSTEM (IAMS)"
    p0.font.size = Pt(14)
    p0.font.bold = True
    p0.font.color.rgb = ACCENT
    p0.space_after = Pt(14)

    p1 = tf.add_paragraph()
    p1.text = "Tuesday: Planning Inputs & Specialist Toolkits"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.color.rgb = RGBColor(255, 255, 255)
    p1.space_after = Pt(12)

    p2 = tf.add_paragraph()
    p2.text = "Complete 60-Minute Facilitator Guide & Interactive Hands-on Walkthrough"
    p2.font.size = Pt(18)
    p2.font.color.rgb = RGBColor(226, 232, 240)

    tb_sub = s1.shapes.add_textbox(Inches(1.2), Inches(5.0), Inches(10), Inches(1.5))
    tf_sub = tb_sub.text_frame
    p_meta1 = tf_sub.paragraphs[0]
    p_meta1.text = "Target Duration: 60 Minutes | Mode: Interactive Demonstration + Live System Practice"
    p_meta1.font.size = Pt(13)
    p_meta1.font.bold = True
    p_meta1.font.color.rgb = RGBColor(255, 255, 255)

    p_meta2 = tf_sub.add_paragraph()
    p_meta2.text = "Key Focus: Setting up foundational universe entities, risk assessment, asset attestations, audit sampling, access reviews, forensic hash chains, and programme approvals."
    p_meta2.font.size = Pt(12)
    p_meta2.font.color.rgb = RGBColor(203, 213, 225)

    set_notes(s1, """TRAINER WELCOME & OPENING (1 MINUTE):
"Good morning everyone. Welcome to Tuesday's IAMS training session. 
Today is all about 'Planning Inputs and the Specialist Toolkits.'
Everything we configure today forms the exact foundation for tomorrow's audit fieldwork.
We have 5 focused modules designed to fit smoothly within 60 minutes.
Let's look at today's roadmap."
""")

    # =========================================================================
    # SLIDE 2: AGENDA
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "Session Roadmap: 5 Core Modules in 60 Minutes", "Master Schedule & Timing", "Total: 60 Min")

    add_card(s2, Inches(0.8), Inches(1.5), Inches(5.6), Inches(2.6),
             "1. Planning Foundations (15 Min)", [
                 "Audit Universe: What is an auditable entity?",
                 "Risk Register: 5x5 Likelihood x Impact scoring & Heat Map",
                 "Assets Registry & Auditee Attestation workflow",
                 "Creating: 'Treasury Operations', 'Unauthorised payment release', and 'AST-001' for Wednesday's audit."
             ])

    add_card(s2, Inches(6.8), Inches(1.5), Inches(5.6), Inches(2.6),
             "2. Standards, Testing & Evidence (10 Min)", [
                 "Control Library: Frameworks (NDPR, ISO, PCI-DSS) & coverage",
                 "Audit Modules: System/IT, Financial, and Compliance tracks",
                 "Statistical Sampling: Random, Interval & High-Value thresholds",
                 "Central Evidence Repository & Document governance."
             ])

    add_card(s2, Inches(0.8), Inches(4.35), Inches(5.6), Inches(2.7),
             "3. Specialist System Audit Toolkit (20 Min)", [
                 "Data Analytics: Running automated rules on population CSVs",
                 "User Access Review: Run -> Decide -> Justify -> Sign off",
                 "Continuous Monitoring: Automated exception detection",
                 "Security Testing: Segregation of Duties (Plan vs Authorise)",
                 "System Documentation vault & architectural artifacts."
             ])

    add_card(s2, Inches(6.8), Inches(4.35), Inches(5.6), Inches(2.7),
             "4 & 5. Oversight & Programme Approval (15 Min)", [
                 "Module 4 (10 Min): Executive Analytics & Committee Pack PDF",
                 "Forensic Audit Logs: Before/After JSON & Cryptographic Hash Chain",
                 "IMOC ITSM Ticket Ingestion & Audit Intelligence",
                 "Module 5 (5 Min): FY2026 Programme Lifecycle: Submit -> Rejection -> Resubmit -> Approve. (Ready for Wednesday)."
             ])

    set_notes(s2, """ROADMAP OVERVIEW (1 MINUTE):
"Notice how the schedule is structured:
- The first 25 minutes establish our universe, risks, assets, and testing standards.
- The next 20 minutes dive deep into the specialist IT and System Audit tools (analytics, access reviews, penetration testing).
- The final 15 minutes demonstrate board oversight reporting, forensic audit trail integrity, and our end-to-end audit programme approval.
Let's begin with Module 1: The Audit Universe."
""")

    # =========================================================================
    # SLIDE 3: MODULE 1 DEFINITIONS
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Core Concepts: Universe, Risk Register & Assets", "Module 1 Concepts", "15 Min Total")

    add_card(s3, Inches(0.8), Inches(1.5), Inches(3.7), Inches(5.4),
             "Audit Universe", [
                 "DEFINITION: The comprehensive master inventory of all auditable business units, departments, operational systems, and infrastructure across Galaxy Backbone.",
                 "WHY IT MATTERS: If an entity isn't in the Audit Universe, it cannot be scheduled for an audit or linked to risks.",
                 "FIELDS IN IAMS: Name, Category (department, system, process, asset, project), Owner, Audit Frequency (annual, quarterly, etc.), Status (active/inactive).",
                 "TODAY'S OBJECTIVE: Create 'Treasury Operations' as an auditable department."
             ])

    add_card(s3, Inches(4.8), Inches(1.5), Inches(3.7), Inches(5.4),
             "Risk Register & Heat Map", [
                 "DEFINITION: A centralized repository recording enterprise threats, potential financial loss, or compliance breaches across operations.",
                 "SCORING FORMULA: Risk Score = Likelihood (1-5) x Impact (1-5).",
                 "HEAT MAP BANDS: 1-5 Low (Green), 6-12 Medium (Yellow), 13-19 High (Orange), 20-25 Critical (Red).",
                 "LINKING: Every risk must be mapped to an Auditable Universe Entity and assigned a dedicated Risk Owner.",
                 "TODAY'S OBJECTIVE: Log 'Unauthorised payment release' (Likelihood 4 x Impact 5 = Score 20 Critical)."
             ])

    add_card(s3, Inches(8.8), Inches(1.5), Inches(3.7), Inches(5.4),
             "Asset Registry & Attestation", [
                 "DEFINITION: The inventory of physical hardware, business applications, and database repositories supporting business operations.",
                 "ASSET TAG: Unique identifier (e.g., AST-001) used to track custody and evidence.",
                 "AUDITEE ATTESTATION: A formal declaration where the asset custodian/auditee certifies that the asset exists, is operating correctly, and holds valid security classifications.",
                 "STATUSES: Confirmed (valid), Disputed (inaccuracies noted), Decommissioned.",
                 "TODAY'S OBJECTIVE: Create AST-001 (Treasury Payment System) and attest it."
             ])

    set_notes(s3, """EXPLAINING THE CONCEPTS (3 MINUTES):
"Before touching the system, let's understand why these three elements exist together:
1. The Audit Universe is our boundary: 'What exists at Galaxy Backbone that we could possibly audit?'
2. The Risk Register is our compass: 'Where are we most vulnerable, and what could go wrong?'
3. Assets are our technical and operational anchors: 'What IT applications or infrastructure drive those processes?'
When we link all three, an auditor can say: 'We are auditing Treasury Operations, specifically focusing on the risk of Unauthorised payment release, which runs on asset AST-001 (Treasury Payment System).'
Let's build these three live in the system."
""")

    # =========================================================================
    # SLIDE 4: HANDS-ON 1A: AUDIT UNIVERSE
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Hands-on 1A: Creating the Audit Universe Entity", "Module 1 Walkthrough", "Step 1 of 3")

    add_card(s4, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "On-Screen Navigation & Steps", [
                 "1. Log in as Audit Manager (e.g., Adaeze Okonkwo / adaeze@gbb.gov.ng).",
                 "2. In the left sidebar, navigate to Audit Modules -> Audit Universe.",
                 "3. Notice the existing list of business units, data centers, and corporate divisions.",
                 "4. Click the '+ New Entity' button in the top right corner.",
                 "5. The UniverseFormSlideOver panel opens on the right side.",
                 "6. Fill in the exact parameters shown on the right.",
                 "7. Click 'Create Entity'.",
                 "8. Verify that 'Treasury Operations' appears in the active universe table."
             ])

    add_card(s4, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Form Parameters & Values", [
                 "• Entity Name: Treasury Operations",
                 "• Category: Department (options: Department, System, Process, Asset, Project)",
                 "• Owner: Chisom Okafor (Head of Operations / Auditee)",
                 "• Audit Frequency: Annual (options: Monthly, Quarterly, Biannual, Annual)",
                 "• Status: Active",
                 "• Description: 'Core department responsible for government disbursements, payment reconciliation, and liquidity management.'",
                 "",
                 "KEY TAKEAWAY: Choosing Chisom Okafor sets the operational owner who will receive audit evidence requests and respond to findings."
             ])

    set_notes(s4, """FACILITATOR INSTRUCTIONS (4 MINUTES):
- Ask the class to follow along on their screens.
- Open 'Audit Universe'.
- Emphasize the 'Category' field: explains whether this is a department or technical system.
- Select Chisom Okafor as Owner.
- Click 'Create Entity' and show the green success toast notification.
- Highlight that tomorrow's audit will select this exact entity from the dropdown.
""")

    # =========================================================================
    # SLIDE 5: HANDS-ON 1B: RISK REGISTER & HEAT MAP
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Hands-on 1B: Risk Register & 5x5 Heat Map Scoring", "Module 1 Walkthrough", "Step 2 of 3")

    add_card(s5, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Navigation & Action Steps", [
                 "1. In the sidebar, navigate to Risk Register.",
                 "2. Review the top tabs: 'Risk Register', 'Categories', 'Heat Map', and 'Objectives'.",
                 "3. First, click Categories tab: notice seeded categories (Financial Risk, Operational Risk, Cyber Risk, Compliance Risk).",
                 "4. Return to Risk Register tab -> Click '+ New Risk'.",
                 "5. Complete the slide-over form with the parameters opposite.",
                 "6. Observe the dynamic Risk Score indicator recalculating as likelihood and impact sliders change.",
                 "7. Click 'Add to Register'.",
                 "8. Switch to the 'Heat Map' tab: locate the top-right red cell (Likelihood 4 x Impact 5 = 20 Critical)."
             ])

    add_card(s5, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Field Values & Scoring Mechanics", [
                 "• Title: Unauthorised payment release",
                 "• Description: Risk of electronic funds transfer executed without multi-party dual authorization.",
                 "• Category: Financial Risk",
                 "• Linked Universe Entity: Treasury Operations",
                 "• Risk Owner: Ibrahim Musa (Director)",
                 "• Likelihood: 4 (Likely — occurs multiple times annually)",
                 "• Impact: 5 (Catastrophic — severe financial loss / regulatory sanction)",
                 "• Dynamic Score: 20 -> Critical Band (Red Tone)",
                 "• Status: Open",
                 "",
                 "WHY WEDNESDAY REUSES THIS: When we start the audit tomorrow, this exact risk appears on the engagement dashboard."
             ])

    set_notes(s5, """FACILITATOR INSTRUCTIONS (4 MINUTES):
- Show how moving the sliders dynamically changes the tone from Green (Low) to Red (Critical).
- Explain the calculation: 4 x 5 = 20.
- Point out the link to 'Treasury Operations' in the dropdown.
- Click 'Add to register'.
- Immediately switch to the 'Heat Map' tab to show the visual distribution. Point out how executive leadership looks at this exact heatmap.
""")

    # =========================================================================
    # SLIDE 6: HANDS-ON 1C: ASSETS & ATTESTATION
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Hands-on 1C: Asset Registry & Auditee Attestation", "Module 1 Walkthrough", "Step 3 of 3")

    add_card(s6, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Creating Asset AST-001", [
                 "1. In the sidebar, expand 'Assets' -> Click 'Asset Registry'.",
                 "2. Click '+ New Asset' to open AssetFormSlideOver.",
                 "3. Enter the asset metadata:",
                 "   • Asset Tag: AST-001",
                 "   • Name: Treasury Payment System",
                 "   • Asset Type: Application",
                 "   • Criticality: Critical | Status: Active",
                 "   • Data Classification: Confidential",
                 "   • Owner: Chisom Okafor",
                 "   • Source System: Manual Entry",
                 "4. Click 'Save Asset'.",
                 "5. Search 'AST-001' in the search bar to show the created asset card."
             ])

    add_card(s6, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "The Auditee Attestation Workflow", [
                 "WHAT IS ATTESTATION? Auditees must periodically certify that assets under their care actually exist, are operational, and possess accurate ratings.",
                 "",
                 "HOW IT OPERATES IN IAMS:",
                 "1. Open AST-001 -> Navigate to 'Attestations' tab.",
                 "2. Click 'Attest Asset'.",
                 "3. Select Status: Confirmed (Options: Confirmed, Disputed, Decommissioned).",
                 "4. Add Custodian Notes: 'Confirmed in production; dual-control HSM modules active.'",
                 "5. Submit Attestation -> Generates an immutable snapshot of asset metadata with timestamp and user ID.",
                 "6. Updates 'Last Attested Date' on the master asset record."
             ])

    set_notes(s6, """FACILITATOR INSTRUCTIONS (4 MINUTES):
- Walk through creating AST-001.
- Explain why Asset Tag matters: AST-001 is the official tag referenced across evidence requests, working papers, and findings.
- Explain Attestation: It stops ghost assets or obsolete software from lingering on the balance sheet and security perimeter.
- Demonstrate attesting the asset and viewing the historical snapshot table.
- Wrap up Module 1: 'We now have our Universe entity, our Critical Risk, and our Attested Asset. Ready for Module 2.'
""")

    # =========================================================================
    # SLIDE 7: MODULE 2 CONCEPTS
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Standards, Testing Tracks & Evidence Repository", "Module 2 Concepts", "10 Min Total")

    add_card(s7, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Control Library & 3 Audit Modules", [
                 "WHAT IS A CONTROL? A documented safeguard, policy, or technical barrier designed to prevent or detect risks from materializing.",
                 "CONTROL FRAMEWORKS IN IAMS:",
                 "• NDPR (Nigeria Data Protection Regulation)",
                 "• ISO 27001 (Information Security Management)",
                 "• PCI-DSS (Payment Card Industry Security)",
                 "• GBB Internal Financial Regulations",
                 "",
                 "THE 3 AUDIT MODULE TRACKS:",
                 "1. System / IT Audit: Technical infrastructure, cybersecurity, active directory, database access.",
                 "2. Financial Audit: Treasury balances, revenue assurance, payroll, procurement.",
                 "3. Compliance Audit: Regulatory mandates, statutory policies, board charters."
             ])

    add_card(s7, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Sampling & Central Evidence Repository", [
                 "WHAT IS AUDIT SAMPLING? Testing a representative percentage of a transaction population rather than examining 100% of records.",
                 "WHY IT MATTERS: Provides statistically defensible audit assurance while optimizing auditor fieldwork time.",
                 "",
                 "CENTRAL EVIDENCE REPOSITORY:",
                 "• Central vault holding all files uploaded across evidence requests, findings, and working papers.",
                 "• Eliminates scattered email attachments and lost evidence files.",
                 "• Tagged by Engagement Reference, Uploader, and Hash.",
                 "",
                 "DOCUMENT TEMPLATES: Standardized corporate document layouts for memos, reference letters, and reports."
             ])

    set_notes(s7, """EXPLAINING STANDARDS & EVIDENCE (2 MINUTES):
"In Module 2, we look at what standards we test against.
- The Control Library stores our benchmarks (NDPR, ISO, internal regulations).
- When an auditor tests a control, they don't test 100,000 transactions; they draw a statistically valid sample using our Sampling Toolkit.
- When auditees provide receipts or logs, they are deposited directly into the Central Evidence Repository, creating an immutable paper trail."
""")

    # =========================================================================
    # SLIDE 8: HANDS-ON 2A: CONTROL LIBRARY & REPOSITORY
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Hands-on 2A: Controls, Evidence Repository & Documents", "Module 2 Walkthrough", "Step 1 of 2")

    add_card(s8, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Exploring the Control Library", [
                 "1. In the sidebar, navigate to Compliance Frameworks -> Controls.",
                 "2. Filter by Framework: 'NDPR' or 'ISO 27001'.",
                 "3. Open a control card (e.g., Access Control / Dual Authorization):",
                 "   • Control Code: e.g. FIN-CTL-01",
                 "   • Objective: Prevent single-point unauthorized disbursement.",
                 "   • Test Procedure: Sample 25 payment vouchers for dual sign-off.",
                 "4. Note 'Coverage': Shows how many audit engagements have tested this control this financial year.",
                 "5. Uncovered controls turn amber/red to signal audit blind spots."
             ])

    add_card(s8, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Evidence Repository & Documents Vault", [
                 "EVIDENCE REPOSITORY (Sidebar -> Evidence Repository):",
                 "1. Review the central evidence ledger.",
                 "2. Filter by: Engagement, Auditee, File Type, or Upload Date.",
                 "3. Open an item: Notice preview, download link, and audit trail of who accessed the file.",
                 "",
                 "DOCUMENTS VAULT (Sidebar -> Documents):",
                 "1. Houses general operational documents, memos, and letters.",
                 "2. Demonstrates our recent fix: Authorized workflow participants can 'View & Sign' attached Word and PDF files without encountering 403 errors."
             ])

    set_notes(s8, """FACILITATOR INSTRUCTIONS (4 MINUTES):
- Show the Control Library in the live system.
- Filter by ISO 27001 and show how control codes and test procedures are already pre-seeded.
- Click 'Evidence Repository': explain that when auditees respond to evidence requests during fieldwork, the files flow directly into this secure repository.
- Show 'Documents': highlight that this is where ad-hoc sign-offs occur.
""")

    # =========================================================================
    # SLIDE 9: HANDS-ON 2B: SAMPLING TOOLKIT
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "Hands-on 2B: Deterministic Statistical Audit Sampling", "Module 2 Walkthrough", "Step 2 of 2")

    add_card(s9, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "The 3 Scientific Sampling Methods", [
                 "IAMS uses pure, deterministic sampling logic (seeded algorithms):",
                 "",
                 "1. SIMPLE RANDOM SAMPLING:",
                 "   • Seeded Fisher-Yates algorithm.",
                 "   • Every record has an equal probability of selection.",
                 "",
                 "2. SYSTEMATIC INTERVAL SAMPLING:",
                 "   • Selects every Nth row starting from a randomized seed offset.",
                 "   • Ideal for evenly distributed transaction streams.",
                 "",
                 "3. HIGH-VALUE STRATIFIED SAMPLING:",
                 "   • Focuses 100% of testing on transactions exceeding a monetary threshold (e.g. all vouchers > ₦5,000,000) and samples the remainder."
             ])

    add_card(s9, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Sample Size Calculator & Live Run", [
                 "SAMPLE SIZE CALCULATOR (Attribute Sampling):",
                 "• Confidence Level: e.g. 95% (Z-score = 1.96)",
                 "• Expected Deviation Rate: 1%",
                 "• Tolerable Deviation Rate: 5%",
                 "• Calculates statistically defensible sample size (e.g., 59 items).",
                 "",
                 "RUNNING SAMPLING IN AN ENGAGEMENT:",
                 "1. Open Engagement -> Sampling tab.",
                 "2. Upload Population CSV (e.g., 5,000 payment rows).",
                 "3. Select Method: Random / Interval / High-Value.",
                 "4. Click 'Draw Sample' -> Automatically generates sample table and saves methodology documentation as an immutable audit evidence file!"
             ])

    set_notes(s9, """FACILITATOR INSTRUCTIONS (4 MINUTES):
- Explain the difference between guessing a sample and using scientific sampling.
- If an auditor picks 10 invoices at random without a methodology, an external regulator or the Auditor-General can challenge the findings.
- IAMS proves the sampling seed, formula, and sample size in writing.
- Show how the generated sample CSV automatically binds directly to the engagement evidence repository.
""")

    # =========================================================================
    # SLIDE 10: MODULE 3 CONCEPTS
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "Specialist Toolkit: System & IT Audit Core Concepts", "Module 3 Concepts", "20 Min Total")

    add_card(s10, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Data Analytics & Access Reviews", [
                 "DATA ANALYTICS ON POPULATION CSV:",
                 "• Ingests large technical exports (Active Directory user dumps, transaction logs, server configurations).",
                 "• Runs automated rule checks: detects dormant accounts, segregation of duties conflicts, duplicate payments, and missing approvals.",
                 "",
                 "USER ACCESS REVIEW (UAR):",
                 "• Core compliance control for ISO 27001 & NDPR.",
                 "• Periodic review verifying whether every staff member's access privileges remain valid for their job duties.",
                 "• 4-Step Cycle: Run -> Decide -> Justify -> Sign off."
             ])

    add_card(s10, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Continuous Monitoring & Security Tests", [
                 "EVENT & CONTINUOUS MONITORING:",
                 "• Background engine (BG:SYSAUDIT:MONITORING:DAILY) monitoring live system sources.",
                 "• Automatically alerts auditors when high-severity exceptions occur without waiting for an annual audit.",
                 "",
                 "SECURITY TESTING (Vulnerability & Pentesting):",
                 "• Ethical hacking and vulnerability scanning assessments.",
                 "• Strict Segregation of Duties (SoD): The person who plans or coordinates the penetration test CANNOT authorize it to execute! A different authority must approve.",
                 "",
                 "SYSTEM DOCUMENTATION VAULT: Secure repository for architectural blueprints, data flow diagrams, and IT policy manuals."
             ])

    set_notes(s10, """EXPLAINING SYSTEM AUDIT CONCEPTS (2 MINUTES):
"Module 3 is the most technical 20 minutes of our training.
Traditional auditing waits until year-end to sample paper files. System Audit uses automated data analytics and continuous monitoring to catch exceptions in real time.
Let's see the 4 specialist tools inside the System Audit module:
1. Analytics on sample CSVs
2. User Access Review (run -> decide -> justify -> sign off)
3. Security Testing with strict Segregation of Duties
4. Continuous Monitoring & System Documentation."
""")

    # =========================================================================
    # SLIDE 11: HANDS-ON 3A: DATA ANALYTICS
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "Hands-on 3A: Data Analytics on Sample Population CSV", "Module 3 Walkthrough", "Step 1 of 4")

    add_card(s11, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Running Data Analytics in System Audit", [
                 "1. In the sidebar, navigate to System Audit -> Analytics.",
                 "2. Click '+ New Analysis Run'.",
                 "3. Select Analysis Type: 'User Access Listing' or 'Transaction Anomaly Scan'.",
                 "4. Choose Source: 'Upload CSV File' (or live integration source).",
                 "5. Drag and drop the sample dataset (e.g. `gbb_staff_ad_dump.csv`).",
                 "6. Select Rule Pack: 'Privileged Account Rules', 'Dormancy Check (>90 days)', and 'Separation of Duties'.",
                 "7. Click 'Run Analysis'."
             ])

    add_card(s11, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Reviewing Exceptions & Analysis Results", [
                 "ANALYSIS RUN RESULTS CARD:",
                 "• Total Records Processed: e.g. 1,240 accounts.",
                 "• Exceptions Flagged: e.g. 14 critical exceptions.",
                 "",
                 "TYPES OF EXCEPTIONS DETECTED:",
                 "1. Dormant Accounts: Active accounts with no login > 90 days.",
                 "2. Terminated Staff with Active Access: Accounts flagged in HR as departed but active in Active Directory.",
                 "3. Over-Privileged Accounts: Regular staff holding domain administrative rights.",
                 "",
                 "NEXT ACTION: Convert flagged exceptions directly into an Access Review worklist with 1 click."
             ])

    set_notes(s11, """FACILITATOR INSTRUCTIONS (4 MINUTES):
- Open 'System Audit' -> 'Analytics'.
- Click 'New Analysis Run'.
- Explain that auditors don't write SQL queries manually; they upload CSV exports and IAMS executes pre-configured compliance rule packs.
- Show the results dashboard: breakdown of exceptions by severity.
- Emphasize: 'These exceptions aren't just numbers—they feed straight into our Access Review worklist.'
""")

    # =========================================================================
    # SLIDE 12: HANDS-ON 3B: ACCESS REVIEW CYCLE
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "Hands-on 3B: Access Review (Run -> Decide -> Justify -> Sign Off)", "Module 3 Walkthrough", "Step 2 of 4")

    add_card(s12, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "The 4-Step Access Review Lifecycle", [
                 "STEP 1: RUN",
                 "• Launch access review run from the analytics run or live directory.",
                 "• Generates the candidate account worklist.",
                 "",
                 "STEP 2: DECIDE",
                 "• Reviewer evaluates each account and picks one of 3 decisions:",
                 "  a) Appropriate: Access is required and valid for current job.",
                 "  b) Revoke: Access is improper and must be removed.",
                 "  c) Modify: Downgrade or adjust specific permissions.",
                 "",
                 "STEP 3: JUSTIFY (ENFORCED BY CODE!)",
                 "• If Revoke or Modify is selected, IAMS blocks submission until a justification note is entered! ('Say what access should be removed or changed').",
                 "",
                 "STEP 4: SIGN OFF",
                 "• Reviewer formally signs off -> creates an immutable review report."
             ])

    add_card(s12, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Live Walkthrough Demonstration", [
                 "1. System Audit -> Access Reviews -> Open the active run.",
                 "2. Review the account worklist table.",
                 "3. Account 1 (Active Financial Controller): Click 'Appropriate'.",
                 "4. Account 2 (Ex-staff contractor still holding VPN access):",
                 "   • Select 'Revoke'.",
                 "   • Try to submit without a note -> Form validates and prompts for note.",
                 "   • Enter Note: 'Contract ended 30 September; revoke active directory account and VPN certificate.'",
                 "   • Save decision.",
                 "5. Account 3 (Auditor holding IT admin role):",
                 "   • Select 'Modify'.",
                 "   • Note: 'Remove domain admin role; retain standard auditor read rights.'",
                 "6. Click 'Complete & Sign Off Access Review'."
             ])

    set_notes(s12, """FACILITATOR INSTRUCTIONS (5 MINUTES):
- This is a critical slide. Demonstrate the code rule we verified in `access-review.request.dto.ts`.
- Intentionally try to select 'Revoke' and save without a note: show the red validation message: 'Say what access should be removed or changed'.
- Explain to the class: 'The system will not let an auditor say revoke without documenting why. This provides legal and operational justification.'
- Complete the sign-off and show the completed review badge.
""")

    # =========================================================================
    # SLIDE 13: HANDS-ON 3C: SECURITY TESTING (SoD)
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "Hands-on 3C: Security Testing & Segregation of Duties", "Module 3 Walkthrough", "Step 3 of 4")

    add_card(s13, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Planning a Security Test (Pentest)", [
                 "1. Navigate to System Audit -> Security Testing.",
                 "2. Click '+ New Security Test'.",
                 "3. Fill out the scope and rules of engagement:",
                 "   • Title: Q4 External Infrastructure Penetration Test",
                 "   • Test Type: Penetration Test (Vulnerability Assessment, Red Team)",
                 "   • Target Scope: 197.159.79.0/24 external DMZ & Web portals",
                 "   • Provider: External Ethical Hacking Firm",
                 "   • Planned Start/End: 2026-11-01 to 2026-11-05",
                 "   • Rules of Engagement: No Denial of Service (DoS); off-peak testing.",
                 "   • Coordinator: Logged in user (e.g. Adaeze).",
                 "4. Click 'Create Test' -> Status: 'Planned'."
             ])

    add_card(s13, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Segregation of Duties (Plan vs Authorise)", [
                 "THE STRICT CODE CONSTRAINT:",
                 "• In `security-test.service.ts`: 'A security test must be authorised by someone other than its coordinator or creator!'",
                 "",
                 "TRYING SELF-AUTHORIZATION (Demonstration):",
                 "1. As creator/coordinator, click 'Authorise Test'.",
                 "2. System displays Error: 'Forbidden — Cannot authorize your own test.'",
                 "",
                 "THE REAL WORKFLOW:",
                 "1. Switch user to CAE (Fatima) or Director (Ibrahim).",
                 "2. Open Security Tests -> Q4 External Penetration Test.",
                 "3. Click 'Authorise Test' -> Enter authorization reference note.",
                 "4. Status transitions to 'Authorised' -> Test can now begin!"
             ])

    set_notes(s13, """FACILITATOR INSTRUCTIONS (5 MINUTES):
- Explain Segregation of Duties (SoD): In IT security, penetration testing involves deliberate intrusive scanning that could impact critical infrastructure.
- The person who plans the test MUST NOT have the power to authorize it unilaterally.
- Show the error message when the coordinator tries to approve.
- Log in as the CAE or Director and authorize the test.
- Explain: 'This prevents rogue or unapproved penetration tests from being executed against Galaxy Backbone networks.'
""")

    # =========================================================================
    # SLIDE 14: HANDS-ON 3D: MONITORING & DOCUMENTATION
    # =========================================================================
    s14 = prs.slides.add_slide(blank_layout)
    add_header(s14, "Hands-on 3D: Event Monitoring & Documentation Vault", "Module 3 Walkthrough", "Step 4 of 4")

    add_card(s14, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Continuous & Event Monitoring", [
                 "CONTINUOUS MONITORING ENGINE:",
                 "• Operates daily in the background (`BG:SYSAUDIT:MONITORING:DAILY`).",
                 "• Evaluates security event lookback windows (1 to 7 days).",
                 "",
                 "MONITORING CHECKS:",
                 "1. IAMS Access Check: Detects failed login spikes and brute force.",
                 "2. Security Events: Monitors privilege escalations and role assignment changes.",
                 "3. IMOC Incidents: Identifies unresolved critical ITSM outages.",
                 "",
                 "AUDITOR ACTION:",
                 "• Click 'Run Checks Now' to trigger on-demand scan.",
                 "• Exceptions surface on the monitoring console with severity ratings (Critical, High, Medium)."
             ])

    add_card(s14, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "System Documentation Vault", [
                 "WHAT IS THE SYSTEM DOCS VAULT?",
                 "• Secure repository for IT architecture blueprints, network diagrams, system manuals, and third-party vendor contracts.",
                 "",
                 "KEY CAPABILITIES:",
                 "1. Version Control: Historical revisions preserved with audit comments.",
                 "2. Categories: Policy, Architecture, User Manual, Vendor Contract.",
                 "3. Engagement Association: Directly link architecture diagrams to active audits.",
                 "",
                 "WRAP-UP MODULE 3: We have now demonstrated all 4 specialist system audit tools. Next: Module 4 (Executive Oversight)."
             ])

    set_notes(s14, """FACILITATOR INSTRUCTIONS (4 MINUTES):
- Open 'System Audit' -> 'Continuous Monitoring'.
- Click 'Run Checks Now' and watch the progress indicator evaluate the checks.
- Open 'System Documentation': show an uploaded architecture diagram or policy PDF.
- Summarize Module 3: 'Data analytics, access reviews, authorized penetration testing, and continuous monitoring make IAMS an active defense and assurance platform.'
""")

    # =========================================================================
    # SLIDE 15: MODULE 4 CONCEPTS
    # =========================================================================
    s15 = prs.slides.add_slide(blank_layout)
    add_header(s15, "Executive Oversight, Forensic Chains & IMOC", "Module 4 Concepts", "10 Min Total")

    add_card(s15, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Committee Pack & Audit Intelligence", [
                 "THE AUDIT COMMITTEE PACK PDF:",
                 "• Board-level governance report generated with one click.",
                 "• Gathers organization-wide engagement progress, planned vs actual hours, open findings aging (<30, 30-90, >90 days), top risk bands, and escalation history.",
                 "• Formatted in Galaxy Backbone corporate branding via pdfmake.",
                 "",
                 "AUDIT INTELLIGENCE (PREDICTIVE):",
                 "• Machine learning analytics forecasting engagement completion risks, overdue remediation trends, and repeat finding recurrence.",
                 "• Helps leadership allocate audit resources where risk is trending upward."
             ])

    add_card(s15, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Tamper-Evident Logs & IMOC Integration", [
                 "FORENSIC HASH-CHAIN AUDIT LOGS:",
                 "• Every user action writes an audit log record with old_values (before) and new_values (after) in JSON.",
                 "• SHA-256 Hash Chain: Each row commits the previous row's cryptographic hash (`row_hash = SHA256(prev_hash + data)`).",
                 "• If anyone tampers with a database row, the chain breaks instantly! Verify-chain detects and flags the exact corrupted record.",
                 "",
                 "IMOC INTEGRATION (ITSM):",
                 "• Connects Galaxy Backbone's IT Service Management desk.",
                 "• Ingests ticket incidents (SLA breaches, outages) directly into IAMS as audit evidence without manual copying."
             ])

    set_notes(s15, """EXPLAINING OVERSIGHT & INTEGRITY (2 MINUTES):
"Module 4 covers how executive leadership and the Board Audit Committee view the system, and how the system guarantees data integrity.
- The Committee Pack replaces weeks of manual spreadsheet compilation with a 1-click executive PDF.
- The Audit Trail isn't a simple log file—it is cryptographically sealed using SHA-256 blockchain-style chaining. If a database administrator attempts to change a finding status directly in SQL Server, the chain verification breaks.
Let's see this live."
""")

    # =========================================================================
    # SLIDE 16: HANDS-ON 4: OVERSIGHT WALKTHROUGH
    # =========================================================================
    s16 = prs.slides.add_slide(blank_layout)
    add_header(s16, "Hands-on 4: Committee Pack, Hash Chains & IMOC", "Module 4 Walkthrough", "10 Min Walkthrough")

    add_card(s16, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "1. Committee Pack PDF & Analytics", [
                 "1. Navigate to Analytics in the sidebar.",
                 "2. Review the KPI cards: Total Engagements, Finding Remediation Rate, Overdue Action Items.",
                 "3. Look for the top right button: 'Committee pack (PDF)'.",
                 "4. Click 'Committee pack (PDF)':",
                 "   • Generates the executive briefing pack in real time.",
                 "   • Shows engagement completion percentages.",
                 "   • Shows Finding Severity by Aging buckets (0-30 days, 30-90 days, 90+ days).",
                 "   • Shows Top Enterprise Risks by score.",
                 "5. Open the downloaded PDF and display the branded report to the class."
             ])

    add_card(s16, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "2. Forensic Audit Trail & IMOC Sync", [
                 "VERIFYING AUDIT TRAIL INTEGRITY (Audit Logs):",
                 "1. Navigate to Audit Logs in sidebar.",
                 "2. Open an entry: Show the 'Before' and 'After' JSON diff card.",
                 "3. Click 'Verify Chain Integrity':",
                 "   • System verifies hashes across all sealed rows.",
                 "   • Displays confirmation: 'Chain verified: N records verified, 0 broken links.'",
                 "",
                 "IMOC INTEGRATION TAB (Integrations -> IMOC):",
                 "1. Review synced ticket records.",
                 "2. Filter by 'SLA Breached'.",
                 "3. Click 'Capture as Evidence' -> Attaches the ticket snapshot directly into an active engagement evidence folder!"
             ])

    set_notes(s16, """FACILITATOR INSTRUCTIONS (6 MINUTES):
- Download the Committee Pack PDF and open it: point out how clean the layout is.
- Open 'Audit Logs': click on a recent update to show the 'Before' and 'After' side-by-side JSON comparison.
- Click 'Verify Chain Integrity' and point out the cryptographic verification message.
- Explain: 'This satisfies internal audit independence and external regulatory standards (e.g., ISO and NDPR audits).'
- Show IMOC tickets and how they link directly as evidence.
""")

    # =========================================================================
    # SLIDE 17: HANDS-ON 5: AUDIT PROGRAMME LIFECYCLE
    # =========================================================================
    s17 = prs.slides.add_slide(blank_layout)
    add_header(s17, "Module 5: The FY2026 Audit Programme Lifecycle", "Submit -> Reject -> Resubmit -> Approve", "5 Min Finale")

    add_card(s17, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "1. Manager Creates & Submits Programme", [
                 "1. Log in as Manager (Adaeze Okonkwo).",
                 "2. Navigate to Audit Modules -> Audit Plans / Programmes.",
                 "3. Click '+ New Programme':",
                 "   • Title: FY 2026 Financial Audit Programme",
                 "   • Year: 2026 | Audit Type: Financial",
                 "   • Description: Annual financial review covering treasury and procurement.",
                 "4. Click 'Create Programme' -> Open the created programme.",
                 "5. Click '+ Add Plan Item':",
                 "   • Auditable Entity: Treasury Operations (Created in Module 1!)",
                 "   • Priority: High",
                 "   • Start / End Dates: 2026-10-08 to 2026-11-20",
                 "6. Click 'Submit for Approval' -> Status: 'Submitted'."
             ])

    add_card(s17, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "2. Rejection, Revision & Final Sign-Off", [
                 "TESTING REJECTION WORKFLOW:",
                 "1. Switch user to CAE (Fatima Bello / fatima@gbb.gov.ng).",
                 "2. Open the programme -> Click 'Reject'.",
                 "3. Enter Rejection Reason: 'Please adjust planned end date to align with Q4 financial close.'",
                 "4. Click 'Confirm Rejection' -> Status changes to 'Rejected' (shown in red).",
                 "",
                 "REVISION & FINAL APPROVAL:",
                 "1. Switch back to Manager (Adaeze).",
                 "2. Open programme -> Notice red rejection reason banner.",
                 "3. Click 'Submit for Approval' again.",
                 "4. Switch to CAE -> Click 'Approve & Sign'.",
                 "5. CAE draws signature -> Clicks 'Sign & Approve'.",
                 "6. Status: 'Approved' (Green) | Approval Chain shows 'Signed'!"
             ])

    set_notes(s17, """FACILITATOR INSTRUCTIONS (5 MINUTES):
- This is the grand finale of Tuesday's training.
- Highlight the full approval workflow:
  1. We used the 'Treasury Operations' entity we created in Module 1.
  2. We demonstrated that approvals aren't rubber stamps: the CAE can reject with feedback.
  3. The manager resubmits.
  4. The CAE applies a legal digital signature.
  5. The programme is approved and locked.
- Conclude with the punchline: 'This FY 2026 Financial Audit Programme is now approved. This is what we audit tomorrow!'
""")

    # =========================================================================
    # SLIDE 18: WRAP-UP & TOMORROW'S PREVIEW
    # =========================================================================
    s18 = prs.slides.add_slide(blank_layout)
    add_header(s18, "Tuesday Wrap-Up & Tomorrow's Fieldwork Preview", "Summary & Transition", "Wrap-Up")

    add_card(s18, Inches(0.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "What We Built & Mastered Today", [
                 "✅ AUDIT UNIVERSE: Created 'Treasury Operations' as our auditable department.",
                 "✅ RISK REGISTER: Mapped 'Unauthorised payment release' (4 x 5 = 20 Critical) on the Heat Map.",
                 "✅ ASSETS: Registered AST-001 (Treasury Payment System) and completed auditee attestation.",
                 "✅ TESTING STANDARDS: Explored Control Library, Evidence Vault, and deterministic Sampling.",
                 "✅ SYSTEM AUDIT TOOLKIT: Executed Data Analytics, completed an Access Review (Decide + Justify), tested Penetration Testing SoD, and ran Continuous Monitoring.",
                 "✅ FORENSIC INTEGRITY: Downloaded Committee Pack PDF and verified SHA-256 hash chains.",
                 "✅ APPROVED PROGRAMME: Approved the FY2026 Financial Programme."
             ])

    add_card(s18, Inches(6.8), Inches(1.5), Inches(5.6), Inches(5.4),
             "Wednesday: Fieldwork to Final Report", [
                 "TOMORROW WE AUDIT WHAT WE BUILT TODAY:",
                 "",
                 "• Launching the Engagement: Starting the audit from our approved FY2026 plan item.",
                 "• Linking AST-001 & Risk: Pulling our critical risk and asset into the engagement scope.",
                 "• Evidence & Testing: Sending evidence requests to Chisom Okafor (Auditee) and testing controls.",
                 "• Raising Findings: Recording 'Payments released without independent approval' from failed controls.",
                 "• Working Papers: Drafting, reviewing, and signing off WP-01.",
                 "• GBB Report Writing: Generating the formal report using the official Galaxy Backbone template.",
                 "• 3-Tier Executive Sign-Off: Manager -> Director -> CAE in-place signing and report issuance!"
             ])

    set_notes(s18, """CLOSING SCRIPT (1 MINUTE):
"Thank you everyone. In 60 minutes today, we have configured every planning input and mastered all specialist toolkits in IAMS.
Tomorrow morning, we open the engagement for Treasury Operations, execute fieldwork on AST-001, test the risk of unauthorized payments, and issue the final GBB audit report.
Have a great afternoon, and see you tomorrow!"
""")

    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else "Tuesday_Training_Planning_Inputs_and_Specialist_Toolkits.pptx"
    create_deck(out)
