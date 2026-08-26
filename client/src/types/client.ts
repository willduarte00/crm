export type LeadSource =
  | 'Instagram'
  | 'Indicação'
  | 'Google Ads'
  | 'Prospecção Ativa'
  | 'LinkedIn'
  | 'Outro';

export type PipelineStage =
  | 'Novo Lead'
  | 'Contato/Qualificação'
  | 'Proposta Enviada'
  | 'Em Negociação'
  | 'Contrato Ativo'
  | 'Pausado/Churn';

export type Priority = 'alta' | 'media' | 'baixa';

export type DocumentType = 'CPF' | 'CNPJ';

export type ServiceType =
  | 'Tráfego Pago'
  | 'Social Media & Conteúdo'
  | 'Sites/Landing Pages'
  | 'Branding'
  | 'SEO'
  | 'Pacote Completo';

export interface InteractionLog {
  id: string;
  clientId: string;
  userId: string;
  type: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Client {
  id: string;
  name: string;
  tradeName?: string | null;
  documentType: DocumentType;
  documentNumber: string;
  email?: string | null;
  phone?: string | null;
  leadSource: LeadSource;
  stage: PipelineStage;
  priority: Priority;
  ownerId?: string | null;
  owner?: {
    id: string;
    name: string;
    email: string;
    active: boolean;
  } | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  interactionLogs?: InteractionLog[];
  _count?: {
    contracts: number;
    interactionLogs: number;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedClientsResponse {
  data: Client[];
  pagination: PaginationMeta;
}

export interface ClientFilters {
  search: string;
  stage: string;
  leadSource: string;
  serviceType: string;
  ownerId: string;
  priority: string;
  page: number;
  limit: number;
}
