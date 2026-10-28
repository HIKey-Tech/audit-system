/**
 * Plain-language functional explanations for permission slugs.
 * Speaks generally about what the permission allows the person to do
 * and who should have it, strictly without naming specific roles.
 */

export interface PermissionExplanation {
  /** What this permission allows the holder to do */
  what: string;
  /** Who should generally hold this capability */
  who: string;
  /** Concise combined one-line sentence for quick display beside slugs */
  summary: string;
}

export const PERMISSION_EXPLANATIONS: Record<string, PermissionExplanation> = {
  // ── Authentication & Identity ──
  'auth:logout': {
    what: 'Terminate the current active login session',
    who: 'Any authenticated user managing their active session',
    summary: 'Allows ending the current login session. Granted to any authenticated user.',
  },
  'auth:logout_all': {
    what: 'Terminate all active login sessions across all browsers and devices',
    who: 'Any user needing to secure their account across all devices',
    summary: 'Allows ending all active sessions across devices. Granted to any user managing account security.',
  },
  'user:read': {
    what: 'View user profiles, contact details, and department assignments',
    who: 'Anyone who needs visibility into organization staff members',
    summary: 'Allows viewing staff profiles and contact details. For anyone needing visibility into organization staff.',
  },
  'user:directory': {
    what: 'Search and pick active staff names and job titles in assignment and workflow dropdowns',
    who: 'Anyone responsible for assigning tasks, workflows, or audit procedures to colleagues',
    summary: 'Allows looking up staff members in workflow pickers. For anyone assigning tasks or routing approvals.',
  },
  'user:create': {
    what: 'Register and onboard new staff accounts into the system',
    who: 'Personnel responsible for creating and onboarding staff accounts',
    summary: 'Allows creating new user accounts. For personnel responsible for onboarding staff.',
  },
  'user:update': {
    what: 'Modify staff profile information, contact numbers, and departmental affiliations',
    who: 'Personnel responsible for maintaining accurate staff records',
    summary: 'Allows editing user profile and department details. For personnel maintaining staff records.',
  },
  'user:deactivate': {
    what: 'Activate or deactivate staff access when status or employment changes',
    who: 'Personnel responsible for enabling or disabling user access',
    summary: 'Allows activating or deactivating user accounts. For personnel managing access status.',
  },
  'user:delete': {
    what: 'Permanently remove inactive or obsolete user accounts',
    who: 'Personnel authorized to clean up and delete user records',
    summary: 'Allows deleting user records. For personnel authorized to remove user accounts.',
  },
  'user:admin': {
    what: 'Assign and update permissions and access bundles on user accounts',
    who: 'Personnel responsible for governing access rights and security privileges',
    summary: 'Allows modifying user access privileges. For personnel responsible for access governance.',
  },
  'user:reset_2fa': {
    what: 'Clear two-factor authentication credentials for locked-out staff members',
    who: 'Personnel providing account recovery and identity verification assistance',
    summary: 'Allows resetting 2FA for locked-out staff. For personnel providing identity recovery support.',
  },
  'role:read': {
    what: 'View available access groups and the permissions configured within them',
    who: 'Anyone needing to inspect the structure of system access bundles',
    summary: 'Allows viewing roles and their permissions. For anyone inspecting access configurations.',
  },
  'role:create': {
    what: 'Define and create new access groups with specific collections of capabilities',
    who: 'Personnel responsible for designing functional access profiles',
    summary: 'Allows creating new access groups and permission bundles. For personnel configuring access structures.',
  },
  'role:update': {
    what: 'Modify the permissions assigned to existing access groups',
    who: 'Personnel responsible for adjusting functional access profiles',
    summary: 'Allows editing permissions within access groups. For personnel maintaining access profiles.',
  },
  'role:delete': {
    what: 'Remove obsolete or unused access groups from the system',
    who: 'Personnel responsible for maintaining system access profiles',
    summary: 'Allows removing unused access groups. For personnel maintaining access profiles.',
  },
  'role:assign': {
    what: 'Grant or revoke access bundles on individual staff accounts',
    who: 'Personnel responsible for provisioning and managing staff access assignments',
    summary: 'Allows assigning access bundles to staff. For personnel managing user access rights.',
  },
  'permission:read': {
    what: 'View the complete catalogue of system capabilities and permission slugs',
    who: 'Anyone auditing system security and functional capabilities',
    summary: 'Allows viewing all available permission slugs. For anyone auditing security capabilities.',
  },

  // ── Document Management ──
  'document:read': {
    what: 'View and download documents, attachments, and files in the central repository',
    who: 'Anyone authorized to inspect general organizational documents and evidence files',
    summary: 'Allows viewing and downloading repository documents. For anyone authorized to inspect files.',
  },
  'document:write': {
    what: 'Upload new documents, templates, and evidence files to the repository',
    who: 'Anyone authorized to contribute files or documentation into the system',
    summary: 'Allows uploading documents and attachments. For anyone contributing documentation.',
  },
  'document:delete': {
    what: 'Remove or soft-delete documents and obsolete file attachments',
    who: 'Personnel authorized to curate and clean up document records',
    summary: 'Allows deleting documents from the repository. For personnel authorized to curate files.',
  },
  'document_template:read': {
    what: 'View standardized document cover pages, layout templates, and styling rules',
    who: 'Anyone reviewing document formatting and corporate standards',
    summary: 'Allows viewing document templates. For anyone reviewing corporate formatting standards.',
  },
  'document_template:write': {
    what: 'Create and edit standardized document templates and layout configurations',
    who: 'Personnel responsible for establishing corporate documentation standards',
    summary: 'Allows creating and editing document templates. For personnel managing document standards.',
  },
  'document_template:delete': {
    what: 'Delete obsolete or outdated document templates',
    who: 'Personnel responsible for managing corporate documentation standards',
    summary: 'Allows deleting obsolete document templates. For personnel managing document standards.',
  },

  // ── Audit Trail & Logging ──
  'log:read': {
    what: 'View the immutable system audit trail and operational activity history',
    who: 'Personnel responsible for security oversight, compliance audits, and investigations',
    summary: 'Allows viewing system audit logs. For personnel reviewing system activity history.',
  },
  'log:summary': {
    what: 'View high-level activity trends, event counts, and operational summary statistics',
    who: 'Personnel monitoring system usage patterns and operational health',
    summary: 'Allows viewing aggregate audit log statistics. For personnel monitoring usage trends.',
  },
  'log:export': {
    what: 'Export the complete audit trail and event logs to CSV or Excel spreadsheets',
    who: 'Personnel extracting audit logs for external oversight or compliance reporting',
    summary: 'Allows exporting the audit trail to spreadsheets. For personnel extracting compliance logs.',
  },

  // ── Messaging & Notifications ──
  'notification:read': {
    what: 'View in-app alerts, pending action reminders, and workflow notifications',
    who: 'Any active system user receiving workflow notifications',
    summary: 'Allows viewing personal notifications and task alerts. For any active system user.',
  },
  'notification:update': {
    what: 'Mark notifications as read or dismiss personal action alerts',
    who: 'Any active system user managing their notification inbox',
    summary: 'Allows acknowledging and dismissing notifications. For any active system user.',
  },
  'notification_template:read': {
    what: 'Inspect email and in-app message templates and wording rules',
    who: 'Personnel reviewing system communication formats',
    summary: 'Allows viewing notification message templates. For personnel reviewing communication formats.',
  },
  'notification_template:write': {
    what: 'Create and update notification email subjects, message bodies, and trigger variables',
    who: 'Personnel responsible for maintaining system communication templates',
    summary: 'Allows editing notification templates. For personnel maintaining system message copy.',
  },
  'notification_template:delete': {
    what: 'Remove obsolete notification templates from the system',
    who: 'Personnel responsible for maintaining system communication templates',
    summary: 'Allows removing notification templates. For personnel maintaining system message copy.',
  },
  'notification_queue:read': {
    what: 'Monitor background message delivery queues, failure rates, and dispatch performance',
    who: 'Personnel monitoring platform communication health and dispatch reliability',
    summary: 'Allows monitoring message queue performance. For personnel tracking message delivery.',
  },

  // ── Background Jobs ──
  'job:read': {
    what: 'View scheduled background tasks, execution schedules, and run history',
    who: 'Personnel monitoring automated system maintenance and batch jobs',
    summary: 'Allows viewing background task status. For personnel monitoring automated operations.',
  },
  'job:admin': {
    what: 'Trigger, pause, or configure automated background jobs and maintenance runs',
    who: 'Personnel responsible for controlling system automation and batch processes',
    summary: 'Allows managing and running background tasks. For personnel managing batch processes.',
  },

  // ── Workflow & Approvals ──
  'approval:read': {
    what: 'View approval requests, step timelines, sign-off status, and attached items',
    who: 'Anyone participating in, tracking, or reviewing workflow approvals',
    summary: 'Allows viewing approval workflows and status. For anyone tracking approval requests.',
  },
  'approval:approve': {
    what: 'Approve and sign off on pending steps across standard approval workflows',
    who: 'Anyone authorized to provide formal intermediate or departmental approval sign-offs',
    summary: 'Allows approving workflow steps. For anyone authorized to provide approval sign-offs.',
  },
  'approval:reject': {
    what: 'Reject a pending approval step and return it to the submitter with revision notes',
    who: 'Anyone authorized to review and return submitted items for necessary corrections',
    summary: 'Allows rejecting approval steps with feedback. For anyone authorized to review submissions.',
  },
  'approval:cancel': {
    what: 'Withdraw or cancel an active approval process before it concludes',
    who: 'Personnel authorized to recall or cancel active approval workflows',
    summary: 'Allows cancelling active approval workflows. For personnel authorized to withdraw requests.',
  },
  'assignment:read': {
    what: 'View task assignments, allocated deadlines, and team workload distribution',
    who: 'Anyone reviewing assigned work items and team task allocations',
    summary: 'Allows viewing task assignments and workloads. For anyone reviewing allocated duties.',
  },
  'assignment:create': {
    what: 'Assign audit procedures, fieldwork duties, and review tasks to team members',
    who: 'Personnel responsible for delegating work and allocating team duties',
    summary: 'Allows assigning tasks to team members. For personnel coordinating team workloads.',
  },
  'assignment:delete': {
    what: 'Remove or reallocate assigned tasks and responsibilities from staff',
    who: 'Personnel responsible for adjusting team workload allocations',
    summary: 'Allows unassigning or reallocating tasks. For personnel managing workload distribution.',
  },
  'escalation:read': {
    what: 'Track overdue workflows, OLA deadline breaches, and triggered escalation notices',
    who: 'Personnel responsible for monitoring timeline adherence and operational milestones',
    summary: 'Allows tracking workflow escalations and OLA breaches. For personnel monitoring deadlines.',
  },
  'escalation:acknowledge': {
    what: 'Formally acknowledge and record action plans on escalated workflow alerts',
    who: 'Personnel responsible for resolving overdue tasks and handling escalated issues',
    summary: 'Allows acknowledging escalated alerts. For personnel responsible for resolving overdue tasks.',
  },
  'escalation_policy:read': {
    what: 'View escalation tiers, breach response windows, and OLA notification policies',
    who: 'Personnel reviewing operational response policies and OLA rules',
    summary: 'Allows viewing escalation rules and policies. For personnel reviewing OLA governance.',
  },
  'escalation_policy:update': {
    what: 'Configure escalation thresholds, breach time limits, and notification recipients',
    who: 'Personnel responsible for governing workflow OLA policies and escalation pathways',
    summary: 'Allows editing escalation policies. For personnel configuring workflow OLA pathways.',
  },
  'request:create': {
    what: 'Initiate and dispatch ad-hoc document review, approval, and signature requests',
    who: 'Anyone needing colleagues or external stakeholders to review or sign attached documents',
    summary: 'Allows initiating ad-hoc review and signature requests. For anyone circulating documents for signature.',
  },
  'request:read': {
    what: 'View ad-hoc document requests, signatures applied, and current routing progress',
    who: 'Anyone participating in or monitoring ad-hoc document routing',
    summary: 'Allows viewing ad-hoc document requests. For anyone participating in document review workflows.',
  },
  'request:receive': {
    what: 'Permit this user to be selected as an intended recipient in ad-hoc document workflows',
    who: 'Anyone whose duties include reviewing, commenting on, or signing ad-hoc documents',
    summary: 'Allows being selected to receive document requests. For anyone eligible to review or sign files.',
  },
  'request:act': {
    what: 'Review, append signature, approve, reject, or comment on received document requests',
    who: 'Anyone assigned to act upon, sign, or review received document requests',
    summary: 'Allows signing, approving, or commenting on requests. For anyone actioning received documents.',
  },
  'request:admin': {
    what: 'Oversee, reassign, or cancel any ad-hoc document request across the organization',
    who: 'Personnel responsible for enterprise-wide document workflow administration',
    summary: 'Allows administering any document request organization-wide. For personnel governing document workflows.',
  },

  // ── Audit Universe & Planning ──
  'universe:read': {
    what: 'View auditable business units, systems, subsidiaries, and high-level risk profiles',
    who: 'Anyone needing visibility into the organizational audit landscape and universe entities',
    summary: 'Allows viewing the audit universe. For anyone needing visibility into auditable entities.',
  },
  'universe:create': {
    what: 'Add new business units, operational processes, or systems to the audit universe',
    who: 'Personnel responsible for mapping and maintaining the organizational audit scope',
    summary: 'Allows adding entities to the audit universe. For personnel defining the audit scope.',
  },
  'universe:update': {
    what: 'Update auditable entity details, risk assessments, and operational scope boundaries',
    who: 'Personnel responsible for keeping audit universe entity information current',
    summary: 'Allows editing audit universe entities. For personnel maintaining entity risk profiles.',
  },
  'universe:delete': {
    what: 'Archive or retire dissolved business units and systems from the audit universe',
    who: 'Personnel authorized to clean up or decommission audit universe records',
    summary: 'Allows removing entities from the universe. For personnel curating the audit universe.',
  },
  'plan:read': {
    what: 'View annual and multi-year audit programmes, planned periods, and scheduled audits',
    who: 'Anyone referencing scheduled audit plans, scopes, and timelines',
    summary: 'Allows viewing audit plans and schedules. For anyone referencing scheduled audit periods.',
  },
  'plan:create': {
    what: 'Draft new annual audit programmes, priority schedules, and planned timelines',
    who: 'Personnel responsible for formulating organizational audit strategies and annual plans',
    summary: 'Allows creating audit programmes. For personnel formulating organizational audit plans.',
  },
  'plan:update': {
    what: 'Modify audit schedules, planned resources, and timelines in drafted audit programmes',
    who: 'Personnel responsible for maintaining and refining scheduled audit programmes',
    summary: 'Allows editing audit programmes. For personnel maintaining scheduled audit plans.',
  },
  'plan:add_item': {
    what: 'Add individual audit engagements and projects into an active audit programme',
    who: 'Personnel responsible for detailing specific engagements within the audit schedule',
    summary: 'Allows adding engagements to an audit plan. For personnel scheduling specific audits.',
  },
  'plan:submit': {
    what: 'Submit a formulated audit programme into the executive sign-off chain for authorization',
    who: 'Personnel responsible for finalizing and presenting the audit plan for formal approval',
    summary: 'Allows submitting audit plans for approval. For personnel finalizing annual audit schedules.',
  },
  'plan:approve': {
    what: 'Formally approve and authorize an annual or periodic audit programme to execute',
    who: 'Anyone with formal executive authority to approve and sanction organizational audit plans',
    summary: 'Allows formally approving audit plans. For anyone authorized to sanction annual audit programmes.',
  },
  'plan:reject': {
    what: 'Return a submitted audit plan for revision, scope adjustments, or budget modifications',
    who: 'Anyone with executive sign-off authority requiring adjustments before authorization',
    summary: 'Allows rejecting audit plans with revision feedback. For anyone with audit plan approval authority.',
  },

  // ── Engagements & Fieldwork ──
  'engagement:read': {
    what: 'View assigned audit engagements, procedures, scopes, and team members',
    who: 'Anyone participating in or reviewing specific audit engagements',
    summary: 'Allows viewing assigned audit engagements. For anyone participating in specific audits.',
  },
  'engagement:read_all': {
    what: 'View all audit engagements across the entire organization regardless of team assignment',
    who: 'Personnel with organization-wide oversight responsibility requiring total visibility',
    summary: 'Allows viewing all audits organization-wide. For personnel requiring complete audit oversight.',
  },
  'engagement:create': {
    what: 'Initiate and set up a new audit engagement from an approved annual plan',
    who: 'Personnel responsible for launching and organizing new audit projects',
    summary: 'Allows initiating new audit engagements. For personnel launching audit projects.',
  },
  'engagement:update': {
    what: 'Modify engagement scopes, objectives, budgeted hours, milestones, and audit teams',
    who: 'Personnel responsible for managing audit project delivery and operational progress',
    summary: 'Allows editing engagement details and timelines. For personnel managing audit delivery.',
  },
  'engagement:delete': {
    what: 'Cancel or remove unstarted audit engagements from the active roster',
    who: 'Personnel responsible for managing the audit project portfolio',
    summary: 'Allows cancelling audit engagements. For personnel managing audit project portfolios.',
  },
  'checklist:read': {
    what: 'View audit control testing checklists, testing questions, and expected procedures',
    who: 'Personnel reviewing audit testing programs and fieldwork criteria',
    summary: 'Allows viewing control testing checklists. For personnel reviewing audit test criteria.',
  },
  'checklist:create': {
    what: 'Add new control procedures and verification checklists to an engagement',
    who: 'Personnel designing fieldwork test steps and audit procedures',
    summary: 'Allows creating audit test checklists. For personnel designing fieldwork procedures.',
  },
  'checklist:update': {
    what: 'Execute test steps, record pass/fail results, and document verification notes',
    who: 'Personnel conducting fieldwork testing and documenting test results',
    summary: 'Allows executing and updating checklist items. For personnel conducting fieldwork testing.',
  },
  'working_paper:read': {
    what: 'Read working papers, testing matrices, sample calculations, and auditor notes',
    who: 'Anyone reviewing fieldwork evidence and technical audit work papers',
    summary: 'Allows viewing audit working papers. For anyone reviewing fieldwork evidence.',
  },
  'working_paper:create': {
    what: 'Draft new working papers, testing sheets, and documented fieldwork records',
    who: 'Personnel conducting audit fieldwork and documenting technical testing',
    summary: 'Allows creating working papers. For personnel documenting technical audit testing.',
  },
  'working_paper:update': {
    what: 'Edit working paper content, testing notes, and preliminary observations',
    who: 'Personnel conducting and refining technical audit testing documentation',
    summary: 'Allows editing working papers. For personnel refining fieldwork testing notes.',
  },
  'working_paper:submit': {
    what: 'Submit completed working papers into the supervisory review and sign-off workflow',
    who: 'Personnel completing fieldwork procedures and readying papers for review',
    summary: 'Allows submitting working papers for review. For personnel completing audit fieldwork.',
  },
  'working_paper:approve': {
    what: 'Formally review, sign off, and approve submitted audit working papers',
    who: 'Anyone responsible for quality review and technical verification of audit work papers',
    summary: 'Allows formally approving working papers. For anyone responsible for quality sign-off on fieldwork.',
  },
  'working_paper:reject': {
    what: 'Return working papers for further sampling, clarification, or testing corrections',
    who: 'Anyone responsible for reviewing audit work papers requiring additional evidence',
    summary: 'Allows rejecting working papers for revisions. For anyone reviewing fieldwork quality.',
  },

  // ── Evidence & Findings ──
  'evidence:read': {
    what: 'View and inspect supporting files, spreadsheets, and artifacts attached as evidence',
    who: 'Anyone reviewing factual evidence supporting audit observations and tests',
    summary: 'Allows viewing audit evidence files. For anyone reviewing supporting audit documentation.',
  },
  'evidence:upload': {
    what: 'Upload supporting documents, logs, and screenshots as factual audit evidence',
    who: 'Anyone contributing proof, files, or responses to an audit engagement',
    summary: 'Allows uploading audit evidence. For anyone contributing factual supporting files.',
  },
  'evidence:dispute': {
    what: 'Submit counter-arguments or challenge findings based on provided evidence',
    who: 'Anyone providing official departmental responses or clarifying provided evidence',
    summary: 'Allows disputing provided evidence. For anyone submitting counter-evidence or clarifications.',
  },
  'evidence:request': {
    what: 'Send formal evidence and documentation requests to auditee departments',
    who: 'Personnel requesting files and information from audited operational teams',
    summary: 'Allows requesting evidence from auditees. For personnel collecting documentation.',
  },
  'finding:read': {
    what: 'View documented audit findings, root cause analyses, and recommended actions',
    who: 'Anyone tracking audit observations, compliance gaps, and remediation items',
    summary: 'Allows viewing audit findings and actions. For anyone tracking audit observations.',
  },
  'finding:read_all': {
    what: 'View all audit findings across all engagements organization-wide',
    who: 'Personnel overseeing organizational remediation, enterprise risk, and compliance tracking',
    summary: 'Allows viewing all findings organization-wide. For personnel overseeing organization-wide remediation.',
  },
  'finding:create': {
    what: 'Document new audit findings, risk ratings, root causes, and recommendations',
    who: 'Personnel identifying and reporting control deficiencies during an audit',
    summary: 'Allows creating new audit findings. For personnel identifying control gaps during audits.',
  },
  'finding:update': {
    what: 'Refine finding severity, management responses, and remediation timelines',
    who: 'Personnel maintaining and updating documented finding details',
    summary: 'Allows editing finding details and severity. For personnel maintaining finding records.',
  },
  'finding:close': {
    what: 'Validate remediation evidence and formally close out resolved findings in the approval chain',
    who: 'Anyone authorized to certify that a finding has been satisfactorily remediated and can be closed',
    summary: 'Allows formally closing verified findings. For anyone authorized to certify remediation completion.',
  },
  'finding:export': {
    what: 'Export the complete findings register with status and aging to CSV or Excel',
    who: 'Personnel extracting finding registers for tracking, board packs, or compliance reports',
    summary: 'Allows exporting findings to spreadsheets. For personnel extracting issue registers.',
  },
  'followup:read': {
    what: 'Monitor remediation action statuses, implementation progress, and upcoming deadlines',
    who: 'Personnel tracking the resolution of open audit recommendations',
    summary: 'Allows monitoring remediation progress. For personnel tracking issue resolution.',
  },
  'followup:respond': {
    what: 'Submit official management action plans, milestone updates, and target completion dates',
    who: 'Anyone responsible for implementing agreed audit recommendations and corrective actions',
    summary: 'Allows submitting management responses. For anyone responsible for delivering corrective actions.',
  },
  'followup:evidence': {
    what: 'Upload completion certificates, configuration proof, or evidence of implemented remediation',
    who: 'Anyone submitting evidence demonstrating that an audit finding has been addressed',
    summary: 'Allows uploading remediation evidence. For anyone submitting proof of completed corrective actions.',
  },
  'followup:verify': {
    what: 'Conduct follow-up testing and verify that implemented actions effectively remediated the risk',
    who: 'Personnel responsible for confirming that remediation actions are genuinely effective',
    summary: 'Allows verifying remediation effectiveness. For personnel testing implemented corrective actions.',
  },

  // ── Reports & Issuance ──
  'report:read': {
    what: 'View completed audit reports, executive summaries, and formal review documents',
    who: 'Anyone authorized to read formal audit review reports and leadership summaries',
    summary: 'Allows reading audit review reports. For anyone authorized to inspect completed audit reports.',
  },
  'report:create': {
    what: 'Compile and generate new formal audit review reports from engagement findings',
    who: 'Personnel responsible for drafting and assembling formal audit review reports',
    summary: 'Allows drafting audit reports. For personnel compiling formal audit review documents.',
  },
  'report:update': {
    what: 'Edit executive summaries, methodology sections, and formatting on draft audit reports',
    who: 'Personnel refining and editing formal audit review report contents',
    summary: 'Allows editing draft audit reports. For personnel refining report text and structure.',
  },
  'report:submit': {
    what: 'Submit completed audit reports into the formal review and approval matrix',
    who: 'Personnel finalizing audit reports and advancing them for formal approval sign-off',
    summary: 'Allows submitting reports for approval. For personnel submitting reports into the sign-off chain.',
  },
  'report:approve': {
    what: 'Approve audit reports at standard stages within the approval matrix',
    who: 'Anyone authorized to review and provide approval sign-off on audit reports',
    summary: 'Allows approving audit reports in the matrix. For anyone authorized to approve report contents.',
  },
  'report:approve:oversight': {
    what: 'Provide designated intermediate oversight sign-off in the audit report approval chain',
    who: 'Anyone responsible for high-level supervisory and quality review prior to final executive sign-off',
    summary: 'Allows supervisory oversight sign-off on reports. For anyone providing high-level review before final issuance.',
  },
  'report:approve:final': {
    what: 'Provide the definitive final executive sign-off authorizing formal report release',
    who: 'Anyone with ultimate executive authority to authorize and release official audit reports',
    summary: 'Allows final executive sign-off on reports. For anyone with ultimate authority to release official audit reports.',
  },
  'report:reject': {
    what: 'Return an audit report to the drafters with required revisions or clarifications',
    who: 'Anyone with report sign-off authority requiring corrections before approval',
    summary: 'Allows returning audit reports for revision. For anyone with report sign-off authority requiring corrections.',
  },
  'report:issue': {
    what: 'Officially release and publish an approved audit report to executive leadership and auditees',
    who: 'Anyone authorized to officially issue finalized audit reports to stakeholders',
    summary: 'Allows officially issuing approved reports. For anyone authorized to publish final reports.',
  },
  'report:export': {
    what: 'Download official audit reports in branded PDF or DOCX format matching the corporate template',
    who: 'Anyone authorized to export or print official audit reports',
    summary: 'Allows exporting reports to PDF or DOCX. For anyone authorized to download branded reports.',
  },

  // ── Compliance & Controls ──
  'control:read': {
    what: 'View compliance frameworks (NDPR, ISO 27001, PCI-DSS) and control requirement libraries',
    who: 'Anyone reviewing compliance benchmarks and control requirements tested during audits',
    summary: 'Allows viewing compliance frameworks and controls. For anyone reviewing compliance standards.',
  },
  'control:manage': {
    what: 'Create, customize, and update compliance frameworks, control objectives, and procedures',
    who: 'Personnel responsible for establishing and maintaining organizational compliance frameworks',
    summary: 'Allows managing compliance frameworks and controls. For personnel governing compliance benchmarks.',
  },

  // ── Risk Management ──
  'risk_category:read': {
    what: 'View the taxonomy of organizational risk categories and classifications',
    who: 'Anyone referencing risk classifications across the enterprise',
    summary: 'Allows viewing risk categories. For anyone referencing organizational risk classifications.',
  },
  'risk_category:write': {
    what: 'Add and edit risk classifications, category structures, and taxonomy groups',
    who: 'Personnel structuring and maintaining the enterprise risk classification tree',
    summary: 'Allows creating and editing risk categories. For personnel structuring the risk register.',
  },
  'risk_category:delete': {
    what: 'Remove obsolete or unused risk categories from the classification taxonomy',
    who: 'Personnel managing and curating the enterprise risk taxonomy',
    summary: 'Allows removing unused risk categories. For personnel curating the risk register structure.',
  },
  'risk:read': {
    what: 'View registered risks, inherent/residual scores, and assigned mitigation strategies',
    who: 'Anyone monitoring operational, strategic, financial, or technology risks',
    summary: 'Allows viewing registered risks and scores. For anyone monitoring operational and business risks.',
  },
  'risk:read_all': {
    what: 'View the complete enterprise risk register across all departments and systems',
    who: 'Personnel requiring total organization-wide risk visibility for executive governance',
    summary: 'Allows viewing all enterprise risks organization-wide. For personnel requiring complete risk visibility.',
  },
  'risk:create': {
    what: 'Log and register new operational, compliance, financial, or cyber risks',
    who: 'Personnel identifying and registering emerging risks into the risk register',
    summary: 'Allows logging new risks in the register. For personnel registering emerging risks.',
  },
  'risk:update': {
    what: 'Update risk ratings, mitigation controls, impact values, and likelihood assessments',
    who: 'Personnel responsible for maintaining and updating risk assessment records',
    summary: 'Allows updating risk ratings and mitigations. For personnel maintaining risk assessments.',
  },
  'risk:delete': {
    what: 'Retire or archive resolved and decommissioned risk entries',
    who: 'Personnel authorized to manage and curate the enterprise risk portfolio',
    summary: 'Allows deleting or retiring risk records. For personnel curating the risk register.',
  },
  'risk:assess': {
    what: 'Conduct formal risk evaluations, calculate risk scores, and populate risk heatmaps',
    who: 'Personnel conducting risk assessments and scoring risk exposure',
    summary: 'Allows performing formal risk assessments. For personnel scoring and evaluating risk exposure.',
  },
  'risk_monitoring:read': {
    what: 'Track key risk indicators, threshold breaches, and risk movement trends over time',
    who: 'Personnel monitoring ongoing risk metrics and early-warning indicators',
    summary: 'Allows viewing risk monitoring data and indicators. For personnel tracking ongoing risk indicators.',
  },
  'risk:export': {
    what: 'Export the complete organizational risk register to Excel or CSV format',
    who: 'Personnel extracting risk data for executive reviews or committee reporting',
    summary: 'Allows exporting the risk register to spreadsheets. For personnel extracting risk data for reporting.',
  },

  // ── Analytics & Governance ──
  'dashboard:read': {
    what: 'View executive analytics dashboards, completion rates, and department performance KPIs',
    who: 'Anyone monitoring audit progress, open finding aging, and high-level performance',
    summary: 'Allows viewing analytics dashboards and KPIs. For anyone monitoring organizational audit performance.',
  },
  'committee_pack:read': {
    what: 'View and export the executive Audit Committee briefing pack (org-wide status, risk bands, open issues)',
    who: 'Anyone authorized to inspect high-level board governance materials and committee summaries',
    summary: 'Allows viewing and exporting the Audit Committee pack. For anyone authorized to inspect board governance reports.',
  },

  // ── Asset Registry ──
  'asset:read': {
    what: 'View hardware, software, facility, and data assets recorded in the asset inventory',
    who: 'Anyone referencing corporate asset records, owners, and criticality levels',
    summary: 'Allows viewing the asset registry. For anyone referencing corporate asset records.',
  },
  'asset:create': {
    what: 'Register new physical, cloud, application, or data assets into the inventory',
    who: 'Personnel responsible for adding and tracking new assets in the organization',
    summary: 'Allows registering new assets in the inventory. For personnel tracking corporate assets.',
  },
  'asset:update': {
    what: 'Update asset specifications, assigned custodians, lifecycle states, and data classifications',
    who: 'Personnel responsible for maintaining accurate asset metadata and ownership',
    summary: 'Allows editing asset details and classifications. For personnel maintaining asset information.',
  },
  'asset:delete': {
    what: 'Decommission or remove retired assets from the active registry',
    who: 'Personnel authorized to manage asset retirements and inventory cleanups',
    summary: 'Allows removing retired assets. For personnel managing asset decommissioning.',
  },
  'asset:admin': {
    what: 'Administer asset classification schemes, lifecycle stages, and source registries',
    who: 'Personnel governing enterprise asset policies and classification standards',
    summary: 'Allows administering asset classification rules. For personnel governing enterprise asset policies.',
  },
  'asset:attest': {
    what: 'Formally attest that assigned assets are physically verified, operational, and accurately recorded',
    who: 'Asset custodians and department leads certifying asset custody and accuracy',
    summary: 'Allows certifying asset custody and accuracy. For asset custodians certifying assigned assets.',
  },
  'asset:import': {
    what: 'Batch import asset records from spreadsheets or approved external discovery sources',
    who: 'Personnel synchronizing external asset inventories into the central registry',
    summary: 'Allows importing asset records from files. For personnel bulk-loading asset databases.',
  },
  'asset:link': {
    what: 'Associate assets directly with audit engagements, universe entities, findings, and risks',
    who: 'Personnel linking business assets to audit scope items and observations',
    summary: 'Allows linking assets to audits and findings. For personnel mapping assets to audit observations.',
  },
  'asset:export': {
    what: 'Export the asset inventory to CSV or Excel with classification and custody details',
    who: 'Personnel extracting asset registries for reporting or external compliance audits',
    summary: 'Allows exporting asset records to spreadsheets. For personnel extracting asset inventories.',
  },

  // ── Integrations & IMOC ──
  'integration:read': {
    what: 'View the connection status, health, and configurations of external system integrations',
    who: 'Personnel monitoring integration connectivity and data pipelines',
    summary: 'Allows viewing integration health and configs. For personnel monitoring external data pipelines.',
  },
  'imoc:read': {
    what: 'View ingested IT service management tickets, incident logs, and OLA metrics',
    who: 'Anyone referencing IT support incidents and service tickets during audits',
    summary: 'Allows viewing ingested IT service tickets. For anyone referencing IT incidents during audits.',
  },
  'imoc:link': {
    what: 'Link and unlink specific operational IT tickets to relevant audit engagements',
    who: 'Personnel linking incident tickets directly to audit procedures and evidence',
    summary: 'Allows linking IT tickets to audit engagements. For personnel connecting incidents to audits.',
  },
  'imoc:capture': {
    what: 'Capture redacted IT service ticket snapshots as tamper-evident audit proof',
    who: 'Personnel collecting operational incident snapshots for audit evidence files',
    summary: 'Allows capturing ticket snapshots as evidence. For personnel collecting incident proof.',
  },
  'imoc:sync': {
    what: 'Trigger on-demand synchronization to pull the latest updates from the IT service desk',
    who: 'Personnel needing immediate refresh of operational ticket data',
    summary: 'Allows triggering ticket synchronization. For personnel refreshing operational IT data.',
  },
  'imoc:rules': {
    what: 'Configure automated rules determining which IT tickets (OLA breaches, critical incidents) are ingested',
    who: 'Personnel responsible for establishing automated ticket ingestion criteria',
    summary: 'Allows configuring automated ticket ingestion rules. For personnel setting incident capture criteria.',
  },
  'imoc:ingest': {
    what: 'Execute on-demand ingestion runs based on configured ticket rules',
    who: 'Personnel running manual ticket ingestion batches',
    summary: 'Allows executing ticket ingestion runs. For personnel running automated incident capture.',
  },
  'imoc:export': {
    what: 'Export ingested ticket records and OLA metrics to CSV or spreadsheet format',
    who: 'Personnel extracting ticket logs for IT audit analysis and compliance reporting',
    summary: 'Allows exporting IT tickets to spreadsheets. For personnel extracting incident records.',
  },
  'predictive:read': {
    what: 'View predictive analytics models, risk forecasts, and automated anomaly insights',
    who: 'Personnel reviewing data-driven risk projections and predictive audit indicators',
    summary: 'Allows viewing predictive risk insights. For personnel reviewing data-driven risk forecasts.',
  },

  // ── Technical System Audit & Security ──
  'sysaudit:read': {
    what: 'View automated security diagnostics, access reviews, and continuous monitoring exceptions',
    who: 'Personnel inspecting technical security configurations and continuous monitoring alerts',
    summary: 'Allows viewing automated security checks and alerts. For personnel inspecting technical security posture.',
  },
  'sysaudit:run': {
    what: 'Run diagnostic analyses and access checks against uploaded system exports and live sources',
    who: 'Personnel conducting technical system audits and automated configuration reviews',
    summary: 'Allows running technical diagnostic analyses. For personnel conducting technical system audits.',
  },
  'sysaudit:review': {
    what: 'Record disposition decisions on detected security exceptions and sign off access reviews',
    who: 'Personnel adjudicating security exceptions and validating access review results',
    summary: 'Allows adjudicating security exceptions. For personnel validating technical audit findings.',
  },
  'sysaudit:admin': {
    what: 'Approve configuration baselines and trigger continuous monitoring scans on demand',
    who: 'Personnel responsible for governing technical security baselines and automated monitors',
    summary: 'Allows approving baseline configurations and monitors. For personnel governing security baselines.',
  },
  'sectest:read': {
    what: 'View vulnerability assessments and penetration testing scopes and results',
    who: 'Personnel reviewing technical security testing findings and remediation status',
    summary: 'Allows viewing vulnerability and penetration test reports. For personnel reviewing security test results.',
  },
  'sectest:manage': {
    what: 'Plan, schedule, coordinate security tests, attach vendor reports, and track findings',
    who: 'Personnel responsible for coordinating technical security and penetration testing',
    summary: 'Allows coordinating penetration tests and security assessments. For personnel managing technical tests.',
  },
  'sectest:authorise': {
    what: 'Grant formal authorization for ethical hacking and penetration tests to execute',
    who: 'Anyone with formal authority to sanction intrusive technical testing on infrastructure (must not be the test coordinator)',
    summary: 'Allows authorizing penetration tests to proceed. For anyone authorized to sanction technical security testing.',
  },
  'sysdoc:read': {
    what: 'Access the secure library of corporate architecture diagrams, manuals, and vendor contracts',
    who: 'Personnel reviewing technical system architecture and documentation',
    summary: 'Allows viewing system architecture and documentation. For personnel reviewing technical manuals.',
  },
  'sysdoc:manage': {
    what: 'Upload, version, categorize, and archive technical documentation and network diagrams',
    who: 'Personnel responsible for maintaining technical system documentation libraries',
    summary: 'Allows managing technical documentation. For personnel maintaining system manuals and diagrams.',
  },

  // ── General Settings ──
  'settings:read': {
    what: 'View system configuration parameters, OLA rules, and organizational settings',
    who: 'Anyone needing visibility into organization parameters and workflow configuration',
    summary: 'Allows viewing system settings and configurations. For anyone referencing platform settings.',
  },
  'settings:manage': {
    what: 'Update organizational details, OLA rules, approval matrices, and system parameters',
    who: 'Personnel authorized to administer organizational parameters and governance policies',
    summary: 'Allows managing system settings and approval matrices. For personnel governing platform parameters.',
  },
  'report_template:manage': {
    what: 'Configure standardized report sections, branding headers, and corporate layout templates',
    who: 'Personnel responsible for configuring organizational audit report templates',
    summary: 'Allows configuring audit report templates. For personnel managing reporting structures.',
  },
};

/**
 * Returns a human-friendly explanation for a permission slug.
 * If the slug is unmapped, falls back to a cleanly formatted sentence based on action and module.
 */
export function getPermissionExplanation(slug: string): PermissionExplanation {
  if (PERMISSION_EXPLANATIONS[slug]) {
    return PERMISSION_EXPLANATIONS[slug];
  }

  // Fallback for custom or unmapped slugs
  const parts = slug.split(':');
  const action = parts[parts.length - 1].replace(/_/g, ' ');
  const moduleName = parts[0].replace(/_/g, ' ');

  return {
    what: `Perform the "${action}" action within the ${moduleName} module`,
    who: `Anyone authorized to handle ${action} operations for ${moduleName}`,
    summary: `Allows performing ${action} within ${moduleName}. For anyone authorized to handle ${moduleName} operations.`,
  };
}
