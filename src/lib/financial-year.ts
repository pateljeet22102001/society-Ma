export function indianFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
    label: `FY ${startYear}-${String(startYear + 1).slice(-2)}`,
  };
}

export function financialYearWarning(date: string) {
  const fy = indianFinancialYear();
  if (date >= fy.start && date <= fy.end) return null;
  return `The selected date is outside ${fy.label} (${fy.start} to ${fy.end}). Do you want to continue?`;
}
