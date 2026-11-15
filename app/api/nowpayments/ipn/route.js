
import { createHmac, timingSafeEqual } from "crypto";

export async function POST(request) {
  try {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!ipnSecret || !apiKey || !supabaseUrl || !serviceKey) {
      return Response.json(
        { error: "Server configuration missing" },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-nowpayments-sig");

    if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) {
      return Response.json(
        { error: "Invalid signature header" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);

    function sortObject(value) {
      if (Array.isArray(value)) return value.map(sortObject);

      if (value && typeof value === "object") {
        return Object.keys(value).sort().reduce((result, key) => {
          result[key] = sortObject(value[key]);
          return result;
        }, {});
      }

      return value;
    }

    const sortedPayload = JSON.stringify(sortObject(payload));

    const expectedSignature = createHmac("sha512", ipnSecret)
      .update(sortedPayload)
      .digest();

    const receivedSignature = Buffer.from(signature, "hex");

    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return Response.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const paymentId = String(payload.payment_id || "");

    if (!paymentId) {
      return Response.json(
        { error: "Missing payment ID" },
        { status: 400 }
      );
    }

    if (payload.payment_status !== "finished") {
      return Response.json({
        success: true,
        message: "Payment not finished"
      });
    }

    const transactionResponse = await fetch(
      `${supabaseUrl}/rest/v1/transactions?provider_payment_id=eq.${encodeURIComponent(paymentId)}&select=id,user_id,type,currency,network,status,provider_payment_id,order_id,pay_currency,price_amount,expected_pay_amount`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        },
        cache: "no-store"
      }
    );

    if (!transactionResponse.ok) {
      return Response.json(
        { error: "Could not check deposit record" },
        { status: 500 }
      );
    }

    const transactions = await transactionResponse.json();

    if (transactions.length !== 1) {
      return Response.json(
        { error: "Matching deposit not found" },
        { status: 404 }
      );
    }

    const transaction = transactions[0];

    if (transaction.status === "approved") {
      return Response.json({
        success: true,
        message: "already_credited"
      });
    }

    if (
      transaction.type !== "deposit" ||
      transaction.currency !== "USDT" ||
      transaction.network !== "BEP20" ||
      transaction.status !== "pending" ||
      !transaction.order_id ||
      !transaction.pay_currency ||
      transaction.expected_pay_amount === null ||
      transaction.expected_pay_amount === undefined
    ) {
      return Response.json(
        { error: "Deposit record is not eligible" },
        { status: 409 }
      );
    }

    const paymentResponse = await fetch(
      `https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`,
      {
        headers: { "x-api-key": apiKey },
        cache: "no-store"
      }
    );

    if (!paymentResponse.ok) {
      return Response.json(
        { error: "Could not verify payment" },
        { status: 503 }
      );
    }

    const verified = await paymentResponse.json();

    const paidAmount = Number(verified.actually_paid);
    const expectedPayAmount = Number(transaction.expected_pay_amount);
    const providerPayAmount = Number(verified.pay_amount);
    const expectedPrice = Number(transaction.price_amount);
    const verifiedPrice = Number(verified.price_amount);

    if (
      String(verified.payment_id) !== paymentId ||
      verified.payment_status !== "finished" ||
      String(verified.order_id) !== transaction.order_id ||
      String(payload.order_id) !== transaction.order_id ||
      String(verified.price_currency).toLowerCase() !== "usd" ||
      !Number.isFinite(expectedPrice) ||
      !Number.isFinite(verifiedPrice) ||
      Math.abs(verifiedPrice - expectedPrice) > 0.000001 ||
      !Number.isFinite(expectedPayAmount) ||
      expectedPayAmount <= 0 ||
      !Number.isFinite(providerPayAmount) ||
      Math.abs(providerPayAmount - expectedPayAmount) > 0.00000001 ||
      String(verified.pay_currency).toLowerCase() !==
        String(transaction.pay_currency).toLowerCase() ||
      !Number.isFinite(paidAmount) ||
      paidAmount < expectedPayAmount ||
      Math.abs(paidAmount - Number(payload.actually_paid)) > 0.00000001
    ) {
      return Response.json(
        { error: "Payment details or amount do not match" },
        { status: 409 }
      );
    }

    const creditResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/credit_nowpayments_usdt`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_provider_payment_id: paymentId,
          p_actually_paid: paidAmount
        }),
        cache: "no-store"
      }
    );

    if (!creditResponse.ok) {
      return Response.json(
        { error: "Wallet credit failed" },
        { status: 500 }
      );
    }

    const result = await creditResponse.json();

    return Response.json({
      success: true,
      message: result
    });

  } catch (error) {
    return Response.json(
      { error: "IPN processing failed" },
      { status: 400 }
    );
  }
}
