"use server";
import { SePayPgClient } from 'sepay-pg-node';

export async function generateSepayCheckout(data: {
  amount: number;
  description: string;
}) {
  const client = new SePayPgClient({
    env: 'sandbox',
    merchant_id: process.env.SEPAY_MERCHANT_ID || 'MERCHANT_ID',
    secret_key: process.env.SECRET_KEY || 'SECRET',
  });

  const checkoutURL = client.checkout.initCheckoutUrl();
  const invoiceCode = "DH" + Date.now();
  
  const checkoutFormfields = client.checkout.initOneTimePaymentFields({
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: invoiceCode,
    order_amount: data.amount,
    currency: 'VND',
    order_description: data.description,
    success_url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/tuition` : 'http://localhost:3000/admin/tuition',
    error_url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/tuition` : 'http://localhost:3000/admin/tuition',
    cancel_url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/tuition` : 'http://localhost:3000/admin/tuition',
  });

  return { checkoutURL, checkoutFormfields };
}
