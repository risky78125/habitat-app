import { request, requestSSE, getToken, type PageResult, type SSECallbacks } from './request'
import { BASE_URL, API, PAGE, HTTP } from '../config'

// ==================== 类型定义 ====================

export interface Agent {
  id: number
  name: string
  avatarUrl: string
  icon: string
  category: string
  description: string
  welcomeMessage: string
  isStreaming: boolean
  isHot: boolean
  hotSortOrder: number
  starPowerCostPerRound: number
  sortOrder: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: number
  name: string
  categoryKey: string
  icon: string
  color: string
  bg: string
  gradient: string
  sortOrder: number
  status: number
}

export interface Conversation {
  id: number
  userId: number
  agentId: number
  title: string
  messageCount: number
  totalStarPowerUsed: number
  lastMessageAt: string
  status: number
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: number
  conversationId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  contentType: string
  starPowerCount: number
  modelUsed: string
  metadata: string
  createdAt: string
}

export interface UserProfile {
  id: number
  nickname: string
  avatarUrl: string
  phone: string
  checkinDays: number
  lastCheckinDate: string
  status: number
  createdAt: string
}

export interface StarPowerTransaction {
  id: number
  userId: number
  amount: number
  type: string
  refType: string
  refId: number
  balanceAfter: number
  remark: string
  createdAt: string
}

// ==================== 认证 ====================

export function loginApi(code: string) {
  return request<{
    token: string
    refreshToken: string
    userId: number
    nickname: string
  }>({
    url: API.AUTH_LOGIN,
    method: 'POST',
    data: { code },
    needAuth: false,
  })
}

// ==================== Agent ====================

function qs(params?: Record<string, any>): string {
  if (!params) return ''
  const parts: string[] = []
  for (const k of Object.keys(params)) {
    if (params[k] != null) parts.push(k + '=' + encodeURIComponent(String(params[k])))
  }
  return parts.length > 0 ? '?' + parts.join('&') : ''
}

export function getAgents(params?: {
  category?: string
  keyword?: string
  page?: number
  size?: number
}) {
  return request<PageResult<Agent>>({
    url: API.AGENTS + qs(params),
    needAuth: false,
  })
}

export function getAgentDetail(id: number) {
  return request<Agent>({
    url: API.AGENT_DETAIL.replace('{id}', String(id)),
    needAuth: false,
  })
}

export function getAgentCategories() {
  return request<Category[]>({
    url: API.AGENT_CATEGORIES,
    needAuth: false,
  })
}

export function getHotAgents() {
  return request<Agent[]>({
    url: API.AGENT_HOT,
    needAuth: false,
  })
}

// ==================== 对话 ====================

export function createConversation(agentId: number) {
  return request<Conversation>({
    url: API.CONVERSATIONS,
    method: 'POST',
    data: { agentId },
  })
}

export function getConversations(page = 1, size = PAGE.CONVERSATIONS) {
  return request<PageResult<Conversation>>({
    url: `${API.CONVERSATIONS}?page=${page}&size=${size}`,
  })
}

export function getConversationDetail(id: number) {
  return request<Conversation>({
    url: API.CONVERSATION_DETAIL.replace('{id}', String(id)),
  })
}

export function getMessages(conversationId: number, page = 1, size = PAGE.MESSAGES) {
  return request<PageResult<ChatMessage>>({
    url: `${API.CONVERSATION_MESSAGES.replace('{id}', String(conversationId))}?page=${page}&size=${size}`,
  })
}

export function sendMessage(conversationId: number, content: string, callbacks: SSECallbacks) {
  return requestSSE(conversationId, content, callbacks)
}

export function deleteConversation(id: number) {
  return request<void>({
    url: API.CONVERSATION_DETAIL.replace('{id}', String(id)),
    method: 'DELETE',
  })
}

// ==================== 星力 ====================

export function getStarPowerBalance() {
  return request<{ balance: number }>({
    url: API.STAR_POWER_BALANCE,
  })
}

export function getStarPowerTransactions(page = 1, size = PAGE.TRANSACTIONS) {
  return request<PageResult<StarPowerTransaction>>({
    url: `${API.STAR_POWER_TRANSACTIONS}?page=${page}&size=${size}`,
  })
}

export function checkin() {
  return request<void>({
    url: API.STAR_POWER_CHECKIN,
    method: 'POST',
  })
}

// ==================== 用户 ====================

export function getUserProfile() {
  return request<UserProfile>({
    url: API.USER_PROFILE,
  })
}

export function updateUserProfile(data: { nickname?: string; avatarUrl?: string }) {
  return request<void>({
    url: API.USER_PROFILE,
    method: 'PUT',
    data,
  })
}

// ==================== 文件上传 ====================

export function uploadAvatar(filePath: string): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}${API.USER_AVATAR}`,
      filePath,
      name: 'file',
      header: {
        Authorization: 'Bearer ' + getToken(),
      },
      success(res: any) {
        try {
          const body = JSON.parse(res.data)
          if (body.code === HTTP.OK) {
            resolve(body.data)
          } else {
            reject(new Error(body.message || '上传失败'))
          }
        } catch (e) {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail(err) {
        reject(err)
      },
    })
  })
}

// ==================== 广告奖励 ====================

export function earnAdReward() {
  return request<{ balance: number }>({
    url: API.STAR_POWER_AD_REWARD,
    method: 'POST',
  })
}
