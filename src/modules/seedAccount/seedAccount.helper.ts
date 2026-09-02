export interface NormalizeResult {
  isValid: boolean;
  username?: string;
  profileUrl?: string;
  error?: string;
}

const RESERVED_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'direct',
  'developer',
  'about',
  'legal',
  'api',
  'graphql',
  'tags',
  'directory',
  'emails',
  'push',
]);

/**
 * Normalizes an Instagram username or profile URL into a clean canonical lowercase username.
 * Rejects post/reel/explore URLs and invalid username characters.
 */
export const normalizeInstagramUsername = (rawInput: string): NormalizeResult => {
  if (typeof rawInput !== 'string') {
    return { isValid: false, error: 'Input must be a string' };
  }

  let input = rawInput.trim();
  if (!input) {
    return { isValid: false, error: 'Instagram username or URL cannot be empty' };
  }

  // Remove leading @
  if (input.startsWith('@')) {
    input = input.slice(1).trim();
  }

  // Check if input is a URL or domain path
  if (
    input.includes('instagram.com') ||
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('www.')
  ) {
    // Ensure URL has protocol for proper URL parsing
    let urlString = input;
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = `https://${urlString}`;
    }

    try {
      const parsed = new URL(urlString);
      const hostname = parsed.hostname.toLowerCase();

      if (!hostname.includes('instagram.com')) {
        return { isValid: false, error: 'URL must be a valid Instagram link (instagram.com)' };
      }

      // Split pathname segments
      const segments = parsed.pathname
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean);

      if (segments.length === 0) {
        return { isValid: false, error: 'URL does not contain an Instagram username' };
      }

      const firstSegment = segments[0].toLowerCase();

      // Reject non-profile paths (posts, reels, stories, explore, etc.)
      if (RESERVED_PATHS.has(firstSegment)) {
        if (firstSegment === 'p') {
          return { isValid: false, error: 'Post URLs are not supported. Provide a profile username or profile URL.' };
        }
        if (firstSegment === 'reel' || firstSegment === 'reels') {
          return { isValid: false, error: 'Reel URLs are not supported. Provide a profile username or profile URL.' };
        }
        if (firstSegment === 'stories') {
          return { isValid: false, error: 'Story URLs are not supported. Provide a profile username or profile URL.' };
        }
        if (firstSegment === 'explore') {
          return { isValid: false, error: 'Explore URLs are not supported. Provide a profile username or profile URL.' };
        }
        return { isValid: false, error: `Invalid Instagram profile URL (${firstSegment})` };
      }

      input = firstSegment;
    } catch {
      return { isValid: false, error: 'Malformed Instagram URL' };
    }
  }

  // Clean trailing query params or hash if raw text had them
  input = input.split('?')[0].split('#')[0].trim();

  // Strip trailing slashes or leading @
  input = input.replace(/^\/+|\/+$/g, '');
  if (input.startsWith('@')) {
    input = input.slice(1).trim();
  }

  // Canonical lowercase
  const canonicalUsername = input.toLowerCase();

  // Validate Instagram username rules:
  // - 1 to 30 characters
  // - Letters, numbers, periods, underscores
  // - No consecutive periods
  // - Cannot start or end with a period
  const igRegex = /^(?!.*\.\.)(?!^\.)[a-z0-9._]{1,30}(?<!\.)$/;

  if (!igRegex.test(canonicalUsername)) {
    return {
      isValid: false,
      error:
        'Invalid Instagram username format. Use 1–30 characters containing only letters, numbers, periods, and underscores (cannot start/end with a period or have consecutive periods).',
    };
  }

  return {
    isValid: true,
    username: canonicalUsername,
    profileUrl: `https://www.instagram.com/${canonicalUsername}/`,
  };
};
