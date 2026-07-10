import {
  PASSWORD_MIN_LENGTH,
  isPasswordStrongEnough,
  getPasswordRequirementsText,
  getPasswordRequirementsShortText,
} from "../utils/passwordValidation";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(PASSWORD_MIN_LENGTH === 8, "minimum password length contract must stay 8");

// Rejections
assert(!isPasswordStrongEnough(""), "empty password must be rejected");
assert(!isPasswordStrongEnough("Ab1"), "password shorter than the minimum length must be rejected");
assert(!isPasswordStrongEnough("Abcdefg1".slice(0, 7)), "7-char password must be rejected (one under the minimum)");
assert(!isPasswordStrongEnough("alllowercase1"), "password without an uppercase letter must be rejected");
assert(!isPasswordStrongEnough("NoDigitsHereAtAll"), "password without a digit must be rejected");
assert(!isPasswordStrongEnough("        "), "whitespace-only password must be rejected");

// Acceptances
assert(isPasswordStrongEnough("Abcdefg1"), "exactly 8 chars with 1 uppercase + 1 digit must be accepted (boundary)");
assert(isPasswordStrongEnough("ValidPass1"), "typical valid password must be accepted");
assert(isPasswordStrongEnough("PASSWORD1"), "all-uppercase password with a digit must be accepted (no lowercase rule)");
assert(isPasswordStrongEnough("Sup3rLongPasswordWithManyChars"), "long password satisfying the rules must be accepted");

// Copy contracts: must mention the same requirements they enforce, so UI and validator can't drift apart
const longText = getPasswordRequirementsText();
const shortText = getPasswordRequirementsShortText();
assert(longText.includes("8"), "long requirements text must mention the minimum length");
assert(/maiuscol/i.test(longText), "long requirements text must mention the uppercase requirement");
assert(/numero/i.test(longText), "long requirements text must mention the digit requirement");
assert(shortText.includes("8"), "short requirements text must mention the minimum length");
assert(/maiuscol/i.test(shortText), "short requirements text must mention the uppercase requirement");
assert(/numero/i.test(shortText), "short requirements text must mention the digit requirement");

console.log("PASS password validation contract enforces length, uppercase and digit rules");
