/** Today's date (YYYY-MM-DD) on campus, which is what the server uses for "today". */
export function collegeToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
