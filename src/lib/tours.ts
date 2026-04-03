import type { TourStep } from "@/components/AppTour";

interface PageTour {
  key: string;
  steps: TourStep[];
}

export const PAGE_TOURS: Record<string, PageTour> = {

  "/workflows": {
    key: "workflows",
    steps: [
      {
        target: null,
        title: "Welcome to Scenarios",
        content: "Scenarios are automated workflows that connect apps and services. This tour will walk you through the key features.",
        placement: "center",
      },
      {
        target: "header button",
        title: "Create a Scenario",
        content: "Click 'New Scenario' to open the workflow builder. You can start from scratch or pick a template.",
        placement: "bottom",
      },
      {
        target: "nav button[class*='active'], aside nav button",
        title: "Navigate between sections",
        content: "Use the left sidebar to switch between Scenarios, Data Stores, Agents, Credentials and more.",
        placement: "right",
      },
    ],
  },

  "/workflows/": {
    key: "workflow-editor",
    steps: [
      {
        target: null,
        title: "Workflow Builder",
        content: "This is the drag-and-drop canvas. Add nodes from the left panel, connect them, and run your workflow.",
        placement: "center",
      },
      {
        target: "[data-tour='sidebar'], .react-flow__renderer ~ div, aside",
        title: "Node Library",
        content: "Drag any node onto the canvas — triggers, actions, AI nodes, logic, and more. Use the search to find quickly.",
        placement: "right",
      },
      {
        target: "button[title='Run once'], button:has(.lucide-play)",
        title: "Run Once",
        content: "Test your workflow immediately with 'Run Once'. Logs and outputs appear in the bottom panel.",
        placement: "bottom",
      },
      {
        target: "button:has(.lucide-save), button[title='Save']",
        title: "Save & Version",
        content: "Save your changes anytime. Use 'Snapshot' to save a named version you can roll back to.",
        placement: "bottom",
      },
      {
        target: "button:has(.lucide-sparkles)",
        title: "AI Builder",
        content: "Describe what you want in plain English and the AI will generate the workflow nodes for you.",
        placement: "bottom",
      },
    ],
  },

  "/documents": {
    key: "documents",
    steps: [
      {
        target: null,
        title: "E-Sign Documents",
        content: "Upload PDFs, add signature fields, and send to signers — or save as a template to reuse via API.",
        placement: "center",
      },
      {
        target: "button:has(.lucide-plus), header button",
        title: "Upload a PDF",
        content: "Click 'Upload PDF' to add a document. You can then place signature, initials, date and text fields on it.",
        placement: "bottom",
      },
      {
        target: "[class*='border-violet'], [class*='template']",
        title: "Templates",
        content: "Documents marked as Templates can be sent to any email via the API or from a Scenario — great for automating contracts.",
        placement: "bottom",
      },
    ],
  },

  "/web-analytics": {
    key: "web-analytics",
    steps: [
      {
        target: null,
        title: "Web Analytics",
        content: "Track visitors, page views, events and conversions across your websites — no cookies required.",
        placement: "center",
      },
      {
        target: "button:has(.lucide-plus), header button",
        title: "Add a Site",
        content: "Add your website and copy the tracking snippet into your site's <head>. That's all the setup needed.",
        placement: "bottom",
      },
      {
        target: "[class*='tab'], nav[aria-label], [role='tablist']",
        title: "Overview, Sessions, Events & Funnels",
        content: "Switch between tabs to explore page-level stats, individual sessions, custom events, and funnel conversion rates.",
        placement: "bottom",
      },
    ],
  },

  "/org": {
    key: "org",
    steps: [
      {
        target: null,
        title: "Organization Settings",
        content: "Manage your team, billing, email providers, AI integrations, and activity logs from here.",
        placement: "center",
      },
      {
        target: "aside button, aside nav",
        title: "Sidebar Navigation",
        content: "Use the left menu to jump between Dashboard, Users, Subscription, Email Accounts, and E-Sign AI settings.",
        placement: "right",
      },
      {
        target: "[class*='plan'], [class*='subscription']",
        title: "Plan & Usage",
        content: "Track your current usage against plan limits. Upgrade when you need more operations or seats.",
        placement: "top",
      },
    ],
  },

  "/agents": {
    key: "agents",
    steps: [
      {
        target: null,
        title: "AI Agents",
        content: "Build conversational AI assistants that can be embedded on any website or triggered from a workflow.",
        placement: "center",
      },
      {
        target: "header button:has(.lucide-plus)",
        title: "Create an Agent",
        content: "Click 'New Agent' to configure a system prompt, pick a model, and connect tools the agent can use.",
        placement: "bottom",
      },
      {
        target: "button:has(.lucide-code), a[href*='embed']",
        title: "Embed Anywhere",
        content: "Each agent gets a public embed URL — drop the chat widget on any site in one line of code.",
        placement: "bottom",
      },
    ],
  },

  "/webhooks": {
    key: "webhooks",
    steps: [
      {
        target: null,
        title: "Webhooks",
        content: "Webhooks let external services trigger your scenarios in real time — Stripe, GitHub, Slack, and 30+ more.",
        placement: "center",
      },
      {
        target: "code, [class*='mono'], [class*='url']",
        title: "Your Webhook URL",
        content: "Copy this URL into the external service's webhook settings. Every incoming request fires your scenario.",
        placement: "top",
      },
    ],
  },

  "/connections": {
    key: "connections",
    steps: [
      {
        target: null,
        title: "Credentials",
        content: "Store OAuth connections and API credentials here. They're available to all your scenarios securely.",
        placement: "center",
      },
      {
        target: "header button:has(.lucide-plus)",
        title: "Add a Connection",
        content: "Connect Google, Airtable, Salesforce and many more. Credentials are encrypted and never exposed in logs.",
        placement: "bottom",
      },
    ],
  },
};
