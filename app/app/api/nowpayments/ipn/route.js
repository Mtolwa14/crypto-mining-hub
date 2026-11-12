
import { createHmac, timingSafeEqual } from "crypto";

export async function POST(request) {
  try {
    const secret = process.env.NOWPAYMENTS_IPN_SECRET;

    if (!secret) {
      return Response.json(
        { error: "IPN secret is not configured" },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get(
      "x-nowpayments-sig"
    );

    if (!signature) {
      return Response.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);

    // NOWPayments requires the JSON keys to be sorted
    // recursively before calculating the HMAC.
    function sortObject(value) {
      if (Array.isArray(value)) {
        return value.map(sortObject);
      }

      if (value && typeof value === "object") {
        return Object.keys(value)
          .sort()
          .reduce((result, key) => {
            result[key] = sortObject(value[key]);
            return result;
          }, {});
      }

      return value;
    }

    const sortedPayload = JSON.stringify(
      sortObject(payload)
    );

    const expected = createHmac("sha512", secret)
      .update(sortedPayload)
      .digest("hex");

    const receivedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return Response.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    return Response.json({
      success: true,
      message: "NOWPayments IPN received",
      payment_status: payload.payment_status || null
    });
  } catch (error) {
    return Response.json(
      { error: "Invalid IPN request" },
      { status: 400 }
    );
  }
}
