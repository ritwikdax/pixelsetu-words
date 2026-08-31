import type { PageOrientation } from './utils/pageOrientation'

export interface DocumentPage {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  orientation?: PageOrientation
  locked?: boolean
}

export type { PageOrientation } from './utils/pageOrientation'
