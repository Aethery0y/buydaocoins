export function formatLargeNumber(value: string | number | bigint): string {
  const num = typeof value === 'string' ? BigInt(value) : typeof value === 'number' ? BigInt(Math.floor(value)) : value;
  
  const abbreviations = [
    { value: BigInt('1000000000000000000000000000000000'), symbol: 'Dc' },  // Decillion
    { value: BigInt('1000000000000000000000000000000'), symbol: 'No' },     // Nonillion
    { value: BigInt('1000000000000000000000000000'), symbol: 'Oc' },        // Octillion
    { value: BigInt('1000000000000000000000000'), symbol: 'Sp' },           // Septillion
    { value: BigInt('1000000000000000000000'), symbol: 'Sx' },              // Sextillion
    { value: BigInt('1000000000000000000'), symbol: 'Qi' },                 // Quintillion
    { value: BigInt('1000000000000000'), symbol: 'Qa' },                    // Quadrillion
    { value: BigInt('1000000000000'), symbol: 'T' },                        // Trillion
    { value: BigInt('1000000000'), symbol: 'B' },                           // Billion
    { value: BigInt('1000000'), symbol: 'M' },                              // Million
    { value: BigInt('1000'), symbol: 'K' },                                 // Thousand
  ];

  for (const { value: threshold, symbol } of abbreviations) {
    if (num >= threshold) {
      const divided = Number(num) / Number(threshold);
      
      if (divided >= 100) {
        return Math.floor(divided).toLocaleString() + symbol;
      } else if (divided >= 10) {
        return divided.toFixed(1) + symbol;
      } else {
        return divided.toFixed(2) + symbol;
      }
    }
  }

  return num.toLocaleString();
}
