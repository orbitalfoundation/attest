// Passkeys (WebAuthn) as the root identity. Thin wrapper over @simplewebauthn/server; nothing else sees WebAuthn shapes.
// RP id = this service's hostname, from the request origin. ES256 only, so every passkey is a P-256 key and gets a did:key.
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { jwkFromCose, b64u, unb64u } from "./identity.mjs";
export const RP_NAME = "attest";
export const rpOf = (origin) => { try { return new URL(origin).hostname; } catch { return "localhost"; } };
export async function registrationOptions({ origin, handle }) {
  return generateRegistrationOptions({ rpName: RP_NAME, rpID: rpOf(origin), userID: new TextEncoder().encode(handle), userName: handle, attestationType: "none",
    supportedAlgorithmIDs: [-7], authenticatorSelection: { residentKey: "required", userVerification: "preferred" } });
}
export async function verifyRegistration({ origin, response, challenge }) {
  const r = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpOf(origin), requireUserVerification: false });
  if (!r.verified) throw new Error("passkey registration did not verify");
  const c = r.registrationInfo.credential;
  return { id: c.id, publicKey: b64u(c.publicKey), jwk: jwkFromCose(c.publicKey), counter: c.counter || 0, transports: c.transports || [] };
}
export const authenticationOptions = ({ origin, challenge }) => generateAuthenticationOptions({ rpID: rpOf(origin), userVerification: "preferred", allowCredentials: [], challenge: unb64u(challenge) });
export async function verifyAssertion({ origin, response, challenge, credential }) {
  const r = await verifyAuthenticationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpOf(origin), requireUserVerification: false,
    credential: { id: credential.id, publicKey: unb64u(credential.public_key), counter: credential.counter || 0, transports: credential.transports || [] } });
  if (!r.verified) throw new Error("assertion did not verify");
  return { counter: r.authenticationInfo.newCounter };
}
