import { describe, expect, it } from 'vitest';
import { commonTastes, daysUntil, inviteLink, parseInviteCode } from '../lib/logic';

describe('invitations', () => {
  it('lit un code dans un lien ou un texte', () => {
    expect(parseInviteCode('https://x.io/?code=isla-7k4q')).toBe('ISLA-7K4Q');
    expect(parseInviteCode(' rejoins-moi : ISLA-AB23 ')).toBe('ISLA-AB23');
    expect(parseInviteCode('bonjour')).toBeNull();
    expect(parseInviteCode(null)).toBeNull();
  });
  it('construit un lien partageable', () => {
    expect(inviteLink('ISLA-7K4Q', 'https://a.github.io/app/')).toBe('https://a.github.io/app/?code=ISLA-7K4Q');
  });
});

describe('goûts et dates', () => {
  it('trouve les goûts communs', () => {
    expect(commonTastes(['marche', 'onsen', 'photo'], ['onsen', 'gastro', 'marche'])).toEqual(['marche', 'onsen']);
  });
  it('compte les jours avant le départ', () => {
    expect(daysUntil('2027-02-17', new Date(2026, 9, 31))).toBe(109);
  });
});

import { byTime, tripDays } from '../lib/logic';
describe('jours du voyage', () => {
  it('liste les jours du 22 fév au 11 mars 2027', () => {
    const d = tripDays('2027-02-22', '2027-03-11');
    expect(d.length).toBe(18);
    expect(d[0]).toBe('2027-02-22');
    expect(d[6]).toBe('2027-02-28');
    expect(d[7]).toBe('2027-03-01');
  });
  it('trie par heure, sans heure en dernier', () => {
    expect(byTime([{ time: null }, { time: '18:00' }, { time: '09:30' }]).map((x) => x.time)).toEqual(['09:30', '18:00', null]);
  });
});

import { estimateLeg, fmtMin, dirLink } from '../lib/logic';
describe('trajets estimés', () => {
  it('Shinjuku Gyoen → Koishikawa Kōraku-en : métro, environ une demi-heure', () => {
    const l = estimateLeg({ lat: 35.6852, lon: 139.7101 }, { lat: 35.7056, lon: 139.7497 });
    expect(l.mode).toBe('transit');
    expect(l.minutes).toBeGreaterThan(20); expect(l.minutes).toBeLessThan(35);
  });
  it('lieux voisins : à pied', () => {
    const l = estimateLeg({ lat: 35.6938, lon: 139.7034 }, { lat: 35.6950, lon: 139.6995 });
    expect(l.mode).toBe('walking'); expect(l.minutes).toBeLessThan(10);
  });
  it('Tokyo → Kyoto : train rapide', () => {
    const l = estimateLeg({ lat: 35.681, lon: 139.767 }, { lat: 34.985, lon: 135.758 });
    expect(l.mode).toBe('train'); expect(l.minutes).toBeGreaterThan(120);
  });
  it('formats', () => {
    expect(fmtMin(45)).toBe('45 min'); expect(fmtMin(125)).toBe('2 h05');
    expect(dirLink({ lat: 1, lon: 2, title: 'x' }, { lat: 3, lon: 4 }, 'walking')).toContain('origin=3,4&destination=1%2C2&travelmode=walking');
  });
});
