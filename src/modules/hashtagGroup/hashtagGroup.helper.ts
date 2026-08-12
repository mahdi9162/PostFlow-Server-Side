import * as hashtagGroupService from './hashtagGroup.service';

export const validateAndNormalizeHashtags = (tagsInput: string[]): { valid: boolean; normalized: string[]; error?: string } => {
  if (!Array.isArray(tagsInput)) {
    return { valid: false, normalized: [], error: 'Input must be an array' };
  }

  if (tagsInput.length !== 5) {
    return { valid: false, normalized: [], error: 'Exactly 5 hashtags are required' };
  }

  const normalized = tagsInput
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .map(tag => (tag.startsWith('#') ? tag : `#${tag}`));

  if (normalized.length !== 5) {
    return { valid: false, normalized: [], error: 'Empty hashtags are not allowed' };
  }

  const uniqueTags = new Set(normalized.map(tag => tag.toLowerCase()));
  if (uniqueTags.size !== 5) {
    return { valid: false, normalized: [], error: 'Duplicate hashtags are not allowed' };
  }

  return { valid: true, normalized };
};

export const getNextHashtagGroup = async (account: string) => {
  const groups = await hashtagGroupService.findGroupsByAccount(account);
  const enabledGroups = groups.filter((g) => g.enabled);

  if (enabledGroups.length === 0) {
    return null;
  }

  const rotation = await hashtagGroupService.getRotationCursor(account);
  
  // Find first enabled group with order >= nextOrder
  let nextGroup = enabledGroups.find((g) => g.order >= rotation.nextOrder);
  
  // Wrap around if not found
  if (!nextGroup) {
    nextGroup = enabledGroups[0];
  }

  return nextGroup;
};

export const advanceHashtagRotation = async (account: string, currentGroupOrder: number) => {
  const groups = await hashtagGroupService.findGroupsByAccount(account);
  const enabledGroups = groups.filter((g) => g.enabled);
  
  if (enabledGroups.length === 0) return;

  const currentIndex = enabledGroups.findIndex((g) => g.order === currentGroupOrder);
  
  if (currentIndex === -1) {
    // If the group we just used was deleted/disabled/reordered right after we used it,
    // we just safely default to the first group for the next round.
    await hashtagGroupService.saveRotationCursor(account, enabledGroups[0].order);
    return;
  }
  
  const nextIndex = (currentIndex + 1) % enabledGroups.length;
  const nextGroup = enabledGroups[nextIndex];
  
  await hashtagGroupService.saveRotationCursor(account, nextGroup.order);
};
