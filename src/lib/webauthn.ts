/** Minimal WebAuthn helpers for "Se connecter avec l'empreinte digitale". */

function bufToB64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function biometricSupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export async function platformAuthenticatorAvailable() {
  if (!biometricSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerBiometric(userId: string, name: string) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Imo MSN", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: name || "Imo MSN",
        displayName: name || "Imo MSN",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Enregistrement biométrique annulé");
  return { id: cred.id, rawId: bufToB64(cred.rawId) };
}

export async function verifyBiometric(credentialId: string) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const raw = Uint8Array.from(atob(credentialId), (c) => c.charCodeAt(0));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: raw, type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!assertion;
}