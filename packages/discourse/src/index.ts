export {
  absoluteAppAssetUrl,
  applySsoAvatarFields,
  avatarUrlForDiscourse,
  isCustomDiscourseAvatar,
  resolveDiscourseAvatarDownloadUrl,
} from './avatar'
export { DiscourseService } from './client'
export { DiscourseApiError, isDiscourseNotFound } from './errors'
export type { DiscourseReturnUrlAllowlist } from './sso'
export {
  hmacSha256Hex,
  isAllowedBrowserOrigin,
  parseAllowedDiscourseReturnUrl,
  parseAllowedLogoutReturnUrl,
  publicDiscourseOrigin,
  verifyDiscourseSsoPayload,
} from './sso'
export type {
  CreateCategoryData,
  CreateGroupData,
  DiscourseCategoryApi,
  DiscourseCategoryWithNotification,
  DiscourseConfig,
  DiscourseGroupBasic,
  DiscourseNotificationLevel,
  DiscourseTagBasic,
  DiscourseTagListEntry,
  DiscourseTagNotification,
  DiscourseUserMailProfile,
  DiscourseUserMailResponse,
  ListCategoriesResponse,
  ShowCategoryResponse,
  SsoUserData,
  UpdateCategoryData,
  UpdateGroupData,
} from './types'
export {
  DISCOURSE_TAG_NAME,
  echoOwnPostsFromFrequency,
  flattenCategoryList,
  frequencyForEchoOwnPosts,
  isDiscourseTagName,
  MAILING_LIST_FREQUENCY,
  mergeTagSubscription,
  mergeWatchedTags,
  NOTIFICATION_LEVEL_MUTED,
  NOTIFICATION_LEVEL_REGULAR,
  NOTIFICATION_LEVEL_WATCHING,
  parseUserMailProfile,
  resolveDiscourseExternalId,
  tagNames,
} from './types'
