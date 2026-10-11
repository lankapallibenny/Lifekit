/**
 * Offline unit converter.
 *
 * Factors are exact definitions or widely used standard values. Temperature is handled
 * with explicit formulas because it uses offsets rather than ratios. Every conversion is
 * performed as: value → base unit → target unit, so the tables stay short and verifiable.
 */

export type UnitCategory = 'length' | 'mass' | 'temperature' | 'area' | 'volume' | 'time' | 'data' | 'speed';

export interface Unit {
  id: string;
  label: string;
  /** Multiplier relative to the base unit of the category (temperature uses formulas). */
  factor: number;
}

export interface UnitCategoryInfo {
  id: UnitCategory;
  label: string;
  base: string;
  units: Unit[];
}

export const UNIT_CATEGORIES: UnitCategoryInfo[] = [
  {
    id: 'length',
    label: 'Length',
    base: 'metre',
    units: [
      { id: 'mm', label: 'Millimetre (mm)', factor: 0.001 },
      { id: 'cm', label: 'Centimetre (cm)', factor: 0.01 },
      { id: 'm', label: 'Metre (m)', factor: 1 },
      { id: 'km', label: 'Kilometre (km)', factor: 1000 },
      { id: 'inch', label: 'Inch (in)', factor: 0.0254 },
      { id: 'foot', label: 'Foot (ft)', factor: 0.3048 },
      { id: 'yard', label: 'Yard (yd)', factor: 0.9144 },
      { id: 'mile', label: 'Mile (mi)', factor: 1609.344 },
      { id: 'nautical-mile', label: 'Nautical mile', factor: 1852 },
    ],
  },
  {
    id: 'mass',
    label: 'Weight',
    base: 'kilogram',
    units: [
      { id: 'mg', label: 'Milligram (mg)', factor: 0.000001 },
      { id: 'g', label: 'Gram (g)', factor: 0.001 },
      { id: 'kg', label: 'Kilogram (kg)', factor: 1 },
      { id: 'quintal', label: 'Quintal (100 kg)', factor: 100 },
      { id: 'tonne', label: 'Tonne (t)', factor: 1000 },
      { id: 'ounce', label: 'Ounce (oz)', factor: 0.028349523125 },
      { id: 'pound', label: 'Pound (lb)', factor: 0.45359237 },
      { id: 'stone', label: 'Stone (st)', factor: 6.35029318 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    base: 'celsius',
    units: [
      { id: 'celsius', label: 'Celsius (°C)', factor: 1 },
      { id: 'fahrenheit', label: 'Fahrenheit (°F)', factor: 1 },
      { id: 'kelvin', label: 'Kelvin (K)', factor: 1 },
    ],
  },
  {
    id: 'area',
    label: 'Area',
    base: 'square metre',
    units: [
      { id: 'sqm', label: 'Square metre (m²)', factor: 1 },
      { id: 'sqft', label: 'Square foot (ft²)', factor: 0.09290304 },
      { id: 'sqyd', label: 'Square yard (yd²)', factor: 0.83612736 },
      { id: 'sqkm', label: 'Square kilometre (km²)', factor: 1_000_000 },
      { id: 'acre', label: 'Acre', factor: 4046.8564224 },
      { id: 'hectare', label: 'Hectare (ha)', factor: 10_000 },
      { id: 'cent', label: 'Cent (1/100 acre)', factor: 40.468564224 },
      { id: 'guntha', label: 'Guntha (121 sq yd)', factor: 101.17141056 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    base: 'litre',
    units: [
      { id: 'ml', label: 'Millilitre (ml)', factor: 0.001 },
      { id: 'l', label: 'Litre (L)', factor: 1 },
      { id: 'm3', label: 'Cubic metre (m³)', factor: 1000 },
      { id: 'cup', label: 'Cup (240 ml)', factor: 0.24 },
      { id: 'gallon-us', label: 'US gallon', factor: 3.785411784 },
      { id: 'gallon-uk', label: 'UK gallon', factor: 4.54609 },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    base: 'second',
    units: [
      { id: 'second', label: 'Second (s)', factor: 1 },
      { id: 'minute', label: 'Minute (min)', factor: 60 },
      { id: 'hour', label: 'Hour (h)', factor: 3600 },
      { id: 'day', label: 'Day', factor: 86_400 },
      { id: 'week', label: 'Week', factor: 604_800 },
      { id: 'month', label: 'Month (30.44 days)', factor: 2_629_746 },
      { id: 'year', label: 'Year (365.25 days)', factor: 31_557_600 },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    base: 'megabyte (binary)',
    units: [
      { id: 'byte', label: 'Byte', factor: 1 / (1024 * 1024) },
      { id: 'kb', label: 'Kilobyte (KiB)', factor: 1 / 1024 },
      { id: 'mb', label: 'Megabyte (MiB)', factor: 1 },
      { id: 'gb', label: 'Gigabyte (GiB)', factor: 1024 },
      { id: 'tb', label: 'Terabyte (TiB)', factor: 1024 * 1024 },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    base: 'metre per second',
    units: [
      { id: 'mps', label: 'Metres per second (m/s)', factor: 1 },
      { id: 'kph', label: 'Kilometres per hour (km/h)', factor: 1 / 3.6 },
      { id: 'mph', label: 'Miles per hour (mph)', factor: 0.44704 },
      { id: 'knot', label: 'Knot', factor: 0.514444 },
    ],
  },
];

function temperatureToBase(value: number, from: string): number {
  switch (from) {
    case 'fahrenheit':
      return ((value - 32) * 5) / 9;
    case 'kelvin':
      return value - 273.15;
    default:
      return value;
  }
}

function temperatureFromBase(value: number, to: string): number {
  switch (to) {
    case 'fahrenheit':
      return (value * 9) / 5 + 32;
    case 'kelvin':
      return value + 273.15;
    default:
      return value;
  }
}

export function convertUnit(category: UnitCategory, value: number, from: string, to: string): number | null {
  if (!Number.isFinite(value)) return null;
  const info = UNIT_CATEGORIES.find((c) => c.id === category);
  if (!info) return null;
  const fromUnit = info.units.find((u) => u.id === from);
  const toUnit = info.units.find((u) => u.id === to);
  if (!fromUnit || !toUnit) return null;

  if (category === 'temperature') {
    const base = temperatureToBase(value, from);
    return roundConversion(temperatureFromBase(base, to));
  }
  const baseValue = value * fromUnit.factor;
  return roundConversion(baseValue / toUnit.factor);
}

/**
 * Trim floating point noise (0.30000000000000004 → 0.3) without losing real precision:
 * one mile stays exactly 1.609344 km, and round-tripping a value returns the value you
 * started with. Used for conversion *results*, which must stay accurate.
 */
export function roundConversion(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  return Number(value.toPrecision(12));
}

/**
 * Round for *display*: six significant digits is plenty for a phone-sized readout, and it
 * keeps long decimals from overflowing the card. For money and other exact values the
 * formatting helpers in `money.ts` should be used instead.
 */
export function roundSignificant(value: number, digits = 6): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const factor = Math.pow(10, digits - 1 - magnitude);
  const rounded = Math.round(value * factor) / factor;
  return Number(rounded.toPrecision(Math.min(15, digits)));
}

/**
 * Human-readable number for the converter and calculator: the caller can cap the decimals,
 * otherwise large values show two decimals, small values keep more, and nothing is padded
 * with meaningless trailing zeros.
 */
export function formatNumber(value: number, maxDecimals?: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const automatic = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  const digits = Math.max(0, Math.min(maxDecimals ?? automatic, automatic));
  try {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
  } catch {
    return String(value);
  }
}
