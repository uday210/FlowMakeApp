import type { NodeHandler } from "./types";

export const handlers: Record<string, NodeHandler> = {
  "action_shopify": async ({ config, interpolate }) => {
    const domain = config.store_domain as string;
    const token = config.access_token as string;
    const action = (config.action as string) || "get_order";
    if (!domain || !token) throw new Error("Shopify store domain and access token are required");
    const hdrs = { "X-Shopify-Access-Token": token, "Content-Type": "application/json" };
    const base = `https://${domain}/admin/api/2024-01`;
    if (action === "get_order") {
      const res = await fetch(`${base}/orders/${config.record_id}.json`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors || `Shopify ${res.status}`);
      return data.order;
    } else if (action === "list_orders") {
      const res = await fetch(`${base}/orders.json?limit=${config.limit || 50}&status=${config.status || "any"}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors || `Shopify ${res.status}`);
      return data.orders;
    } else if (action === "get_product") {
      const res = await fetch(`${base}/products/${config.record_id}.json`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors || `Shopify ${res.status}`);
      return data.product;
    } else if (action === "list_products") {
      const res = await fetch(`${base}/products.json?limit=${config.limit || 50}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors || `Shopify ${res.status}`);
      return data.products;
    } else if (action === "create_customer") {
      let custData: Record<string, unknown> = {};
      try { custData = JSON.parse(interpolate(config.customer_data as string || "{}")); } catch { /* ignore */ }
      const res = await fetch(`${base}/customers.json`, { method: "POST", headers: hdrs, body: JSON.stringify({ customer: custData }) });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.errors) || `Shopify ${res.status}`);
      return data.customer;
    } else if (action === "get_customer") {
      const res = await fetch(`${base}/customers/${config.record_id}.json`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors || `Shopify ${res.status}`);
      return data.customer;
    }
    return undefined;
  },

  "action_woocommerce": async ({ config }) => {
    const siteUrl = (config.site_url as string || "").replace(/\/$/, "");
    const ck = config.consumer_key as string;
    const cs = config.consumer_secret as string;
    const action = (config.action as string) || "list_orders";
    if (!siteUrl || !ck || !cs) throw new Error("WooCommerce site URL, consumer key, and secret are required");
    const auth = Buffer.from(`${ck}:${cs}`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
    const base = `${siteUrl}/wp-json/wc/v3`;
    if (action === "get_order") {
      const res = await fetch(`${base}/orders/${config.record_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WooCommerce ${res.status}`);
      return data;
    } else if (action === "list_orders") {
      const res = await fetch(`${base}/orders?per_page=20`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WooCommerce ${res.status}`);
      return data;
    } else if (action === "update_order") {
      const body: Record<string, unknown> = {};
      if (config.status) body.status = config.status;
      const res = await fetch(`${base}/orders/${config.record_id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WooCommerce ${res.status}`);
      return data;
    } else if (action === "get_product") {
      const res = await fetch(`${base}/products/${config.record_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WooCommerce ${res.status}`);
      return data;
    } else if (action === "list_products") {
      const res = await fetch(`${base}/products?per_page=20`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `WooCommerce ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_paddle": async ({ config }) => {
    const apiKey = config.api_key as string;
    const action = (config.action as string) || "get_subscription";
    if (!apiKey) throw new Error("Paddle API key is required");
    const base = "https://api.paddle.com";
    const hdrs = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    if (action === "get_subscription") {
      const res = await fetch(`${base}/subscriptions/${config.subscription_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.detail || `Paddle ${res.status}`);
      return data.data;
    } else if (action === "cancel_subscription") {
      const res = await fetch(`${base}/subscriptions/${config.subscription_id}/cancel`, { method: "POST", headers: hdrs, body: JSON.stringify({ effective_from: "next_billing_period" }) });
      const data = await res.json();
      return data.data;
    } else if (action === "get_transaction") {
      const res = await fetch(`${base}/transactions/${config.transaction_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.detail || `Paddle ${res.status}`);
      return data.data;
    } else if (action === "list_customers") {
      const res = await fetch(`${base}/customers`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.detail || `Paddle ${res.status}`);
      return data.data;
    }
    return undefined;
  },

  "action_paypal": async ({ config }) => {
    const clientId = config.client_id as string;
    const secret = config.client_secret as string;
    const sandbox = config.sandbox !== "false";
    const action = (config.action as string) || "create_order";
    if (!clientId || !secret) throw new Error("PayPal client ID and secret are required");
    const base = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    // Get access token
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || "PayPal auth failed");
    const ppToken = tokenData.access_token;
    const hdrs = { Authorization: `Bearer ${ppToken}`, "Content-Type": "application/json" };
    if (action === "create_order") {
      const body = { intent: "CAPTURE", purchase_units: [{ amount: { currency_code: config.currency || "USD", value: String(config.amount || "0") } }] };
      const res = await fetch(`${base}/v2/checkout/orders`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `PayPal ${res.status}`);
      return data;
    } else if (action === "capture_order") {
      const res = await fetch(`${base}/v2/checkout/orders/${config.order_id}/capture`, { method: "POST", headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `PayPal ${res.status}`);
      return data;
    } else if (action === "get_order") {
      const res = await fetch(`${base}/v2/checkout/orders/${config.order_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `PayPal ${res.status}`);
      return data;
    }
    return undefined;
  },

  "action_square": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const sandbox = config.sandbox !== "false";
    const action = (config.action as string) || "create_customer";
    if (!token) throw new Error("Square access token is required");
    const base = sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Square-Version": "2024-01-18" };
    if (action === "create_customer") {
      const body: Record<string, unknown> = {};
      if (config.given_name) body.given_name = interpolate(config.given_name as string);
      if (config.family_name) body.family_name = interpolate(config.family_name as string);
      if (config.email_address) body.email_address = interpolate(config.email_address as string);
      const res = await fetch(`${base}/v2/customers`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.detail || `Square ${res.status}`);
      return data.customer;
    } else if (action === "get_customer") {
      const res = await fetch(`${base}/v2/customers/${config.customer_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.detail || `Square ${res.status}`);
      return data.customer;
    } else if (action === "list_payments") {
      const res = await fetch(`${base}/v2/payments`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.[0]?.detail || `Square ${res.status}`);
      return data.payments;
    }
    return undefined;
  },

  "action_braintree": async ({ config, interpolate }) => {
    const merchantId = config.merchant_id as string;
    const publicKey = config.public_key as string;
    const privateKey = config.private_key as string;
    const sandbox = config.sandbox !== "false";
    const action = (config.action as string) || "create_customer";
    if (!merchantId || !publicKey || !privateKey) throw new Error("Braintree merchant ID, public key, and private key are required");
    const base = sandbox ? "https://api.sandbox.braintreegateway.com" : "https://api.braintreegateway.com";
    const auth = Buffer.from(`${publicKey}:${privateKey}`).toString("base64");
    const hdrs = { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" };
    if (action === "create_customer") {
      const body = { customer: { firstName: config.first_name, lastName: config.last_name, email: interpolate(config.email as string || "") } };
      const res = await fetch(`${base}/merchants/${merchantId}/customers`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Braintree ${res.status}`);
      return data.customer;
    } else if (action === "create_transaction") {
      const body = { transaction: { amount: String(config.amount || "0"), paymentMethodNonce: config.payment_method_nonce, customerId: config.customer_id } };
      const res = await fetch(`${base}/merchants/${merchantId}/transactions`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Braintree ${res.status}`);
      return data.transaction;
    } else if (action === "find_customer") {
      const res = await fetch(`${base}/merchants/${merchantId}/customers/${config.customer_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Braintree ${res.status}`);
      return data.customer;
    }
    return undefined;
  },

  "action_quickbooks": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const realmId = config.realm_id as string;
    const action = (config.action as string) || "create_invoice";
    if (!token || !realmId) throw new Error("QuickBooks access token and realm ID are required");
    const hdrs = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };
    const base = `https://quickbooks.api.intuit.com/v3/company/${realmId}`;
    if (action === "create_invoice") {
      let inv: Record<string, unknown> = {};
      try { inv = JSON.parse(interpolate(config.invoice_data as string || "{}")); } catch { /* ignore */ }
      const res = await fetch(`${base}/invoice`, { method: "POST", headers: hdrs, body: JSON.stringify(inv) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.Fault?.Error?.[0]?.Message || `QuickBooks ${res.status}`);
      return data.Invoice;
    } else if (action === "create_customer") {
      let cust: Record<string, unknown> = {};
      try { cust = JSON.parse(interpolate(config.customer_data as string || "{}")); } catch { /* ignore */ }
      const res = await fetch(`${base}/customer`, { method: "POST", headers: hdrs, body: JSON.stringify(cust) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.Fault?.Error?.[0]?.Message || `QuickBooks ${res.status}`);
      return data.Customer;
    } else if (action === "get_invoice") {
      const res = await fetch(`${base}/invoice/${config.record_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(`QuickBooks ${res.status}`);
      return data.Invoice;
    }
    return undefined;
  },

  "action_xero": async ({ config, interpolate }) => {
    const token = config.access_token as string;
    const tenantId = config.tenant_id as string;
    const action = (config.action as string) || "create_invoice";
    if (!token || !tenantId) throw new Error("Xero access token and tenant ID are required");
    const hdrs = { Authorization: `Bearer ${token}`, "Xero-Tenant-Id": tenantId, "Content-Type": "application/json", Accept: "application/json" };
    if (action === "create_invoice") {
      let inv: Record<string, unknown> = {};
      try { inv = JSON.parse(interpolate(config.invoice_data as string || "{}")); } catch { /* ignore */ }
      const res = await fetch("https://api.xero.com/api.xro/2.0/Invoices", { method: "POST", headers: hdrs, body: JSON.stringify({ Invoices: [inv] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.Message || `Xero ${res.status}`);
      return data.Invoices?.[0];
    } else if (action === "create_contact") {
      const contact: Record<string, unknown> = { Name: interpolate(config.contact_name as string || "") };
      if (config.contact_email) contact.EmailAddress = interpolate(config.contact_email as string);
      const res = await fetch("https://api.xero.com/api.xro/2.0/Contacts", { method: "POST", headers: hdrs, body: JSON.stringify({ Contacts: [contact] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.Message || `Xero ${res.status}`);
      return data.Contacts?.[0];
    } else if (action === "get_invoice") {
      const res = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${config.invoice_id}`, { headers: hdrs });
      const data = await res.json();
      if (!res.ok) throw new Error(data.Message || `Xero ${res.status}`);
      return data.Invoices?.[0];
    }
    return undefined;
  },
};
