const DAY_IN_MS = 86_400_000;

function toLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysSince(iso: string | null): number | null {
  if (!iso) {
    return null;
  }

  const failedAt = new Date(iso);

  if (Number.isNaN(failedAt.getTime())) {
    return null;
  }

  const today = toLocalMidnight(new Date()).getTime();
  const then = toLocalMidnight(failedAt).getTime();
  const difference = Math.floor((today - then) / DAY_IN_MS);

  return Math.max(0, difference);
}

export function isDue(task: { lastFailed: string | null }): boolean {
  const age = daysSince(task.lastFailed);
  return age !== null && age >= 4;
}

export function sortTasks<T extends { lastFailed: string | null }>(
  tasks: T[],
): T[] {
  return [...tasks].sort((left, right) => {
    if (left.lastFailed === null && right.lastFailed === null) {
      return 0;
    }

    if (left.lastFailed === null) {
      return 1;
    }

    if (right.lastFailed === null) {
      return -1;
    }

    const leftTimestamp = new Date(left.lastFailed).getTime();
    const rightTimestamp = new Date(right.lastFailed).getTime();

    if (Number.isNaN(leftTimestamp) && Number.isNaN(rightTimestamp)) {
      return 0;
    }

    if (Number.isNaN(leftTimestamp)) {
      return 1;
    }

    if (Number.isNaN(rightTimestamp)) {
      return -1;
    }

    return leftTimestamp - rightTimestamp;
  });
}

export function deriveNameFromTopcodingUrl(link: string): string | null {
  let url: URL;

  try {
    url = new URL(link);
  } catch {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const problemsIndex = segments.indexOf('problems');

  if (problemsIndex === -1) {
    return null;
  }

  const partsAfterProblems = segments.slice(problemsIndex + 1);

  if (partsAfterProblems.length === 0) {
    return null;
  }

  const difficultyTokens = new Set(['easy', 'medium', 'hard']);
  const slug = [...partsAfterProblems]
    .reverse()
    .find(
      (segment) =>
        !/^\d+$/.test(segment) &&
        !difficultyTokens.has(segment.toLowerCase()) &&
        /[a-zA-Z]/.test(segment),
    );

  if (!slug) {
    return null;
  }

  const decodedSlug = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();

  const words = decodedSlug
    .split(/[-_]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return null;
  }

  return words
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
