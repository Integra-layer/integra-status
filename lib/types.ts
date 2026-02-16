// lib/types.ts — TypeScript types for Integra status page

export type CheckType =
  | "evm-rpc"
  | "cosmos-rpc"
  | "cosmos-rest"
  | "http-json"
  | "http-get"
  | "websocket"
  | "api-health"
  | "http-reachable"
  | "deep-health"
  | "graphql"
  | "cosmos-peer-check";

export type Status = "UP" | "DOWN" | "DEGRADED";
export type Category = "blockchain" | "validators" | "apis" | "frontends" | "external";
export type Environment = "prod" | "dev" | "staging" | "release";

export type Owner = {
  name: string;
  role: string;
  contact: string;
  telegram: string;
};

export type CommonIssue = {
  cause: string;
  fix: string;
};

export type Endpoint = {
  id: string;
  name: string;
  description: string;
  richDescription: string;
  category: Category;
  environment: Environment;
  checkType: CheckType;
  url: string;
  timeout: number;
  enabled: boolean;
  expectedChainId?: string;
  expectedField?: string;
  healthUrl?: string;
  peerIp?: string;
  publicRpc?: string;
  links: {
    endpoint: string;
    docs?: string;
    repo?: string;
  };
  commonIssues: CommonIssue[];
  dependsOn: string[];
  impacts: string[];
  impactDescription?: string;
  owner: Owner;
  tags: string[];
};

export type AppGroup = {
  id: string;
  name: string;
  icon: string;
  description: string;
  endpoints: string[];
};

export type CheckResult = {
  id: string;
  name: string;
  url: string;
  category: Category;
  environment: Environment;
  status: Status;
  responseTimeMs: number;
  timestamp: string;
  details: Record<string, unknown>;
  error: string | null;
  dependsOn: string[];
  impacts: string[];
  impactDescription: string | null;
  description: string | null;
  richDescription: string | null;
  owner: Owner | null;
  links: { endpoint: string; docs?: string; repo?: string };
  commonIssues: CommonIssue[];
  tags: string[];
};

export type HealthSummary = {
  timestamp: string;
  total: number;
  up: number;
  degraded: number;
  down: number;
  appGroups: AppGroup[];
  dependencyGraph: Record<string, { dependsOn: string[]; requiredBy: string[] }>;
  impactMap: Record<string, Array<{ id: string; name: string }>>;
  results: CheckResult[];
  history: {
    sparklines: Record<string, (number | null)[]>;
    uptimes: Record<string, number>;
    incidents: Array<{ id: string; fromStatus: string; toStatus: string; at: number }>;
    dataPoints: number;
    spanMinutes: number;
  };
};
