/**
 * The Python launcher for the specs that reseed or query MySQL through scripts/. On Windows
 * `python3` is usually only the Microsoft Store placeholder, so use `py` there (CLAUDE.md,
 * Section 12). PYTHON overrides both.
 */
export const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'py' : 'python3');
