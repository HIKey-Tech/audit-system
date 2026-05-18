ALTER TABLE [dbo].[audit_working_papers] ADD
  [template_id] NVARCHAR(1000),
  [source_document_id] NVARCHAR(1000),
  [working_paper_type] NVARCHAR(1000) NOT NULL CONSTRAINT [audit_working_papers_working_paper_type_df] DEFAULT 'general',
  [import_metadata] NVARCHAR(max);

CREATE NONCLUSTERED INDEX [audit_working_papers_template_id_idx] ON [dbo].[audit_working_papers]([template_id]);
CREATE NONCLUSTERED INDEX [audit_working_papers_source_document_id_idx] ON [dbo].[audit_working_papers]([source_document_id]);
CREATE NONCLUSTERED INDEX [audit_working_papers_working_paper_type_idx] ON [dbo].[audit_working_papers]([working_paper_type]);

ALTER TABLE [dbo].[audit_working_papers] ADD CONSTRAINT [audit_working_papers_template_id_fkey]
  FOREIGN KEY ([template_id]) REFERENCES [dbo].[working_paper_templates]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[audit_working_papers] ADD CONSTRAINT [audit_working_papers_source_document_id_fkey]
  FOREIGN KEY ([source_document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
