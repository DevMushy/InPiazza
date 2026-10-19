export const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
);
export const Back = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
);
export const Close = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Person = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4.2" /><path d="M3.8 20.5c.6-4.2 4-6.6 8.2-6.6s7.6 2.4 8.2 6.6c.1.5-.3.9-.8.9H4.6c-.5 0-.9-.4-.8-.9z" /></svg>
);
export const Caret = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 8l7 8 7-8z" /></svg>
);
export const Calendar = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm-2 8h14v10H5z" /></svg>
);
export const NumPin = ({ n }: { n: number }) => (
  <span className="num-pin">
    <svg viewBox="0 0 26 32" aria-hidden="true"><path d="M13 31C9 24 1.5 19 1.5 12a11.5 11.5 0 0 1 23 0c0 7-7.5 12-11.5 19z" fill="var(--btn-bg)" /></svg>
    <span>{n}</span>
  </span>
);
export const Pin = () => (
  <svg width="10" height="12" viewBox="0 0 24 28" fill="currentColor" aria-hidden="true"><path d="M12 27C8 20.5 2 16.5 2 10.5a10 10 0 0 1 20 0c0 6-6 10-10 16.5zm0-12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
);
export const Search = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8" /></svg>
);
