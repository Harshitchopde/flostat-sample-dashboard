import AWS from "aws-sdk";
import { AWS_REGION, IOT_ENDPOINT } from "../constants";

export  const createSignedUrl = (credentials) => {
    if(!credentials){
        console.log("No credentails",credentials);
        return;
    }
      const endpoint = `wss://${IOT_ENDPOINT}/mqtt`;
      const now = new Date();
      const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
      const datestamp = amzdate.substr(0, 8);
      const service = "iotdevicegateway";
      const algorithm = "AWS4-HMAC-SHA256";
      const method = "GET";
      const canonicalUri = "/mqtt";
      const canonicalQuerystring = `X-Amz-Algorithm=${algorithm}&X-Amz-Credential=${encodeURIComponent(
        credentials.accessKeyId +
          "/" +
          datestamp +
          "/" +
          AWS_REGION +
          "/" +
          service +
          "/aws4_request"
      )}&X-Amz-Date=${amzdate}&X-Amz-SignedHeaders=host`;

      const canonicalHeaders = `host:${IOT_ENDPOINT}\n`;
      const payloadHash = AWS.util.crypto.sha256("", "hex");
      const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\nhost\n${payloadHash}`;

      const stringToSign = `${algorithm}\n${amzdate}\n${datestamp}/${AWS_REGION}/${service}/aws4_request\n${AWS.util.crypto.sha256(
        canonicalRequest,
        "hex"
      )}`;

      const kDate = AWS.util.crypto.hmac(
        `AWS4${credentials.secretAccessKey}`,
        datestamp,
        "buffer"
      );
      const kRegion = AWS.util.crypto.hmac(kDate, AWS_REGION, "buffer");
      const kService = AWS.util.crypto.hmac(kRegion, service, "buffer");
      const kSigning = AWS.util.crypto.hmac(kService, "aws4_request", "buffer");
      const signature = AWS.util.crypto.hmac(kSigning, stringToSign, "hex");

      return `${endpoint}?${canonicalQuerystring}&X-Amz-Signature=${signature}&X-Amz-Security-Token=${encodeURIComponent(
        credentials.sessionToken
      )}`;
    };