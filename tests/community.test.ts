/**
 * Community directory validation tests.
 *
 * The rule that matters: LIFEKIT must never show an organisation or phone number that a
 * human has not checked against a real source. `validateListingPack` is the gate, so these
 * tests feed it everything a careless or hostile pack could contain — missing sources,
 * invented categories, future verification dates, prototype keys — and assert that the
 * bad rows are dropped rather than rendered.
 */
import { describe, expect, it } from 'vitest';
import { validateListingPack } from '../src/pages/Community';
import type { DirectoryListing } from '../src/lib/models';

const TODAY = '2026-10-11';

function pack(listings: unknown[]): unknown {
  return { version: 1, listings };
}

const good: Partial<DirectoryListing> & { verification?: unknown; verifiedByName?: unknown } = {
  id: 'listing-1',
  organisation: 'District Public Library',
  category: 'education',
  region: 'Andhra Pradesh',
  city: 'Guntur',
  services: 'Reading room, free computer access, exam reference material.',
  contact: 'Published office contact only',
  sourceUrl: 'https://example.gov.in/library',
  lastVerified: '2026-10-01',
  // A published pack only clears a listing when it names the human who checked it.
  verification: 'verified',
  verifiedByName: 'Reviewed by the district library office',
};

describe('accepted listings', () => {
  it('keeps a complete, explicitly reviewed entry', () => {
    const result = validateListingPack(pack([good]), TODAY);
    expect(result.rejected).toBe(0);
    expect(result.listings).toHaveLength(1);
    const listing = result.listings[0]!;
    expect(listing.organisation).toBe('District Public Library');
    expect(listing.verification).toBe('verified');
    expect(listing.verifiedByName).toBeTruthy();
    expect(listing.sourceUrl).toContain('https://');
    expect(listing.published).toBe(true);
  });

  it('accepts a bare array as well as a {version, listings} pack file', () => {
    expect(validateListingPack([good], TODAY).listings).toHaveLength(1);
    expect(validateListingPack({ version: 1, listings: [good] }, TODAY).listings).toHaveLength(1);
  });

  it('keeps an entry an operator deliberately staged as unpublished', () => {
    const result = validateListingPack(pack([{ ...good, published: false }]), TODAY);
    expect(result.listings[0]?.published).toBe(false);
  });

  it('accepts every category the Community screen can display', () => {
    const categories = ['food', 'education', 'volunteering', 'community', 'emergency', 'public-support'];
    const result = validateListingPack(
      pack(categories.map((category, index) => ({ ...good, id: `l${index}`, category }))),
      TODAY
    );
    expect(result.listings).toHaveLength(categories.length);
    expect(result.rejected).toBe(0);
  });

  it('keeps a listing verified today, which is not in the future', () => {
    const result = validateListingPack(pack([{ ...good, lastVerified: TODAY }]), TODAY);
    expect(result.listings).toHaveLength(1);
  });
});

describe('rejected rows', () => {
  const cases: { name: string; value: unknown }[] = [
    { name: 'a missing source URL', value: { ...good, sourceUrl: '' } },
    { name: 'a non-http source', value: { ...good, sourceUrl: 'javascript:alert(1)' } },
    { name: 'a missing organisation name', value: { ...good, organisation: '   ' } },
    { name: 'a missing services description', value: { ...good, services: '' } },
    { name: 'a missing region', value: { ...good, region: '' } },
    { name: 'an unknown category', value: { ...good, category: 'shopping' } },
    { name: 'a verification date in the future', value: { ...good, lastVerified: '2027-01-01' } },
    { name: 'a verification date that is not an ISO date', value: { ...good, lastVerified: 'last Tuesday' } },
    { name: 'a missing verification date', value: { ...good, lastVerified: undefined } },
    { name: 'no verification claim at all', value: { ...good, verification: undefined } },
    { name: 'a claim of "unverified"', value: { ...good, verification: 'unverified' } },
    { name: 'no named reviewer', value: { ...good, verifiedByName: '' } },
  ];

  for (const { name, value } of cases) {
    it(`drops ${name}`, () => {
      const result = validateListingPack(pack([value]), TODAY);
      expect(result.listings).toHaveLength(0);
      expect(result.rejected).toBe(1);
    });
  }

  it('coerces a non-text contact to plain text instead of failing to render it', () => {
    const result = validateListingPack(pack([{ ...good, contact: 12345 }]), TODAY);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.contact).toBe('12345');
  });

  it('never renders a nested object as a contact value', () => {
    const result = validateListingPack(pack([{ ...good, contact: { nested: true } }]), TODAY);
    const contact = result.listings[0]?.contact ?? '';
    expect(contact).not.toContain('[object');
    expect(contact).not.toContain('nested');
  });

  it('drops rows carrying prototype-polluting keys, without polluting Object', () => {
    const hostile = JSON.parse(
      '{"id":"l1","organisation":"X","category":"food","region":"Y","services":"Z","contact":"c","sourceUrl":"https://example.org","lastVerified":"2026-10-01","verification":"verified","verifiedByName":"Operator","__proto__":{"polluted":true}}'
    );
    const result = validateListingPack(pack([hostile]), TODAY);
    expect(result.listings).toHaveLength(1);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(result.listings[0]?.organisation).toBe('X');
  });

  it('counts rejects without discarding the good rows', () => {
    const result = validateListingPack(pack([good, { ...good, id: 'bad', category: 'nope' }, good]), TODAY);
    expect(result.listings).toHaveLength(2);
    expect(result.rejected).toBe(1);
  });
});

describe('malformed packs', () => {
  it('returns an empty result instead of throwing for junk input', () => {
    for (const junk of [null, undefined, 42, 'not json', [], { version: 'one' }, { listings: {} }]) {
      const result = validateListingPack(junk, TODAY);
      expect(result.listings).toEqual([]);
      expect(result.rejected).toBe(0);
    }
  });

  it('ignores rows that are not objects', () => {
    const result = validateListingPack(pack([good, null, 'string', 7]), TODAY);
    expect(result.listings).toHaveLength(1);
    expect(result.rejected).toBe(3);
  });

  it('caps an implausibly large pack instead of freezing a budget phone', () => {
    const huge = Array.from({ length: 600 }, (_, i) => ({ ...good, id: `l${i}` }));
    const result = validateListingPack(pack(huge), TODAY);
    expect(result.listings.length).toBeLessThanOrEqual(200);
    expect(result.rejected).toBeGreaterThan(0);
  });
});
