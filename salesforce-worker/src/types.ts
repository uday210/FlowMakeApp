export interface WorkflowNode {
  id: string;
  data: {
    type: string;
    config: Record<string, unknown>;
  };
}

export interface SalesforceConnection {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  email?: string;
}

export interface ActiveSubscription {
  workflowId: string;
  orgId: string;
  channel: string;
  connectionId: string;
  instanceUrl: string;
  // jsforce subscription handle — cancel() to unsubscribe
  handle: { cancel: () => void };
}

export interface WorkflowRow {
  id: string;
  org_id: string;
  nodes: WorkflowNode[];
  enabled?: boolean;
}
