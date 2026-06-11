import { FALLBACK_GRADIENT, FALLBACK_CATEGORY_ICON } from '../config'

export interface CategoryMeta {
  label: string
  icon: string
  color: string
  bg: string
  gradient: string
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  writing:  { label: '写作', icon: '✍️', color: '#5B6CFF', bg: 'rgba(91, 108, 255, 0.15)', gradient: 'linear-gradient(135deg, #5B6CFF 0%, #8B7FFF 100%)' },
  code:     { label: '编程', icon: '💻', color: '#43E97B', bg: 'rgba(67, 233, 123, 0.15)', gradient: 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)' },
  learning: { label: '学习', icon: '🎓', color: '#F7971E', bg: 'rgba(247, 151, 30, 0.15)', gradient: 'linear-gradient(135deg, #F7971E 0%, #FFD200 100%)' },
  design:   { label: '设计', icon: '🎨', color: '#FF6B9D', bg: 'rgba(255, 107, 157, 0.15)', gradient: 'linear-gradient(135deg, #FF6B9D 0%, #C471ED 100%)' },
  analysis: { label: '分析', icon: '📊', color: '#4776E6', bg: 'rgba(71, 118, 230, 0.15)', gradient: 'linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)' },
  wellness: { label: '健康', icon: '🧘', color: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.15)', gradient: 'linear-gradient(135deg, #4ECDC4 0%, #44B09E 100%)' },
}

export const FALLBACK_META: CategoryMeta = {
  label: '',
  icon: FALLBACK_CATEGORY_ICON,
  color: '#5B6CFF',
  bg: '#EEF0FF',
  gradient: FALLBACK_GRADIENT,
}

export const DEFAULT_GRADIENT = FALLBACK_GRADIENT
