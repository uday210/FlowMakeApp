import type { NodeHandler } from "./types";
import { handlers as aiHandlers } from "./ai";
import { handlers as messagingHandlers } from "./messaging";
import { handlers as emailHandlers } from "./email";
import { handlers as databaseHandlers } from "./database";
import { handlers as queuingHandlers } from "./queuing";
import { handlers as storageHandlers } from "./storage";
import { handlers as crmHandlers } from "./crm";
import { handlers as ecommerceHandlers } from "./ecommerce";
import { handlers as analyticsHandlers } from "./analytics";
import { handlers as socialHandlers } from "./social";
import { handlers as devopsHandlers } from "./devops";
import { handlers as documentsHandlers } from "./documents";
import { handlers as miscHandlers } from "./misc";
import { handlers as flowControlHandlers } from "./flow-control";
import { handlers as pollingHandlers } from "./polling";

export const HANDLERS: Record<string, NodeHandler> = {
  ...aiHandlers,
  ...messagingHandlers,
  ...emailHandlers,
  ...databaseHandlers,
  ...queuingHandlers,
  ...storageHandlers,
  ...crmHandlers,
  ...ecommerceHandlers,
  ...analyticsHandlers,
  ...socialHandlers,
  ...devopsHandlers,
  ...documentsHandlers,
  ...miscHandlers,
  ...flowControlHandlers,
  ...pollingHandlers,
};

export type { NodeHandler };
export type { HandlerCtx } from "./types";
