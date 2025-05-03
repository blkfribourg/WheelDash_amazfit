function formatNumber(value, decimals = 2, locale = "en-US") {
  if (value === null || value === undefined) {
    return "--";
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
