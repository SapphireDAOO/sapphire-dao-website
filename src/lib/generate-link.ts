// Import the Invoice type from the model and the CryptoJS library for encryption
import CryptoJS from "crypto-js";

/**
 * Function to generate a secure, encrypted link based on the provided payment data.
 * @param {Invoice | undefined} payment - The payment data object of type Invoice (or undefined).
 * @returns {string | undefined | null} - The secure, encrypted string or null/undefined if conditions aren't met.
 */
const generateSecureLink = (orderId: bigint | undefined) => {
  // Retrieve the secret key from environment variables
  const secretKey = process.env.NEXT_PUBLIC_SECRET_KEY;

  // If the secret key is missing, return early
  if (!secretKey) {
    return;
  }

  // Validate the payment object and its essential properties
  if (!orderId) {
    return; // Return undefined if the payment data is incomplete or invalid
  }

  if (orderId) {
    try {
      // Encrypt the relevant payment data using AES encryption
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify({
          orderId: orderId, // Include the invoice KEY in the encrypted data
        }),
        secretKey // Use the secret key for encryption
      ).toString();

      // Encode the encrypted data to make it safe for use in URLs
      const encodedEncryptedData = encodeURIComponent(encrypted);

      // Return the encoded and encrypted string
      return encodedEncryptedData;
    } catch (error) {
      // Log any errors that occur during the encryption process
      console.log("Error generating secure link:", error);
      return null; // Return null if an error occurs
    }
  }
};

// Export the generateSecureLink function as the default export
export default generateSecureLink;
