import { redirect } from 'next/navigation';

/** /workflow has no view of its own — send users to the first sub-page. */
export default function WorkflowIndexPage(): never {
  redirect('/workflow/approvals');
}
