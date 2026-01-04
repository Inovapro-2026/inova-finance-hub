// Biometric Authentication Service using Web Authentication API
// Supports fingerprint, Face ID, and device PIN/password

const CREDENTIAL_STORAGE_KEY = 'inovabank_biometric_credential';
const BIOMETRIC_ENABLED_KEY = 'inovabank_biometric_enabled';

interface StoredCredential {
  credentialId: string;
  matricula: number;
}

// Check if WebAuthn is supported
export function isBiometricSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
}

// Check if platform authenticator is available (fingerprint/face/pin)
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

// Check if biometric is enabled for current user
export function isBiometricEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
}

// Get stored credential
function getStoredCredential(): StoredCredential | null {
  const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Generate a random challenge
function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

// Convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Register biometric for a user
export async function registerBiometric(matricula: number, userName: string): Promise<boolean> {
  if (!await isPlatformAuthenticatorAvailable()) {
    console.error('Biometric not available on this device');
    return false;
  }

  try {
    const challenge = generateChallenge();
    const userId = new TextEncoder().encode(matricula.toString());
    
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: challenge as BufferSource,
      rp: {
        name: 'Inova Bank',
        id: window.location.hostname,
      },
      user: {
        id: userId as BufferSource,
        name: matricula.toString(),
        displayName: userName || `Usuário ${matricula}`,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Use device's built-in authenticator
        userVerification: 'required',        // Require biometric/PIN verification
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential;

    if (credential) {
      // Store credential ID for later authentication
      const storedCredential: StoredCredential = {
        credentialId: arrayBufferToBase64(credential.rawId),
        matricula,
      };
      
      localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(storedCredential));
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      
      console.log('Biometric registered successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error registering biometric:', error);
    return false;
  }
}

// Authenticate using biometric
export async function authenticateWithBiometric(): Promise<number | null> {
  const storedCredential = getStoredCredential();
  
  if (!storedCredential) {
    console.error('No biometric credential found');
    return null;
  }

  if (!await isPlatformAuthenticatorAvailable()) {
    console.error('Biometric not available');
    return null;
  }

  try {
    const challenge = generateChallenge();
    const credentialId = base64ToArrayBuffer(storedCredential.credentialId);
    
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challenge as BufferSource,
      allowCredentials: [
        {
          id: credentialId as BufferSource,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential;

    if (assertion) {
      console.log('Biometric authentication successful');
      return storedCredential.matricula;
    }
    
    return null;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    return null;
  }
}

// Disable biometric authentication
export function disableBiometric(): void {
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
}

// Get the stored matricula (for display purposes)
export function getBiometricMatricula(): number | null {
  const stored = getStoredCredential();
  return stored?.matricula || null;
}
