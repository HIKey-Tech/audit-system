jest.mock('marked', () => ({ Lexer: class {} }));
import { htmlFragmentToMarkdownAndImages } from '../utility/working-paper.utility';

describe('page breaks in exported documents', () => {
  it('a real page break becomes a break marker', () => {
    const { markdown } = htmlFragmentToMarkdownAndImages('<p>One</p><hr data-page-break="true" class="page-break"><p>Two</p>');
    expect(markdown.split('\n').map((l) => l.trim())).toContain('---');
    expect(markdown).toContain('One');
    expect(markdown).toContain('Two');
  });

  it('an ordinary horizontal line does not start a new page', () => {
    const { markdown } = htmlFragmentToMarkdownAndImages('<p>One</p><hr><p>Two</p>');
    expect(markdown).not.toContain('---');
  });
});
