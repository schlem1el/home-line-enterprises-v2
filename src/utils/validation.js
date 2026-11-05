export const PH_CONTACT_NUMBER_ERROR = 'Enter a valid Philippine phone number.';

export function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function hasAtMostTwoDecimalPlaces(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    && Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-6;
}

export function isValidPhilippineContactNumber(value) {
  const contact = String(value || '').trim().replace(/[\s()-]/g, '');
  if (!contact) return false;

  const provincialAreaCodes = '(?:32|33|34|35|36|38|42|43|44|45|46|47|48|49|52|53|54|55|56|62|63|64|65|68|72|74|75|77|78|82|83|84|85|86|87|88|89)';
  const mobile = /^(?:09\d{9}|\+639\d{9}|639\d{9})$/;
  const landline = new RegExp(`^(?:02\\d{8}|0${provincialAreaCodes}\\d{7}|(?:\\+?63)(?:2\\d{8}|${provincialAreaCodes}\\d{7}))$`);

  return mobile.test(contact) || landline.test(contact);
}
