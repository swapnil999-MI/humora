/**
 * Converts a number to Indian Currency words (e.g. 140800 -> "One Lakh Forty Thousand Eight Hundred Rupees Only")
 */
export function numberToWordsINR(num: number): string {
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    let result = '';
    if (n >= 100) {
      result += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      result += a[n] + ' ';
    }
    return result.trim();
  };

  const integerPart = Math.floor(Math.abs(num));
  const paisePart = Math.round((Math.abs(num) - integerPart) * 100);

  let current = integerPart;
  const parts: string[] = [];

  // Crores (1,00,00,000)
  if (current >= 10000000) {
    const crore = Math.floor(current / 10000000);
    parts.push(convertLessThanOneThousand(crore) + ' Crore');
    current %= 10000000;
  }

  // Lakhs (1,00,000)
  if (current >= 100000) {
    const lakh = Math.floor(current / 100000);
    parts.push(convertLessThanOneThousand(lakh) + ' Lakh');
    current %= 100000;
  }

  // Thousands (1,000)
  if (current >= 1000) {
    const thousand = Math.floor(current / 1000);
    parts.push(convertLessThanOneThousand(thousand) + ' Thousand');
    current %= 1000;
  }

  // Hundreds & below
  if (current > 0) {
    parts.push(convertLessThanOneThousand(current));
  }

  let words = parts.join(' ').trim() + ' Rupees';
  if (paisePart > 0) {
    words += ' and ' + convertLessThanOneThousand(paisePart) + ' Paise';
  }
  return words + ' Only';
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
