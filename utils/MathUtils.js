export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return "--";
  }

  return (fixed = Number(value).toFixed(decimals));
}
