export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'senior_editor'
  | 'junior_editor'
  | 'uploader'

export interface Admin {
  id: string
  created_at: string
  name: string | null
  email: string
  role: AdminRole | null
  approved: boolean | null
  clerk_id: string
}

export interface PDF {
  id: number
  title: string
  author: string | null
  category: string | null
  tags: string[]
  summary: string | null
  cover_image_url: string | null
  page_count: number | null
  rating: number | null
  published_at: string | null
  smart_link: string | null
  download_url: string | null
  is_featured: boolean
  download_count: number
  created_at: string
  updated_at: string
  search_document: string | null
  public_id: string
}

export interface DownloadEvent {
  id: number
  pdf_id: number
  click_stage: 'smart' | 'direct'
  referer: string | null
  user_agent: string | null
  ip_address: string | null
  created_at: string
}

export interface ContactMessage {
  id: number
  name: string
  email: string
  message: string
  created_at: string
  status: boolean
}

export interface PDFRequest {
  id: number
  name: string
  email: string
  details: string
  created_at: string
  user_id: string
  status: 'reviewing' | 'approved' | 'rejected'
}

export interface WorkerSession {
  id: string
  worker_id: string
  worker_name: string
  worker_email: string
  login_time: string
  logout_time: string | null
  session_duration: number | null
  is_active: boolean
}

export interface WorkerActivity {
  id: string
  worker_id: string
  date: string
  active_hours: number
  upload_count: number
  edit_count: number
  delete_count: number
}

export interface ChangeLog {
  id: string
  worker_id: string
  worker_name: string
  action: 'upload' | 'edit' | 'delete' | 'approve' | 'reject'
  resource_type: 'pdf' | 'post' | 'tag' | 'user'
  resource_id: string
  resource_title: string
  timestamp: string
  details?: string
}

export interface ChatMessage {
  id: string
  channel: string
  sender_id: string
  sender_name: string
  sender_role: AdminRole
  content: string
  mentions: string[]
  parent_id: string | null
  read_by: string[]
  timestamp: string
  edited?: boolean
}

export interface WorkerPresence {
  worker_id: string
  is_online: boolean
  last_seen: string
  current_page?: string
}

export interface Permission {
  canUploadBooks: boolean
  canEditBooks: boolean
  canDeleteBooks: boolean
  canManagePosts: boolean
  canManageTags: boolean
  canApproveUsers: boolean
  canViewAnalytics: boolean
  canViewRevenue: boolean
  canManageWorkers: boolean
}

export const ROLE_PERMISSIONS: Record<AdminRole, Permission> = {
  super_admin: {
    canUploadBooks: true,
    canEditBooks: true,
    canDeleteBooks: true,
    canManagePosts: true,
    canManageTags: true,
    canApproveUsers: true,
    canViewAnalytics: true,
    canViewRevenue: true,
    canManageWorkers: true,
  },
  admin: {
    canUploadBooks: true,
    canEditBooks: true,
    canDeleteBooks: true,
    canManagePosts: true,
    canManageTags: true,
    canApproveUsers: true,
    canViewAnalytics: true,
    canViewRevenue: true,
    canManageWorkers: false,
  },
  senior_editor: {
    canUploadBooks: true,
    canEditBooks: true,
    canDeleteBooks: false,
    canManagePosts: true,
    canManageTags: true,
    canApproveUsers: false,
    canViewAnalytics: true,
    canViewRevenue: false,
    canManageWorkers: false,
  },
  junior_editor: {
    canUploadBooks: true,
    canEditBooks: true,
    canDeleteBooks: false,
    canManagePosts: false,
    canManageTags: false,
    canApproveUsers: false,
    canViewAnalytics: false,
    canViewRevenue: false,
    canManageWorkers: false,
  },
  uploader: {
    canUploadBooks: true,
    canEditBooks: false,
    canDeleteBooks: false,
    canManagePosts: false,
    canManageTags: false,
    canApproveUsers: false,
    canViewAnalytics: false,
    canViewRevenue: false,
    canManageWorkers: false,
  },
}

export interface RevenueConfig {
  base_pay: number
  click_pay: number
  pv_rate: number
  cap_pv: number
  min_pv_threshold: number
  min_click_threshold: number
}

export interface BookRevenue {
  pdf_id: number
  pdf_title: string
  worker_id: string
  worker_name: string
  dl2_count: number
  page_views: number
  quality_score: number
  retention_score: number
  fraud_factor: number
  gross_pay: number
  net_pay: number
}

export interface ActivityHeatmapCell {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}
