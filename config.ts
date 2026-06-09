// ==================== API ====================

export const BASE_URL = 'https://habitat-api.kalot.net'

export const API = {
  AUTH_LOGIN: '/api/wx/auth/login',
  AUTH_REFRESH: '/api/wx/auth/refresh',

  AGENTS: '/api/wx/agents',
  AGENT_DETAIL: '/api/wx/agents/{id}',
  AGENT_CATEGORIES: '/api/wx/agents/categories',
  AGENT_HOT: '/api/wx/agents/hot',

  CONVERSATIONS: '/api/wx/conversations',
  CONVERSATION_DETAIL: '/api/wx/conversations/{id}',
  CONVERSATION_MESSAGES: '/api/wx/conversations/{id}/messages',
  FAVORITES: '/api/wx/favorites',
  FAVORITE: '/api/wx/favorites/{id}',

  STAR_POWER_BALANCE: '/api/wx/star-power/balance',
  STAR_POWER_TRANSACTIONS: '/api/wx/star-power/transactions',
  STAR_POWER_CHECKIN: '/api/wx/star-power/earn/checkin',
  STAR_POWER_AD_REWARD: '/api/wx/star-power/earn/ad',

  USER_PROFILE: '/api/wx/user/profile',
  USER_AVATAR: '/api/wx/user/avatar',

  FEEDBACK: '/api/wx/feedback',
} as const

export const AUTH_HEADER_PREFIX = 'Bearer '

export const HTTP = {
  OK: 200,
  UNAUTHORIZED: 401,
} as const

// ==================== Storage keys ====================

export const STORAGE = {
  TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
  USER_ID: 'userId',
} as const

// ==================== Pagination ====================

export const PAGE = {
  AGENTS: 10,
  CONVERSATIONS: 20,
  MESSAGES: 50,
  TRANSACTIONS: 20,
  FAVORITES: 20,
  INDEX_QUICK_CATEGORIES: 4,
  INDEX_HOT_AGENTS: 6,
  INDEX_RECENT_CONVERSATIONS: 5,
  INDEX_CONVERSATION_FETCH: 10,
} as const

// ==================== Timeouts & delays (ms) ====================

export const TIMEOUT = {
  AGENT_DETAIL: 10000,
  CONVERSATION_DETAIL: 10000,
  MESSAGES_LOAD: 10000,
  CHAT_LOADING_GUARD: 8000,
  CHAT_SCROLL_TO_BOTTOM: 100,
  CHAT_ONLOAD_FALLBACK: 200,
  FEEDBACK_REDIRECT: 1500,
} as const

// ==================== Defaults & fallbacks ====================

export const DEFAULT_NICKNAME = '用户'
export const DEFAULT_AVATAR_INITIAL = '用'
export const DEFAULT_CHAT_INITIAL = '我'
export const FALLBACK_ICON = '🤖'
export const FALLBACK_CATEGORY_ICON = '📌'
export const FALLBACK_GRADIENT = 'linear-gradient(135deg, #5B6CFF 0%, #8B7FFF 100%)'

// ==================== Login states ====================

export const LOGIN_STATE = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const

// ==================== SSE ====================

export const SSE = {
  DONE_SIGNAL: '[DONE]',
  EVENT_PREFIX: 'event:',
  DATA_PREFIX: 'data:',
  DEFAULT_EVENT: 'message',
} as const

// ==================== Messages ====================

export const MSG = {
  RELOAD_LOGIN: '请重新登录',
  NETWORK_ERROR: '网络错误',
  REQUEST_FAILED: '请求失败',
  AGENT_LOAD_FAIL: '加载智能体失败',
  CONVERSATION_LOAD_FAIL: '加载对话失败',
  AGENT_INFO_ERROR: '智能体信息异常',
  COPIED: '已复制',
  ALREADY_CHECKED_IN: '今天已签到',
  CHECKIN_SUCCESS: '签到成功 +10',
  CHECKIN_FAIL: '签到失败',
  DELETE_CONFIRM_TITLE: '删除对话',
  DELETE_CONFIRM_CONTENT: '确定要删除这个对话吗？',
  DELETED: '已删除',
  DELETE_FAILED: '删除失败',
  LOGOUT_TITLE: '确认退出',
  LOGOUT_CONTENT: '确定要退出登录吗？',
  FEEDBACK_EMPTY: '请输入反馈内容',
  FEEDBACK_SUCCESS: '提交成功，感谢反馈',
  FEEDBACK_FAIL: '提交失败，请重试',
  NICKNAME_REQUIRED: '请输入昵称',
  PROFILE_SETUP_SUCCESS: '设置成功',
  PROFILE_SETUP_FAIL: '设置失败',
  LOAD_FAILED: '加载失败',
  UNFAVORITED: '已取消收藏',
  OPERATION_FAILED: '操作失败',
  FEATURE_WIP: '功能开发中',
} as const

// ==================== Feedback categories ====================

export const FEEDBACK_CATEGORIES = [
  { key: 'bug', label: '问题反馈' },
  { key: 'feature', label: '功能建议' },
  { key: 'other', label: '其他' },
] as const

export const DEFAULT_FEEDBACK_CATEGORY = 'bug'

// ==================== Colors (sync with app.scss) ====================

export const COLOR = {
  PRIMARY: '#5B6CFF',
  TEXT: '#222222',
  TEXT_SECONDARY: '#8B8FA8',
  BG: '#F7F8FC',
  CODE_BG: '#1E1E2E',
  CODE_TEXT: '#CDD6F4',
  BORDER: '#E8E9F0',
  QUOTE_BG: '#F0F1F8',
  QUOTE_TEXT: '#555580',
} as const

// ==================== App meta ====================

export const APP_VERSION = '1.0.0'
