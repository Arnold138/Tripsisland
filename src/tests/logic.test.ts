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
