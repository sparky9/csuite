/**
 * Example usage of @ocsuite/crypto package
 *
 * This demonstrates how to use the crypto package for tenant-specific encryption.
 * Run with: node example.js
 */

import {
  initializeCrypto,
  generateMasterKey,
  encryptForTenant,
  decryptForTenant,
  isAuthenticationError
} from './dist/index.js';

console.log('🔐 @ocsuite/crypto Example Usage\n');

// Step 1: Generate a master key (do this ONCE during initial setup)
console.log('Step 1: Generate master key');
const masterKey = generateMasterKey();
console.log(`Master key generated: ${masterKey.substring(0, 16)}... (truncated)`);
console.log('⚠️  In production, store this in a secrets manager!\n');

// Step 2: Initialize the crypto package
console.log('Step 2: Initialize crypto package');
initializeCrypto(masterKey);
console.log('✓ Crypto package initialized\n');

// Step 3: Encrypt data for different tenants
console.log('Step 3: Encrypt data for multiple tenants');

const tenant1Data = 'sk-proj-tenant1-secret-api-token';
const tenant2Data = 'sk-proj-tenant2-secret-api-token';

const tenant1Encrypted = encryptForTenant(tenant1Data, 'tenant-1', 'connector-tokens');
const tenant2Encrypted = encryptForTenant(tenant2Data, 'tenant-2', 'connector-tokens');

console.log('Tenant 1 encrypted:', tenant1Encrypted.substring(0, 40) + '...');
console.log('Tenant 2 encrypted:', tenant2Encrypted.substring(0, 40) + '...');
console.log('');

// Step 4: Decrypt data for each tenant
console.log('Step 4: Decrypt data for each tenant');

const tenant1Decrypted = decryptForTenant(tenant1Encrypted, 'tenant-1', 'connector-tokens');
const tenant2Decrypted = decryptForTenant(tenant2Encrypted, 'tenant-2', 'connector-tokens');

console.log('✓ Tenant 1 decrypted:', tenant1Decrypted);
console.log('✓ Tenant 2 decrypted:', tenant2Decrypted);
console.log('');

// Step 5: Demonstrate tenant isolation
console.log('Step 5: Demonstrate tenant isolation');
console.log('Attempting to decrypt tenant 1 data with tenant 2 key...');

try {
  // This should fail!
  decryptForTenant(tenant1Encrypted, 'tenant-2', 'connector-tokens');
  console.log('❌ ERROR: Should have failed!');
} catch (error) {
  if (isAuthenticationError(error)) {
    console.log('✓ Authentication error (as expected) - tenant isolation working!');
  } else {
    console.log('❌ Unexpected error:', error.message);
  }
}
console.log('');

// Step 6: Demonstrate context isolation
console.log('Step 6: Demonstrate context isolation');
const tokenData = 'api-token-12345';
const encryptedAsToken = encryptForTenant(tokenData, 'tenant-1', 'tokens');
const encryptedAsData = encryptForTenant(tokenData, 'tenant-1', 'data');

console.log('Same data, different contexts produce different ciphertexts:');
console.log('  Token context:', encryptedAsToken.substring(0, 40) + '...');
console.log('  Data context: ', encryptedAsData.substring(0, 40) + '...');
console.log('');

console.log('Attempting to decrypt token-encrypted data with data context...');
try {
  decryptForTenant(encryptedAsToken, 'tenant-1', 'data');
  console.log('❌ ERROR: Should have failed!');
} catch (error) {
  if (isAuthenticationError(error)) {
    console.log('✓ Authentication error (as expected) - context isolation working!');
  }
}
console.log('');

// Step 7: Real-world example
console.log('Step 7: Real-world example - OAuth credentials');

const oauthCreds = JSON.stringify({
  access_token: 'ya29.a0AfH6SMBx...',
  refresh_token: '1//0gL3KZ9YgT...',
  expires_at: Date.now() + 3600000
});

const encryptedOAuth = encryptForTenant(oauthCreds, 'tenant-acme', 'oauth-credentials');
console.log('Encrypted OAuth credentials:', encryptedOAuth.substring(0, 40) + '...');

const decryptedOAuth = decryptForTenant(encryptedOAuth, 'tenant-acme', 'oauth-credentials');
const parsed = JSON.parse(decryptedOAuth);
console.log('Decrypted OAuth credentials:');
console.log('  Access token:', parsed.access_token);
console.log('  Refresh token:', parsed.refresh_token);
console.log('');

console.log('✅ All examples completed successfully!');
console.log('\n📚 See README.md for more information and security best practices.');
