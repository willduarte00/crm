export type PixKeyType = 'CPF' | 'CNPJ' | 'Email' | 'Telefone' | 'Aleatoria';

export interface AgencySettings {
  id: string;
  agencyName: string;
  contactEmail?: string | null;
  phone?: string | null;
  pixKey?: string | null;
  pixKeyType?: PixKeyType | string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccount?: string | null;
  updatedAt: string;
}

export interface UpdateAgencySettingsInput {
  agencyName?: string;
  contactEmail?: string;
  phone?: string;
  pixKey?: string;
  pixKeyType?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
}
