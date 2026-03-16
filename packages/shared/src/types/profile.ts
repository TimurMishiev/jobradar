// Must match the Prisma enum values exactly — Prisma returns uppercase strings.
export type RemotePreference = 'REMOTE_ONLY' | 'HYBRID' | 'ONSITE' | 'ANY';

export interface UserProfile {
  id: string;
  userId: string;
  targetTitles: string[];
  targetSkills: string[];
  preferredCompanies: string[];
  targetLocations: string[];
  remotePreference: RemotePreference;
  seniorityPref: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  label: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  isDefault: boolean;
  // textContent omitted from client shape — only used server-side for scoring
  createdAt: string;
  updatedAt: string;
}
