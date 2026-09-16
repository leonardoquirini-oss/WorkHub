/**
 * Minimal logger for the WorkHub client.
 *
 * `debug`/`info` are emitted only in development builds (Vite `import.meta.env.DEV`),
 * `warn`/`error` always. Use this instead of `console.*` so production bundles stay quiet
 * and log lines are consistently prefixed.
 */
const isDev = import.meta.env.DEV
const PREFIX = '[WorkHub]'

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDev) console.debug(PREFIX, ...args)
  },
  info: (...args: unknown[]): void => {
    if (isDev) console.info(PREFIX, ...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn(PREFIX, ...args)
  },
  error: (...args: unknown[]): void => {
    console.error(PREFIX, ...args)
  },
}
