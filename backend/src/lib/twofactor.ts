/**
 * 2Factor.in SMS Gateway Integration
 * DLT-Compliant Transactional SMS Dispatch
 * Documentation: https://2factor.in
 */

interface SendOtpResult {
  success: boolean;
  sessionId?: string;
  otp?: string;
  details?: string;
}

/**
 * Format mobile number for Indian DLT transactional routing (10-digit number)
 */
export function formatPhoneNumber(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Sends OTP exclusively as an SMS text message using 2Factor.in's Transactional SMS (TSMS) API.
 * 
 * Uses approved DLT template:
 * - Sender ID: MIRTHA
 * - Template Name: MIRTHA ("Your verification code for login is {#var#}. Regards, Mirtha Technology.")
 * - PE ID: 1001020445402520904
 * - CT ID: 1007633471770721325
 * 
 * NOTE: The TSMS endpoint is strictly a text message pipeline with zero voice call fallback.
 */
export async function send2FactorSmsOtp(mobile: string, otp: string): Promise<SendOtpResult> {
  const apiKey = process.env.TWOFACTOR_API_KEY;
  const senderId = process.env.TWOFACTOR_SENDER_ID?.trim() || 'MIRTHA';
  const templateName = process.env.TWOFACTOR_TEMPLATE_NAME?.trim() || 'MIRTHA';

  if (!apiKey) {
    console.warn('⚠️ [2FACTOR.IN] TWOFACTOR_API_KEY is not configured in .env. Skipping real SMS dispatch.');
    return {
      success: false,
      details: 'TWOFACTOR_API_KEY is missing from server configuration'
    };
  }

  const phone = formatPhoneNumber(mobile);

  try {
    const tsmsUrl = `https://2factor.in/API/V1/${apiKey}/ADDON_SERVICES/SEND/TSMS`;

    console.log(`📡 [2FACTOR.IN TSMS] Dispatching SMS text message to ${phone}...`);
    console.log(`📋 [DLT TEMPLATE] Sender: "${senderId}" | Template: "${templateName}" | OTP: [${otp}]`);

    const messageContent = `Your verification code for login is ${otp}. Regards, Mirtha Technology.`;
    const payload = {
      From: senderId,
      To: phone,
      TemplateName: templateName,
      Msg: messageContent,
      VAR1: otp
    };

    const response = await fetch(tsmsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data: any = await response.json().catch(() => null);

    if (!data) {
      console.error(`❌ [2FACTOR.IN TSMS] Invalid response from gateway (HTTP ${response.status})`);
      return {
        success: false,
        details: `Gateway responded with HTTP status ${response.status}`
      };
    }

    if (data.Status === 'Success') {
      console.log(`✅ [2FACTOR.IN TSMS] Text SMS delivered to network for ${phone}. Session: ${data.Details}`);
      return {
        success: true,
        sessionId: data.Details,
        otp,
        details: 'OTP sent successfully as an SMS text message via 2Factor.in TSMS'
      };
    } else {
      console.warn(`⚠️ [2FACTOR.IN TSMS] Rejected (${data.Details}). Attempting template GET route fallback...`);

      // Fallback: Custom template GET endpoint
      const fallbackUrl = `https://2factor.in/API/V1/${apiKey}/SMS/+91${phone}/${encodeURIComponent(otp)}/${encodeURIComponent(templateName)}`;
      const fallbackRes = await fetch(fallbackUrl, { method: 'GET' });
      const fallbackData: any = await fallbackRes.json().catch(() => null);

      if (fallbackData?.Status === 'Success') {
        console.log(`✅ [2FACTOR.IN] SMS dispatched via template GET to ${phone}. Session: ${fallbackData.Details}`);
        return {
          success: true,
          sessionId: fallbackData.Details,
          otp,
          details: 'OTP sent successfully as an SMS text message via 2Factor.in'
        };
      }

      console.error(`❌ [2FACTOR.IN] Dispatch rejected:`, data.Details || fallbackData?.Details);
      return {
        success: false,
        details: data.Details || fallbackData?.Details || 'Failed to dispatch SMS through 2Factor.in'
      };
    }
  } catch (error: any) {
    console.error(`❌ [2FACTOR.IN] Network exception:`, error.message);
    return {
      success: false,
      details: error.message || 'Network error communicating with 2Factor.in'
    };
  }
}
