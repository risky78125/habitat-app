import type { Agent, Conversation } from './api'

export interface DisplayAgent extends Agent {
  displayIcon: string
  chipGradient?: string
  cardGradient?: string
  displayCategory?: string
  isImage?: boolean
}

export interface DisplayConversation extends Conversation {
  displayTime: string
  displayIcon?: string
  convGradient?: string
  isImage?: boolean
}
