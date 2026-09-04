/**
 * Stripe, for the plan page. The customer portal handles card changes and
 * cancellation, so this code never has to; invoices are listed from Stripe
 * rather than mirrored.
 */

import type Stripe from 'stripe';

import { absoluteUrl, PRICING } from './site';
import { stripe } from './stripe';

export interface InvoiceLine {
  id: string;
  date: string;
  item: string;
  amount: string;
  pdf: string | null;
}

export async function portalUrl(customerId: string, returnPath = '/account/billing'): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: absoluteUrl(returnPath) });
  return session.url;
}

export async function listInvoices(customerId: string, limit = 12): Promise<InvoiceLine[]> {
  const { data } = await stripe().invoices.list({ customer: customerId, limit });
  return data.map(toLine);
}

function toLine(invoice: Stripe.Invoice): InvoiceLine {
  const first = invoice.lines.data[0];
  const description = first?.description ?? '';
  const item = /fix pack/i.test(description)
    ? `Fix pack${domainIn(description)}`
    : /monitor/i.test(description) || first?.plan
      ? 'Monitoring'
      : description || 'botready.dev';
  return {
    id: invoice.id,
    date: new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000).toISOString(),
    item,
    amount: money(invoice.amount_paid || invoice.amount_due, invoice.currency),
    pdf: invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null,
  };
}

function domainIn(description: string): string {
  const match = description.match(/for ([a-z0-9.-]+\.[a-z]{2,})/i);
  return match ? ` — ${match[1]}` : '';
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

/** The card on file, from the customer's default payment method. */
export async function cardOnFile(customerId: string): Promise<string | null> {
  const customer = await stripe().customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] });
  if (customer.deleted) return null;
  const pm = customer.invoice_settings?.default_payment_method;
  if (!pm || typeof pm === 'string' || !pm.card) return null;
  return `${cap(pm.card.brand)} ending ${pm.card.last4}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const MONITOR_PRICE = PRICING.monitor;
