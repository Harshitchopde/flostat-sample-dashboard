import AWS from "aws-sdk";
import { AWS_REGION, IOT_ENDPOINT } from "../constants";

export const createSignedUrl = (credentials) => {
  if (!credentials) {
    console.error("❌ No credentials provided.");
    return null;
  }

  const endpoint = `wss://${IOT_ENDPOINT}/mqtt`;
  const now = new Date();
  const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzdate.substr(0, 8);
  const service = "iotdevicegateway";
  const algorithm = "AWS4-HMAC-SHA256";
  const method = "GET";
  const canonicalUri = "/mqtt";

  const credentialScope = `${datestamp}/${AWS_REGION}/${service}/aws4_request`;
  const credential = `${credentials.accessKeyId}/${credentialScope}`;

  // Step 1: Canonical Query String
  let canonicalQuerystring = `X-Amz-Algorithm=${algorithm}`;
  canonicalQuerystring += `&X-Amz-Credential=${encodeURIComponent(credential)}`;
  canonicalQuerystring += `&X-Amz-Date=${amzdate}`;
  canonicalQuerystring += `&X-Amz-SignedHeaders=host`;

  // Step 2: Canonical Headers
  const canonicalHeaders = `host:${IOT_ENDPOINT}\n`;
  const signedHeaders = "host";
  const payloadHash = AWS.util.crypto.sha256("", "hex");

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `${algorithm}\n${amzdate}\n${credentialScope}\n${AWS.util.crypto.sha256(
    canonicalRequest,
    "hex"
  )}`;

  const kDate = AWS.util.crypto.hmac(`AWS4${credentials.secretAccessKey}`, datestamp, "buffer");
  const kRegion = AWS.util.crypto.hmac(kDate, AWS_REGION, "buffer");
  const kService = AWS.util.crypto.hmac(kRegion, service, "buffer");
  const kSigning = AWS.util.crypto.hmac(kService, "aws4_request", "buffer");

  const signature = AWS.util.crypto.hmac(kSigning, stringToSign, "hex");

  // Final signed URL
  let signedUrl = `${endpoint}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;

  // ⛳️ Important: Append security token for temporary credentials
  if (credentials.sessionToken) {
    signedUrl += `&X-Amz-Security-Token=${encodeURIComponent(credentials.sessionToken)}`;
  }

  return signedUrl;
};
