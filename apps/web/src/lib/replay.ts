/** Display the supplied clock basis without interpreting naive timestamps as UTC. */
export function formatReplayTimestamp(value: string, clock: string): string {
  const utc = clock.toUpperCase().startsWith('UTC');
  const readable = value.replace('T', ' ').replace(/(?:Z|\+00:00)$/, '');
  return `${readable} ${utc ? 'UTC' : '(recorded source clock)'}`;
}
