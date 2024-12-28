interface MoneyFormat {
  currency: string;
  currencySymbol: string;
  currencyPosition: 'prefix' | 'suffix';
  decimalSeparator: string;
  thousandSeparator: string;
  numberOfDecimals: number;
}

export function parseMoneyFormat(moneyFormat: string, currencyCode: string): MoneyFormat {
  // Example formats:
  // "{{amount}}TL" -> amount first, then currency
  // "${{amount}}" -> currency first, then amount
  // "{{amount_with_comma_separator}}TL" -> with comma separator

  const hasComma = moneyFormat.includes("with_comma_separator");
  const template = moneyFormat.replace("_with_comma_separator", "");

  // Find currency symbol by removing {{amount}}
  const symbol = template.replace("{{amount}}", "");
  const isPrefix = template.startsWith(symbol);

  return {
    currency: currencyCode,
    currencySymbol: symbol,
    currencyPosition: isPrefix ? 'prefix' : 'suffix',
    decimalSeparator: hasComma ? "," : ".",
    thousandSeparator: hasComma ? "." : ",",
    numberOfDecimals: 2,
  };
}

export function formatMoney(
  amount: number,
  moneyFormat: MoneyFormat
): string {
  const {
    currencySymbol,
    currencyPosition,
    decimalSeparator,
    thousandSeparator,
    numberOfDecimals
  } = moneyFormat;

  const formattedNumber = amount
    .toFixed(numberOfDecimals)
    .replace(".", decimalSeparator)
    .replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);

  return currencyPosition === 'prefix'
    ? `${currencySymbol}${formattedNumber}`
    : `${formattedNumber}${currencySymbol}`;
}
