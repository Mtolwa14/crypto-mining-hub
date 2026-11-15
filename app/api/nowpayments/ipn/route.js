
import { createHmac, timingSafeEqual } from "crypto";

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

async function getPaymentRecord(url, serviceKey, table, paymentId, select) {
  const response = await fetch(
    `${url}/rest/v1/${table}?provider_payment_id=eq.${encodeURIComponent(paymentId)}&select=${select}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Could not check ${table}`);
  }

  return response.json();
}

async function verifyPayment({
  apiKey,
  paymentId,
  payload,
  record,
}) {
  const response = await fetch(
    `https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`,
    {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Could not verify payment with NOWPayments");
  }

  const verified = await response.json();

  const paidAmount = Number(verified.actually_paid);
  const expectedAmount = Number(record.expected_pay_amount);
  const providerAmount = Number(verified.pay_amount);
  const expectedPrice = Number(record.price_amount ?? record.price_usdt);
  const verifiedPrice = Number(verified.price_amount);

  if (
    String(verified.payment_id) !== paymentId ||
    verified.payment_status !== "finished" ||
    String(verified.order_id) !== String(record.order_id) ||
    String(payload.order_id) !== String(record.order_id) ||
    String(verified.price_currency).toLowerCase() !== "usd" ||
    !Number.isFinite(expectedPrice) ||
    !Number.isFinite(verifiedPrice) ||
    Math.abs(verifiedPrice - expectedPrice) > 0.000001 ||
    !Number.isFinite(expectedAmount) ||
    expectedAmount <= 0 ||
    !Number.isFinite(providerAmount) ||
    Math.abs(providerAmount - expectedAmount) > 0.00000001 ||
    String(verified.pay_currency).toLowerCase() !==
      String(record.pay_currency).toLowerCase() ||
    !Number.isFinite(paidAmount) ||
    paidAmount < expectedAmount ||
    Math.abs(paidAmount - Number(payload.actually_paid)) > 0.00000001
  ) {
    throw new Error("Payment details or amount do not match");
  }

  return paidAmount;
}

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

    // Verify NOWPayments IPN signature
    const rawBody = await request.text();
    const signature = request.headers.get("x-nowpayments-sig");

    if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) {
      return Response.json(
        { error: "Invalid signature header" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);

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
        message: "Payment not finished",
      });
    }

    // First check whether this payment belongs to a deposit
    const transactions = await getPaymentRecord(
      supabaseUrl,
      serviceKey,
      "transactions",
      paymentId,
      "id,user_id,type,currency,network,status,provider_payment_id,order_id,pay_currency,price_amount,expected_pay_amount"
    );

    if (transactions.length > 1) {
      return Response.json(
        { error: "Duplicate payment records found" },
        { status: 409 }
      );
    }

    if (transactions.length === 1) {
      const transaction = transactions[0];

      if (transaction.status === "approved") {
        return Response.json({
          success: true,
          message: "already_credited",
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

      const paidAmount = await verifyPayment({
        apiKey,
        paymentId,
        payload,
        record: transaction,
      });

      // Preserve the existing deposit wallet-crediting process
      const creditResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/credit_nowpayments_usdt`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_provider_payment_id: paymentId,
            p_actually_paid: paidAmount,
          }),
          cache: "no-store",
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
        type: "deposit",
        message: result,
      });
    }

    // If it is not a deposit, check for a mining plan purchase
    const purchases = await getPaymentRecord(
      supabaseUrl,
      serviceKey,
      "mining_plan_purchases",
      paymentId,
      "id,user_id,plan_name,price_usdt,currency,network,status,provider_payment_id,order_id,pay_currency,expected_pay_amount"
    );

    if (purchases.length !== 1) {
      return Response.json(
        { error: "Matching payment record not found" },
        { status: 404 }
      );
    }

    const purchase = purchases[0];

    if (purchase.status === "active") {
      return Response.json({
        success: true,
        type: "plan_purchase",
        message: "plan_already_activated",
      });
    }

    const approvedPrices = {
      STARTER: 10,
      BASIC: 25,
      PRO: 50,
      PREMIUM: 100,
    };

    if (
      purchase.status !== "pending" ||
      purchase.currency !== "USDT" ||
      purchase.network !== "BEP20" ||
      approvedPrices[purchase.plan_name] !== Number(purchase.price_usdt) ||
      !purchase.order_id ||
      !purchase.pay_currency ||
      purchase.expected_pay_amount === null ||
      purchase.expected_pay_amount === undefined
    ) {
      return Response.json(
        { error: "Mining plan purchase is not eligible" },
        { status: 409 }
      );
    }

    await verifyPayment({
      apiKey,
      paymentId,
      payload,
      record: purchase,
    });

    // Activate only after NOWPayments confirms the payment
    const activateResponse = await fetch(
      `${supabaseUrl}/rest/v1/mining_plan_purchases?id=eq.${encodeURIComponent(purchase.id)}&status=eq.pending`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: "active",
          activated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    if (!activateResponse.ok) {
      return Response.json(
        { error: "Could not activate mining plan" },
        { status: 500 }
      );
    }

    const activated = await activateResponse.json();

    if (activated.length === 0) {
      // Check whether another IPN request already activated it
      const latest = await getPaymentRecord(
        supabaseUrl,
        serviceKey,
        "mining_plan_purchases",
        paymentId,
        "id,status,plan_name"
      );

      if (latest.length === 1 && latest[0].status === "active") {
        return Response.json({
          success: true,
          type: "plan_purchase",
          message: "plan_already_activated",
        });
      }

      return Response.json(
        { error: "Plan activation needs review" },
        { status: 409 }
      );
    }

    return Response.json({
      success: true,
      type: "plan_purchase",
      plan_name: purchase.plan_name,
      message: "Mining plan activated successfully",
    });

  } catch (error) {
    console.error("NOWPayments IPN error:", error);

    return Response.json(
      { error: "IPN processing failed" },
      { status: 500 }
    );
  }
}
