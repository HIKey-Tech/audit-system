Done — the working-paper review upgrade is implemented and both builds pass. Two features:

1. Review comments (the tracked-changes replacement). Anyone who can read a working paper can now open it and leave comments in a thread at the bottom of the paper view — "section 3 references the wrong period", the preparer replies, fixes, and either side marks the comment resolved. The preparer gets an in-app notification when a reviewer comments. Resolution is restricted to the comment's author, the paper's preparer, or someone with approve rights. This means a reviewer no longer has to choose between silently approving a flawed paper and nuking it with a rejection.

2. Approve-with-edit for working papers. The "Approve & Sign" panel on a submitted paper now has the same "Found a small issue? Edit & approve instead of rejecting" toggle that reports got in rev 33 — structured papers open per-section editors, free-text papers a single editor. The approver's fix is applied in the same database transaction as the approval step, and it's only sent if the content actually changed. A typo no longer costs a full resubmission cycle.

DB steps on your side (both safe, no data touched):
- npx prisma migrate deploy — applies the new audit_working_paper_comments table (I did not apply this one, per your preference).
- npx prisma db seed — if you haven't already run it for the evidence-request permission; this feature itself needs no seed change.

One heads-up: prisma generate couldn't swap the query-engine DLL because your dev server holds it locked — the TypeScript types regenerated fine, but restart your backend dev server after running the migration so it picks everything up cleanly.

Not verified live — quick smoke test once you've migrated: submit a working paper as the auditor, comment on it as the manager, resolve the comment, then approve it with a small edit and confirm the change shows in the approved paper.
